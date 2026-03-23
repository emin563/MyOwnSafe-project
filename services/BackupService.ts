import JSZip from 'jszip';
import * as LegacyFS from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { beginShareTrace } from '@/services/shareTrace';
import * as Sharing from 'expo-sharing';
import { getDb } from '@/db/schema';
import type { Category, Document, FileType } from '@/db/types';

const ARCHIVE_DIR = `${LegacyFS.documentDirectory}archive/`;
const MANIFEST_FILE = 'manifest.json';
const BACKUP_VERSION = 1;

// ─── Restore hardening limits ──────────────────────────────────────────────
const MAX_ZIP_BYTES = 50 * 1024 * 1024; // 50 MiB hard cap to prevent OOM on restore
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024; // 2 MiB
const MAX_CATEGORIES = 200;
const MAX_DOCUMENTS = 5000;
const MAX_ARCHIVE_ENTRIES = 20000;
const MAX_FILENAME_LEN = 120;

// Allow most filename characters (including spaces/unicode), but never allow path separators
// or empty/basename traversal. We only enforce this at restore time where zip entry names are
// untrusted.
const SAFE_FILENAME_RE = new RegExp(`^[^/\\\\]{1,${MAX_FILENAME_LEN}}$`);
const RESERVED_FILENAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const ALLOWED_FILE_TYPES: ReadonlySet<FileType> = new Set(['image', 'pdf', 'word', 'excel', 'document']);

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

  // 4. Share the zip (and always cleanup the generated cache file).
  try {
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
  } finally {
    // Avoid unbounded growth in cache/ from repeated backups.
    try {
      await LegacyFS.deleteAsync(zipPath, { idempotent: true });
    } catch {
      // non-critical
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

  const zipInfo = await LegacyFS.getInfoAsync(zipUri).catch(() => null);
  if (zipInfo && typeof zipInfo.size === 'number' && zipInfo.size > MAX_ZIP_BYTES) {
    throw new Error('Backup file too large to restore.');
  }

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
  if (manifestText.length > MAX_MANIFEST_BYTES) {
    throw new Error('Invalid backup file: manifest too large.');
  }
  const manifest: BackupManifest = JSON.parse(manifestText);

  if (!manifest.version || !manifest.categories || !manifest.documents) {
    throw new Error('Invalid backup file: manifest is malformed.');
  }

  if (!Array.isArray(manifest.categories) || manifest.categories.length > MAX_CATEGORIES) {
    throw new Error('Invalid backup file: too many categories.');
  }
  if (!Array.isArray(manifest.documents) || manifest.documents.length > MAX_DOCUMENTS) {
    throw new Error('Invalid backup file: too many documents.');
  }

  const toSafeFilename = (input: unknown): string | null => {
    if (typeof input !== 'string') return null;
    const normalized = input.replace(/\\/g, '/').trim();
    const name = normalized.split('/').pop() ?? '';
    if (!name) return null;
    if (name === '.' || name === '..') return null;
    if (name.length > MAX_FILENAME_LEN) return null;
    // Prevent path-traversal style edge cases that can appear in basenames.
    if (name.includes('..') || name.includes('/') || name.includes('\\')) return null;
    if (!SAFE_FILENAME_RE.test(name)) return null;
    if (RESERVED_FILENAMES.has(name.toLowerCase())) return null;
    return name;
  };

  // 3. Restore SQLite — wipe existing data and re-insert from manifest
  const db = await getDb();
  await db.execAsync('DELETE FROM documents; DELETE FROM categories;');

  const restoredCategoryIds = new Set<number>();
  for (const cat of manifest.categories) {
    const catId = typeof cat.id === 'number' && Number.isSafeInteger(cat.id) && cat.id > 0 ? cat.id : null;
    const catName = typeof cat.name === 'string' ? cat.name.slice(0, 200) : null;
    const iconName = typeof cat.icon_name === 'string' ? cat.icon_name.slice(0, 200) : null;
    if (catId == null || !catName || !iconName) continue;

    restoredCategoryIds.add(catId);
    await db.runAsync(
      'INSERT OR REPLACE INTO categories (id, name, icon_name, created_at) VALUES (?, ?, ?, ?)',
      [
        catId,
        catName,
        iconName,
        typeof cat.created_at === 'string' ? cat.created_at.slice(0, 200) : new Date().toISOString(),
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
  const safeArchiveNames = new Set<string>();
  if (archiveEntries) {
    const filesToWrite: Array<{ safeName: string; file: any }> = [];

    archiveEntries.forEach((relativePath, file) => {
      if (file.dir) return;
      const safeName = toSafeFilename(relativePath);
      if (!safeName) return;
      // Hard per-file cap: prevents single-entry bombs from OOM.
      const uncompressedSize = (file as any)?._data?.uncompressedSize;
      if (typeof uncompressedSize === 'number' && uncompressedSize > 30 * 1024 * 1024) {
        return;
      }

      if (safeArchiveNames.has(safeName)) return; // de-dupe by basename
      safeArchiveNames.add(safeName);
      filesToWrite.push({ safeName, file });
    });

    if (safeArchiveNames.size > MAX_ARCHIVE_ENTRIES) {
      throw new Error('Invalid backup file: too many archive entries.');
    }

    // Write sequentially to avoid a large concurrent base64/IO memory spike.
    for (const entry of filesToWrite) {
      const destUri = `${ARCHIVE_DIR}${entry.safeName}`;

      const base64Content = await entry.file.async('base64');
      await LegacyFS.writeAsStringAsync(destUri, base64Content, {
        encoding: LegacyFS.EncodingType.Base64,
      });
    }
  }

  // 5. Restore documents using only archive filenames present in the zip.
  //    This prevents manifest.json from pointing file_uri at arbitrary device paths.
  for (const doc of manifest.documents) {
    const docId = typeof doc.id === 'number' && Number.isSafeInteger(doc.id) && doc.id > 0 ? doc.id : null;
    const safeNameFromManifest = toSafeFilename(doc.file_uri);
    const fileType = typeof doc.file_type === 'string' ? (doc.file_type as FileType) : null;
    const title = typeof doc.title === 'string' ? doc.title.slice(0, 500) : null;

    if (docId == null || !safeNameFromManifest || !title) continue;
    if (!safeArchiveNames.has(safeNameFromManifest)) continue;
    if (!fileType || !ALLOWED_FILE_TYPES.has(fileType)) continue;

    const categoryId =
      typeof doc.category_id === 'number' && Number.isSafeInteger(doc.category_id) && restoredCategoryIds.has(doc.category_id)
        ? doc.category_id
        : null;

    const purchasePrice = typeof doc.purchase_price === 'number' && Number.isFinite(doc.purchase_price) ? doc.purchase_price : null;
    const expiryDate =
      typeof doc.expiry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(doc.expiry_date) ? doc.expiry_date : null;
    const notes = typeof doc.notes === 'string' ? doc.notes.slice(0, 20000) : null;

    const createdAt = typeof doc.created_at === 'string' ? doc.created_at.slice(0, 200) : new Date().toISOString();
    const updatedAt = typeof doc.updated_at === 'string' ? doc.updated_at.slice(0, 200) : new Date().toISOString();

    await db.runAsync(
      `INSERT OR REPLACE INTO documents
         (id, category_id, title, file_uri, file_type, purchase_price, expiry_date, notes, notification_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        categoryId,
        title,
        `${ARCHIVE_DIR}${safeNameFromManifest}`,
        fileType,
        purchasePrice,
        expiryDate,
        notes,
        null, // notification_ids are rescheduled fresh after restore
        createdAt,
        updatedAt,
      ]
    );
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

  try {
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
  } finally {
    // Avoid unbounded growth in cache/ from repeated zips.
    try {
      await LegacyFS.deleteAsync(zipPath, { idempotent: true });
    } catch {
      // non-critical
    }
  }
}
