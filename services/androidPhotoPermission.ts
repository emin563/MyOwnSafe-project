import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Android Settings "Photos and videos" / legacy storage align with {@link PermissionsAndroid},
 * not always with {@link ImagePicker.getMediaLibraryPermissionsAsync} (Photo Picker can report differently).
 */
export async function getAndroidReadPhotosStatusForUi(): Promise<'granted' | 'denied'> {
  if (Platform.OS !== 'android') {
    return 'denied';
  }
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (api >= 33) {
    const ok = await PermissionsAndroid.check(
      'android.permission.READ_MEDIA_IMAGES' as Parameters<typeof PermissionsAndroid.check>[0]
    );
    return ok ? 'granted' : 'denied';
  }
  const ok = await PermissionsAndroid.check(
    'android.permission.READ_EXTERNAL_STORAGE' as Parameters<typeof PermissionsAndroid.check>[0]
  );
  return ok ? 'granted' : 'denied';
}

/**
 * Requests the same permission Android Settings lists for photos (API 33+ READ_MEDIA_IMAGES).
 */
export async function requestAndroidReadPhotosPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (api >= 33) {
    const result = await PermissionsAndroid.request(
      'android.permission.READ_MEDIA_IMAGES' as Parameters<typeof PermissionsAndroid.request>[0]
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const result = await PermissionsAndroid.request(
    'android.permission.READ_EXTERNAL_STORAGE' as Parameters<typeof PermissionsAndroid.request>[0]
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
