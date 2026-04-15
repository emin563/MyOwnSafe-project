import JSZip from 'jszip';
import * as LegacyFS from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { withExternalActivityGuard } from '@/store/auth-flags';
import { sharingShareAsyncSerialized } from '@/services/sharingSerialized';
import * as Sharing from 'expo-sharing';
import { getDb } from '@/db/schema';
import { getSetting } from '@/db/settings';
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

// ─── Backup creation limits ─────────────────────────────────────────────
const MAX_BACKUP_CREATE_BYTES = 100 * 1024 * 1024; // 100 MiB
const MAX_BACKUP_CREATE_FILES = 5000;

/** Parallel file reads per batch (disk I/O overlaps; larger batches = fewer round-trips). */
const READ_BATCH_SIZE = 12;
/**
 * STORE = no DEFLATE pass — usually the largest win on phone CPUs. Backup zip is bigger but
 * photos/PDFs barely shrink with DEFLATE anyway; restore still accepts the zip unchanged.
 */
const ZIP_GENERATE_OPTIONS = {
  type: 'base64' as const,
  compression: 'STORE' as const,
  /** Stream entries so JSZip does not buffer entire files before emitting progress. */
  streamFiles: true,
};

export type BackupProgress =
  | { phase: 'preflight'; totalBytes?: number; fileCount?: number }
  | { phase: 'reading'; current: number; total: number }
  | { phase: 'compressing'; percent: number; currentFile?: string | null }
  | { phase: 'saving' }
  | { phase: 'drive'; uploaded?: number; totalBytes?: number }
  | { phase: 'share' };

/** JSZip `generateAsync` metadata (see ZipFileWorker). */
type JsZipGenerateMeta = { percent?: number; currentFile?: string | null };

export function getBackupProgressMessage(p: BackupProgress): string {
  switch (p.phase) {
    case 'preflight':
      return 'Preparing vault export…';
    case 'reading':
      return `Reading files (${p.current} of ${p.total})…`;
    case 'compressing': {
      const tail =
        p.currentFile && p.currentFile.length > 0
          ? ` — ${p.currentFile.split('/').pop() ?? p.currentFile}`
          : '';
      return `Compressing backup (${Math.round(p.percent)}%)${tail}…`;
    }
    case 'saving':
      return 'Writing backup file…';
    case 'drive':
      if (
        p.uploaded != null &&
        p.totalBytes != null &&
        p.totalBytes > 0
      ) {
        return `Uploading to Google Drive (${Math.min(100, Math.round((100 * p.uploaded) / p.totalBytes))}%)…`;
      }
      return 'Uploading a copy to Google Drive…';
    case 'share':
      return 'Opening share sheet…';
    default:
      return 'Working…';
  }
}

/**
 * Single 0–100 value for one progress bar: reading → compressing (JSZip %) → saving → (optional Drive) → share.
 * Create-backup flow does not use the Drive segment (zip is local export only).
 */
export function getBackupProgressDisplay(p: BackupProgress): { percent: number; message: string } {
  const message = getBackupProgressMessage(p);
  let percent = 0;
  switch (p.phase) {
    case 'preflight':
      percent = 3;
      break;
    case 'reading':
      percent = p.total > 0 ? Math.round((22 * p.current) / p.total) : 6;
      break;
    case 'compressing':
      percent =
        22 + Math.round((56 * Math.min(100, Math.max(0, p.percent))) / 100);
      break;
    case 'saving':
      percent = 80;
      break;
    case 'drive':
      if (p.uploaded != null && p.totalBytes != null && p.totalBytes > 0) {
        percent =
          80 + Math.round((16 * Math.min(p.uploaded, p.totalBytes)) / p.totalBytes);
      } else {
        percent = 88;
      }
      break;
    case 'share':
      percent = 100;
      break;
    default:
      percent = 0;
  }
  return { percent: Math.min(100, Math.max(0, percent)), message };
}

