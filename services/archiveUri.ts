import * as LegacyFS from 'expo-file-system/legacy';

function normalizeUri(uri: string): string {
  return uri.replace(/\\/g, '/');
}

function directoryPrefix(raw: string | null): string {
  if (!raw) return '';
  const n = normalizeUri(raw);
  return n.endsWith('/') ? n : `${n}/`;
}

/** Prefix for the vault archive directory (`…/document/archive/`). */
export function getArchiveDirectoryPrefix(): string {
  return `${directoryPrefix(LegacyFS.documentDirectory)}archive/`;
}

/**
 * Vault files committed under `archive/` (matches preview / StorageService invariants).
 */
export function isAllowedArchiveFileUri(uri: string): boolean {
  if (!uri) return false;
  const normalized = normalizeUri(uri);
  const archivePrefix = getArchiveDirectoryPrefix();
  if (!archivePrefix || archivePrefix === 'archive/') return false;
  if (!normalized.startsWith(archivePrefix)) return false;
  return !normalized.slice(archivePrefix.length).includes('..');
}

/**
 * Local file under the app document or cache directory (temp imports, Print PDF, backup zips).
 */
export function isUriUnderAppSandboxDirectories(uri: string): boolean {
  if (!uri) return false;
  const n = normalizeUri(uri);
  const doc = directoryPrefix(LegacyFS.documentDirectory);
  const cache = directoryPrefix(LegacyFS.cacheDirectory);
  if (doc && n.startsWith(doc) && !n.slice(doc.length).includes('..')) return true;
  if (cache && n.startsWith(cache) && !n.slice(cache.length).includes('..')) return true;
  return false;
}

/**
 * Sources passed to `expo-sharing`: OS `content://` URIs from pickers, or sandbox `file://` paths.
 */
export function isAllowedShareSourceUri(uri: string): boolean {
  if (!uri) return false;
  const t = uri.trim();
  if (t.startsWith('content://')) return true;
  return isUriUnderAppSandboxDirectories(t);
}
