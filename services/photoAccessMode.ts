import * as ImagePicker from 'expo-image-picker';
import type { MediaLibraryPermissionResponse } from 'expo-image-picker';

const ACCESS_MODE_CACHE_TTL_MS = 5000;
let accessModeCache: { mode: 'all' | 'limited' | 'none' | null; at: number } | null = null;

/**
 * iOS 14+ / Android 14+ photo access: full library vs selected photos only.
 * When `limited`, the OS shows an extra picker to choose which items to share — expected, but easy to confuse with a bug.
 *
 * Result is cached briefly to avoid repeated native permission queries on the same capture/import session.
 */
export async function getPhotoLibraryAccessMode(): Promise<'all' | 'limited' | 'none' | null> {
  const now = Date.now();
  if (accessModeCache && now - accessModeCache.at < ACCESS_MODE_CACHE_TTL_MS) {
    return accessModeCache.mode;
  }
  const r = await ImagePicker.getMediaLibraryPermissionsAsync();
  const p = (r as MediaLibraryPermissionResponse).accessPrivileges;
  const mode = p === 'all' || p === 'limited' || p === 'none' ? p : null;
  accessModeCache = { mode, at: now };
  return mode;
}

/** Call after the user returns from system Settings or revokes permission so the next read is fresh. */
export function invalidatePhotoLibraryAccessModeCache(): void {
  accessModeCache = null;
}