function emitCompressingFromJsZip(
  onProgress: ((p: BackupProgress) => void) | undefined,
  meta: JsZipGenerateMeta
): void {
  if (!onProgress) return;
  const raw = typeof meta.percent === 'number' ? meta.percent : 0;
  const pct = Math.min(100, Math.max(0, raw));
  onProgress({
    phase: 'compressing',
    percent: pct,
    currentFile: meta.currentFile != null ? String(meta.currentFile) : undefined,
  });
}

/** Lets the RN bridge flush layout/paint so progress updates are visible between heavy steps. */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      Promise.resolve().then(() => resolve());
    }
  });
}

export type BackupPreflightResult = {
  ok: boolean;
  totalBytes: number;
  fileCount: number;
  reason?: string;
};

/**
 * Quick pre-flight check before building a backup zip.
 * Returns estimated archive size and file count so the UI can warn the user.
 */
export async function preflightBackup(): Promise<BackupPreflightResult> {
  let totalBytes = 0;
  let fileCount = 0;
  const archiveInfo = await LegacyFS.getInfoAsync(ARCHIVE_DIR);
  if (archiveInfo.exists) {
    const names = await LegacyFS.readDirectoryAsync(ARCHIVE_DIR);
    fileCount = names.length;
    for (const name of names) {
      const info = await LegacyFS.getInfoAsync(`${ARCHIVE_DIR}${name}`).catch(() => null);
      if (info?.exists && 'size' in info && typeof info.size === 'number') {
        totalBytes += info.size;
      }
    }
  }
  if (totalBytes > MAX_BACKUP_CREATE_BYTES) {
    return { ok: false, totalBytes, fileCount, reason: `Archive is ~${Math.round(totalBytes / 1024 / 1024)} MiB which exceeds the ${MAX_BACKUP_CREATE_BYTES / 1024 / 1024} MiB backup limit.` };
  }
  if (fileCount > MAX_BACKUP_CREATE_FILES) {
    return { ok: false, totalBytes, fileCount, reason: `Archive has ${fileCount} files which exceeds the ${MAX_BACKUP_CREATE_FILES} file backup limit.` };
  }
  return { ok: true, totalBytes, fileCount };
}

/**
 * Same limits as full-vault backup: selected files must not exceed total size / count.
 */
export async function preflightShareSelectedDocuments(documents: Document[]): Promise<BackupPreflightResult> {
  let totalBytes = 0;
  let fileCount = 0;
  for (const doc of documents) {
    if (!doc.file_uri.startsWith(ARCHIVE_DIR)) continue;
    fileCount += 1;
    const info = await LegacyFS.getInfoAsync(doc.file_uri).catch(() => null);
    if (info?.exists && 'size' in info && typeof info.size === 'number') {
      totalBytes += info.size;
    }
  }
  if (totalBytes > MAX_BACKUP_CREATE_BYTES) {
    return {
      ok: false,
      totalBytes,
      fileCount,
      reason: `Selection is ~${Math.round(totalBytes / 1024 / 1024)} MiB which exceeds the ${MAX_BACKUP_CREATE_BYTES / 1024 / 1024} MiB zip limit.`,
    };
  }
  if (fileCount > MAX_BACKUP_CREATE_FILES) {
    return {
      ok: false,
      totalBytes,
      fileCount,
      reason: `Selection has ${fileCount} files which exceeds the ${MAX_BACKUP_CREATE_FILES} file limit.`,
    };
  }
  return { ok: true, totalBytes, fileCount };
}

async function moveFileOrCopy(from: string, to: string): Promise<void> {
  try {
    await LegacyFS.moveAsync({ from, to });
    return;
  } catch {
    await LegacyFS.copyAsync({ from, to });
    await LegacyFS.deleteAsync(from, { idempotent: true });
  }
}

async function restoreArchiveFromRollback(archiveDir: string, rollbackDir: string): Promise<void> {
  await LegacyFS.makeDirectoryAsync(archiveDir, { intermediates: true });
  const current = await LegacyFS.readDirectoryAsync(archiveDir).catch(() => []);
  for (const name of current) {
    await LegacyFS.deleteAsync(`${archiveDir}${name}`, { idempotent: true });
  }
  const rollbackFiles = await LegacyFS.readDirectoryAsync(rollbackDir).catch(() => []);
  for (const name of rollbackFiles) {
    await moveFileOrCopy(`${rollbackDir}${name}`, `${archiveDir}${name}`);
  }
}

