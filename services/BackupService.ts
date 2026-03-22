import JSZip from 'jszip';
import * as LegacyFS from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { beginShareTrace } from '@/services/shareTrace';
import * as Sharing from 'expo-sharing';
import { getDb } from '@/db/schema';
import type { Category, Document } from '@/db/types';

const ARCHIVE_DIR = `${LegacyFS.documentDirectory}archive/`;
const MANIFEST_FILE = 'manifest.json';
const BACKUP_VERSION = 1;

type BackupManifest = {
  version: number;
  timestamp: string;
  categories: Category[];
  documents: Document[];
};

// ─── Backup ────────────────────────────────────────────────────────────────

/**
 * Creates a VaultBackup.zip containing:
 *  - manifest.json  (all categories + documents as JSON)
 *  - archive/*      (all media files)
 * Opens the native share sheet so the user can save the zip anywhere.
 */
export async function createBackup(): Promise<void> {
  const db = await getDb();
  const zip = new JSZip();

  // 1. Export all categories and documents into a manifest
  const categories = await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY id ASC');
  const documents = await db.getAllAsync<Document>('SELECT * FROM documents ORDER BY id ASC');

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    timestamp: new Date().toISOString(),
    categories,
    documents,
  };

  zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  // 2. Bundle all archive media files
  const archiveInfo = await LegacyFS.getInfoAsync(ARCHIVE_DIR);
  if (archiveInfo.exists) {
    const fileNames = await LegacyFS.readDirectoryAsync(ARCHIVE_DIR);
    for (const fileName of fileNames) {
      const fileUri = `${ARCHIVE_DIR}${fileName}`;
      try {
        const base64Content = await LegacyFS.readAsStringAsync(fileUri, {
          encoding: LegacyFS.EncodingType.Base64,
        });
        zip.file(`archive/${fileName}`, base64Content, { base64: true });
      } catch {
        // Skip unreadable files — non-critical
      }
    }
  }

  // 3. Generate zip and write to cache
  const zipBase64 = await zip.generateAsync({ type: 'base64' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipPath = `${LegacyFS.cacheDirectory}VaultBackup_${timestamp}.zip`;
  await LegacyFS.writeAsStringAsync(zipPath, zipBase64, {
    encoding: LegacyFS.EncodingType.Base64,
  });

  // 4. Share the zip
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    const endTrace = beginShareTrace('BackupService.createBackup', 'H3');
    try {
      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
        dialogTitle: 'Save Vault Backup',
      });
    } finally {
      endTrace();
    }
  }
}

// ─── Restore ───────────────────────────────────────────────────────────────

/**
 * Lets the user pick a VaultBackup.zip, then:
 *  1. Parses the manifest and restores categories + documents into SQLite.
 *  2. Clears and repopulates the archive/ directory from the zip's media files.
 * Returns true on success, false if the user cancelled or an error occurred.
 */
export async function restoreFromBackup(): Promise<boolean> {
  // 1. Pick the zip file
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/zip',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets[0]) return false;

  const zipUri = result.assets[0].uri;

  // 2. Read and parse the zip
  const zipBase64 = await LegacyFS.readAsStringAsync(zipUri, {
    encoding: LegacyFS.EncodingType.Base64,
  });

  const zip = await JSZip.loadAsync(zipBase64, { base64: true });

  const manifestFile = zip.file(MANIFEST_FILE);
  if (!manifestFile) {
    throw new Error('Invalid backup file: manifest.json not found.');
  }

  const manifestText = await manifestFile.async('text');
  const manifest: BackupManifest = JSON.parse(manifestText);

  if (!manifest.version || !manifest.categories || !manifest.documents) {
    throw new Error('Invalid backup file: manifest is malformed.');
  }

  // 3. Restore SQLite — wipe existing data and re-insert from manifest
  const db = await getDb();
  await db.execAsync('DELETE FROM documents; DELETE FROM categories;');

  for (const cat of manifest.categories) {
    await db.runAsync(
      'INSERT OR REPLACE INTO categories (id, name, icon_name, created_at) VALUES (?, ?, ?, ?)',
      [cat.id, cat.name, cat.icon_name, cat.created_at]
    );
  }

  for (const doc of manifest.documents) {
    await db.runAsync(
      `INSERT OR REPLACE INTO documents
         (id, category_id, title, file_uri, file_type, purchase_price, expiry_date, notes, notification_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doc.id,
        doc.category_id,
        doc.title,
        doc.file_uri,
        doc.file_type,
        doc.purchase_price,
        doc.expiry_date,
        doc.notes,
        null, // notification_ids are rescheduled fresh after restore
        doc.created_at,
        doc.updated_at,
      ]
    );
  }

  // 4. Restore archive media files
  await LegacyFS.makeDirectoryAsync(ARCHIVE_DIR, { intermediates: true });

  // Clear existing archive files first
  const existingFiles = await LegacyFS.readDirectoryAsync(ARCHIVE_DIR).catch(() => []);
  for (const file of existingFiles) {
    await LegacyFS.deleteAsync(`${ARCHIVE_DIR}${file}`, { idempotent: true });
  }

  const archiveEntries = zip.folder('archive');
  if (archiveEntries) {
    const filePromises: Promise<void>[] = [];
    archiveEntries.forEach((relativePath, file) => {
      if (!file.dir) {
        filePromises.push(
          (async () => {
            const base64Content = await file.async('base64');
            const destUri = `${ARCHIVE_DIR}${relativePath}`;
            await LegacyFS.writeAsStringAsync(destUri, base64Content, {
              encoding: LegacyFS.EncodingType.Base64,
            });
          })()
        );
      }
    });
    await Promise.all(filePromises);
  }

  return true;
}

// ─── Share selected documents as zip ───────────────────────────────────────

type SelectedManifestEntry = {
  id: number;
  title: string;
  category_name: string | null;
  file_name: string;
};

/**
 * Zips the given documents (by file_uri) and opens the share sheet.
 * Uses a simple manifest (id, title, category_name, file_name) and archive/* files.
 */
export async function shareSelectedDocuments(
  documents: Document[],
  categories: Category[]
): Promise<void> {
  if (documents.length === 0) return;
  const zip = new JSZip();
  const manifest: SelectedManifestEntry[] = [];

  for (const doc of documents) {
    const fileName = doc.file_uri.split('/').pop() ?? `doc_${doc.id}`;
    const categoryName = categories.find((c) => c.id === doc.category_id)?.name ?? null;
    manifest.push({
      id: doc.id,
      title: doc.title,
      category_name: categoryName,
      file_name: fileName,
    });
    try {
      const base64Content = await LegacyFS.readAsStringAsync(doc.file_uri, {
        encoding: LegacyFS.EncodingType.Base64,
      });
      zip.file(`archive/${fileName}`, base64Content, { base64: true });
    } catch {
      // Skip if file not readable
    }
  }

  zip.file('selected_manifest.json', JSON.stringify(manifest, null, 2));

  const zipBase64 = await zip.generateAsync({ type: 'base64' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipPath = `${LegacyFS.cacheDirectory}SelectedDocs_${timestamp}.zip`;
  await LegacyFS.writeAsStringAsync(zipPath, zipBase64, {
    encoding: LegacyFS.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    const endTrace = beginShareTrace('BackupService.shareSelectedDocuments', 'H3');
    try {
      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
        dialogTitle: 'Share selected documents',
      });
    } finally {
      endTrace();
    }
  }
}
