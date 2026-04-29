import { PermissionsAndroid, Platform } from 'react-native';

function apiLevel(): number {
  if (Platform.OS !== 'android') return 0;
  return typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
}

/**
 * Android 13+ (API 33+): gallery import uses the system Photo Picker; we do not use
 * READ_MEDIA_IMAGES / READ_MEDIA_VIDEO (Google Play policy).
 */
export function androidGalleryUsesSystemPhotoPicker(): boolean {
  return Platform.OS === 'android' && apiLevel() >= 33;
}

/**
 * For Settings UI: broad read permission is not used on API 33+ — import is available via the
 * system picker when the user taps Import.
 */
export async function getAndroidReadPhotosStatusForUi(): Promise<'granted' | 'denied'> {
  if (Platform.OS !== 'android') {
    return 'denied';
  }
  if (androidGalleryUsesSystemPhotoPicker()) {
    return 'granted';
  }
  const ok = await PermissionsAndroid.check(
    'android.permission.READ_EXTERNAL_STORAGE' as Parameters<typeof PermissionsAndroid.check>[0]
  );
  return ok ? 'granted' : 'denied';
}

/**
 * On API 32 and below, request legacy storage read for gallery-like import where needed.
 * On API 33+, no-op (returns true): Photo Picker does not require READ_MEDIA_*.
 */
export async function requestAndroidReadPhotosPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  if (androidGalleryUsesSystemPhotoPicker()) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    'android.permission.READ_EXTERNAL_STORAGE' as Parameters<typeof PermissionsAndroid.request>[0]
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