// ─── Backup ────────────────────────────────────────────────────────────────

/**
 * Creates a VaultBackup.zip containing:
 *  - manifest.json  (all categories + documents as JSON)
 *  - archive/*      (all media files)
 * Opens the native share sheet so the user can save the zip anywhere.
 *
 * **Google Drive:** This flow is **local export only** (zip + share). Ongoing cloud sync uses
 * per-file uploads when documents are saved (`maybeUploadVaultDocumentToGoogleDrive`), not
 * full-zip uploads.
 */
export async function createBackup(onProgress?: (p: BackupProgress) => void): Promise<void> {
  const preflight = await preflightBackup();
  if (!preflight.ok) {
    throw new Error(preflight.reason ?? 'Backup too large.');
  }

  onProgress?.({
    phase: 'preflight',
    totalBytes: preflight.totalBytes,
    fileCount: preflight.fileCount,
  });

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

  zip.file(MANIFEST_FILE, JSON.stringify(manifest));

  // 2. Bundle all archive media files (batched parallel reads)
  const archiveInfo = await LegacyFS.getInfoAsync(ARCHIVE_DIR);
  let fileNames: string[] = [];
  if (archiveInfo.exists) {
    fileNames = await LegacyFS.readDirectoryAsync(ARCHIVE_DIR);
  }
  const totalFiles = fileNames.length;
  if (totalFiles > 0) {
    onProgress?.({ phase: 'reading', current: 0, total: totalFiles });
  }
  for (let i = 0; i < fileNames.length; i += READ_BATCH_SIZE) {
    const batch = fileNames.slice(i, i + READ_BATCH_SIZE);
    const loaded = await Promise.all(
      batch.map(async (fileName) => {
        const fileUri = `${ARCHIVE_DIR}${fileName}`;
        try {
          const base64Content = await LegacyFS.readAsStringAsync(fileUri, {
            encoding: LegacyFS.EncodingType.Base64,
          });
          return { fileName, base64Content };
        } catch {
          return null;
        }
      })
    );
    for (const entry of loaded) {
      if (!entry) continue;
      zip.file(`archive/${entry.fileName}`, entry.base64Content, { base64: true });
    }
    onProgress?.({ phase: 'reading', current: Math.min(i + batch.length, totalFiles), total: totalFiles });
    await yieldToUi();
  }

  // 3. Generate zip and write to cache (JSZip streams progress via 2nd arg)
  onProgress?.({ phase: 'compressing', percent: 0, currentFile: null });
  await yieldToUi();
  const zipBase64 = await zip.generateAsync(ZIP_GENERATE_OPTIONS, (meta) => {
    emitCompressingFromJsZip(onProgress, meta as JsZipGenerateMeta);
  });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawVaultName = ((await getSetting('vaultName')) ?? 'Vault').trim() || 'Vault';
  const safeVaultName = rawVaultName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'Vault';
  const zipPath = `${LegacyFS.cacheDirectory}${safeVaultName}_Backup_${timestamp}.zip`;
  onProgress?.({ phase: 'saving' });
  await LegacyFS.writeAsStringAsync(zipPath, zipBase64, {
    encoding: LegacyFS.EncodingType.Base64,
  });

  // 4. Share the zip (and always cleanup the generated cache file).
  try {
    onProgress?.({ phase: 'share' });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await sharingShareAsyncSerialized(zipPath, {
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
        dialogTitle: 'Save Vault Backup',
      });
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
  const result = await withExternalActivityGuard(() =>
    DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    })
  );

  if (result.canceled || !result.assets[0]) return false;

  const zipUri = result.assets[0].uri;

  const zipInfo = await LegacyFS.getInfoAsync(zipUri).catch(() => null);
  if (zipInfo?.exists && 'size' in zipInfo && typeof zipInfo.size === 'number' && zipInfo.size > MAX_ZIP_BYTES) {
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

  const restoreId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const stageDir = `${LegacyFS.cacheDirectory}restore_stage_${restoreId}/`;
  const rollbackDir = `${LegacyFS.cacheDirectory}restore_rollback_${restoreId}/`;

  const archiveEntries = zip.folder('archive');
  const safeArchiveNames = new Set<string>();
  let archiveSwapped = false;

  await LegacyFS.makeDirectoryAsync(stageDir, { intermediates: true });

  try {
    // 3. Validate + stage archive files into a temp folder first.
    if (archiveEntries) {
      const filesToWrite: Array<{ safeName: string; file: any }> = [];

      archiveEntries.forEach((relativePath, file) => {
        if (file.dir) return;
        const safeName = toSafeFilename(relativePath);
        if (!safeName) return;
        const uncompressedSize = (file as any)?._data?.uncompressedSize;
        if (typeof uncompressedSize === 'number' && uncompressedSize > 30 * 1024 * 1024) {
          return;
        }

        if (safeArchiveNames.has(safeName)) return;
        safeArchiveNames.add(safeName);
        filesToWrite.push({ safeName, file });
      });

      if (safeArchiveNames.size > MAX_ARCHIVE_ENTRIES) {
        throw new Error('Invalid backup file: too many archive entries.');
      }

      for (const entry of filesToWrite) {
        const destUri = `${stageDir}${entry.safeName}`;
        const base64Content = await entry.file.async('base64');
        await LegacyFS.writeAsStringAsync(destUri, base64Content, {
          encoding: LegacyFS.EncodingType.Base64,
        });
      }
    }

    // 4. Swap archive directories (old -> rollback, staged -> live).
    await LegacyFS.makeDirectoryAsync(ARCHIVE_DIR, { intermediates: true });
    await LegacyFS.makeDirectoryAsync(rollbackDir, { intermediates: true });

    try {
      const existingFiles = await LegacyFS.readDirectoryAsync(ARCHIVE_DIR).catch(() => []);
      for (const file of existingFiles) {
        await moveFileOrCopy(`${ARCHIVE_DIR}${file}`, `${rollbackDir}${file}`);
      }

      const stagedFiles = await LegacyFS.readDirectoryAsync(stageDir).catch(() => []);
      for (const file of stagedFiles) {
        await moveFileOrCopy(`${stageDir}${file}`, `${ARCHIVE_DIR}${file}`);
      }
      archiveSwapped = true;
    } catch {
      try {
        await restoreArchiveFromRollback(ARCHIVE_DIR, rollbackDir);
      } catch {
        // fall through to clear error below
      }
      throw new Error('Could not restore backup files safely.');
    }

    // 5. Restore SQLite in a transaction — atomic DB state.
    const db = await getDb();
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync('DELETE FROM document_tags; DELETE FROM documents; DELETE FROM categories;');

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

        for (const doc of manifest.documents) {
          const docId = typeof doc.id === 'number' && Number.isSafeInteger(doc.id) && doc.id > 0 ? doc.id : null;
          const safeNameFromManifest = toSafeFilename(doc.file_uri);
          const fileType = typeof doc.file_type === 'string' ? (doc.file_type as FileType) : null;
          const title = typeof doc.title === 'string' ? doc.title.slice(0, 500) : null;

          if (docId == null || !safeNameFromManifest || !title) continue;
          if (!safeArchiveNames.has(safeNameFromManifest)) continue;
          if (!fileType || !ALLOWED_FILE_TYPES.has(fileType)) continue;

          const categoryId =
            typeof doc.category_id === 'number' &&
            Number.isSafeInteger(doc.category_id) &&
            restoredCategoryIds.has(doc.category_id)
              ? doc.category_id
              : null;

          const purchasePrice =
            typeof doc.purchase_price === 'number' && Number.isFinite(doc.purchase_price)
              ? doc.purchase_price
              : null;
          const expiryDate =
            typeof doc.expiry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(doc.expiry_date)
              ? doc.expiry_date
              : null;
          const notes = typeof doc.notes === 'string' ? doc.notes.slice(0, 20000) : null;

          const createdAt =
            typeof doc.created_at === 'string' ? doc.created_at.slice(0, 200) : new Date().toISOString();
          const updatedAt =
            typeof doc.updated_at === 'string' ? doc.updated_at.slice(0, 200) : new Date().toISOString();

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
              null,
              createdAt,
              updatedAt,
            ]
          );
        }
      });
    } catch (e) {
      if (archiveSwapped) {
        try {
          await restoreArchiveFromRollback(ARCHIVE_DIR, rollbackDir);
        } catch {
          throw new Error('Restore failed and previous archive could not be recovered safely.');
        }
      }
      throw e;
    }

    try {
      await LegacyFS.deleteAsync(rollbackDir, { idempotent: true });
    } catch {
      // non-critical cleanup
    }

    return true;
  } finally {
    try {
      await LegacyFS.deleteAsync(stageDir, { idempotent: true });
    } catch {
      // non-critical cleanup
    }
    try {
      await LegacyFS.deleteAsync(rollbackDir, { idempotent: true });
    } catch {
      // non-critical cleanup
    }
  }
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
  categories: Category[],
  onProgress?: (p: BackupProgress) => void
): Promise<void> {
  if (documents.length === 0) return;
  const preflight = await preflightShareSelectedDocuments(documents);
  if (!preflight.ok) {
    throw new Error(preflight.reason ?? 'Selection too large to zip.');
  }
  onProgress?.({
    phase: 'preflight',
    totalBytes: preflight.totalBytes,
    fileCount: preflight.fileCount,
  });
  const zip = new JSZip();
  const manifest: SelectedManifestEntry[] = [];

  const eligible = documents.filter((d) => d.file_uri.startsWith(ARCHIVE_DIR));
  const totalEligible = eligible.length;
  if (totalEligible > 0) {
    onProgress?.({ phase: 'reading', current: 0, total: totalEligible });
  }
  for (let i = 0; i < eligible.length; i += READ_BATCH_SIZE) {
    const batch = eligible.slice(i, i + READ_BATCH_SIZE);
    const rows = await Promise.all(
      batch.map(async (doc) => {
        const fileName = doc.file_uri.split('/').pop() ?? `doc_${doc.id}`;
        const categoryName = categories.find((c) => c.id === doc.category_id)?.name ?? null;
        let base64Content: string | null = null;
        try {
          base64Content = await LegacyFS.readAsStringAsync(doc.file_uri, {
            encoding: LegacyFS.EncodingType.Base64,
          });
        } catch {
          base64Content = null;
        }
        return { doc, fileName, categoryName, base64Content };
      })
    );
    for (const { doc, fileName, categoryName, base64Content } of rows) {
      manifest.push({
        id: doc.id,
        title: doc.title,
        category_name: categoryName,
        file_name: fileName,
      });
      if (base64Content) {
        zip.file(`archive/${fileName}`, base64Content, { base64: true });
      }
    }
    onProgress?.({
      phase: 'reading',
      current: Math.min(i + batch.length, totalEligible),
      total: totalEligible,
    });
    await yieldToUi();
  }

  zip.file('selected_manifest.json', JSON.stringify(manifest));

  onProgress?.({ phase: 'compressing', percent: 0, currentFile: null });
  await yieldToUi();
  const zipBase64 = await zip.generateAsync(ZIP_GENERATE_OPTIONS, (meta) => {
    emitCompressingFromJsZip(onProgress, meta as JsZipGenerateMeta);
  });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipPath = `${LegacyFS.cacheDirectory}SelectedDocs_${timestamp}.zip`;
  onProgress?.({ phase: 'saving' });
  await LegacyFS.writeAsStringAsync(zipPath, zipBase64, {
    encoding: LegacyFS.EncodingType.Base64,
  });

  try {
    onProgress?.({ phase: 'share' });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await sharingShareAsyncSerialized(zipPath, {
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
        dialogTitle: 'Share selected documents',
      });
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
