import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import type { MediaLibraryPermissionResponse } from 'expo-image-picker';
import { Alert, InteractionManager, Platform } from 'react-native';
import {
  androidGalleryUsesSystemPhotoPicker,
  getAndroidReadPhotosStatusForUi,
  requestAndroidReadPhotosPermission,
} from '@/services/androidPhotoPermission';

/** Shown when camera access is denied or still needed for scanning. */
export const CAMERA_REQUIRED_MESSAGE =
  'Please enable camera permission; document scanning is not possible without this permission.';

/** Shown when photo/file library access is denied or still needed for import & save flows. */
export const FILE_REQUIRED_MESSAGE =
  'Please enable file permission; files cannot be uploaded or downloaded without this permission.';

export async function requestCameraPermissionWithNotice(): Promise<boolean> {
  const result = await Camera.requestCameraPermissionsAsync();
  if (!result.granted) {
    Alert.alert('Permission needed', CAMERA_REQUIRED_MESSAGE);
    return false;
  }
  return true;
}

export async function requestMediaLibraryPermissionWithNotice(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const ok = await requestAndroidReadPhotosPermission();
    if (!ok) {
      Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
      return false;
    }
    return true;
  }
  const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!result.granted) {
    Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
    return false;
  }
  return true;
}

/**
 * Requests camera then media library (photos/files). Stops at first denial and shows the matching notice.
 * On Android, a short delay between dialogs helps the second system prompt appear reliably.
 */
export async function requestRequiredVaultPermissionsWithNotices(): Promise<boolean> {
  const cam = await Camera.requestCameraPermissionsAsync();
  if (!cam.granted) {
    Alert.alert('Permission needed', CAMERA_REQUIRED_MESSAGE);
    return false;
  }
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  if (Platform.OS === 'android') {
    await new Promise((r) => setTimeout(r, 350));
    const ok = await requestAndroidReadPhotosPermission();
    if (!ok) {
      Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
      return false;
    }
    return true;
  }
  const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!media.granted) {
    Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
    return false;
  }
  return true;
}

/**
 * Ensures the app can import from the gallery before opening the picker.
 * Android 13+: system Photo Picker — no READ_MEDIA_*; opens directly.
 * Android 12 and below: may request READ_EXTERNAL_STORAGE once for legacy file access.
 */
export async function ensureMediaLibraryForImport(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (androidGalleryUsesSystemPhotoPicker()) {
      return true;
    }
    const status = await getAndroidReadPhotosStatusForUi();
    if (status === 'granted') return true;
    const ok = await requestAndroidReadPhotosPermission();
    if (!ok) {
      Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
      return false;
    }
    return true;
  }
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (existing.granted) {
    const privileges = (existing as MediaLibraryPermissionResponse).accessPrivileges;
    if (privileges === 'none') {
      Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
      return false;
    }
    return true;
  }
  if (existing.status === 'denied' && existing.canAskAgain === false) {
    Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
    return false;
  }
  const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!result.granted) {
    Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
    return false;
  }
  const afterPrivileges = (result as MediaLibraryPermissionResponse).accessPrivileges;
  if (afterPrivileges === 'none') {
    Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
    return false;
  }
  return true;
}
