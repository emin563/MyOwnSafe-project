import { Platform, Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { FileType } from '@/db/types';
import { withExternalActivityGuard } from '@/store/auth-flags';

/**
 * Converts a file:// URI to a filesystem path for native modules (no scheme).
 */
export function fileUriToNativePath(uri: string): string {
  if (!uri) return '';
  try {
    if (uri.startsWith('file://')) {
      return decodeURI(uri.replace(/^file:\/\//, ''));
    }
  } catch {
    // ignore decode errors
  }
  return uri;
}

export function mimeTypeForFileType(fileType: FileType): string {
  switch (fileType) {
    case 'pdf':
      return 'application/pdf';
    case 'image':
      return 'image/*';
    case 'word':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'document':
    default:
      return 'application/octet-stream';
  }
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * Last resort: share-style sheet (Expo Go iOS, or when VIEW fails).
 */
async function openWithSharingFallback(uri: string, mime: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await withExternalActivityGuard(() =>
      Sharing.shareAsync(uri, {
        dialogTitle: 'Choose app',
        mimeType: mime,
      })
    );
    return;
  }
  await withExternalActivityGuard(() => Linking.openURL(uri));
}

/**
 * Expo Go on Android: use system ACTION_VIEW (viewer / “open with” resolver), not ACTION_SEND (Share).
 * expo-intent-launcher is included in Expo Go; react-native-blob-util is not.
 */
async function openExpoGoAndroidView(uri: string, mime: string): Promise<void> {
  const IntentLauncher = await import('expo-intent-launcher');
  /** @see https://developer.android.com/reference/android/content/Intent#FLAG_GRANT_READ_URI_PERMISSION */
  const FLAG_GRANT_READ_URI_PERMISSION = 1;
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: uri,
    type: mime,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}

/**
 * System “open with” / viewer handoff.
 * - **Dev / prod builds:** `react-native-blob-util` (chooser title on Android, Open in menu on iOS).
 * - **Expo Go Android:** `expo-intent-launcher` ACTION_VIEW (native resolver, not Share).
 * - **Expo Go iOS:** sharing fallback (no custom native modules for document handoff).
 */
export async function openFileWithOtherApps(uri: string, fileType: FileType): Promise<void> {
  const mime = mimeTypeForFileType(fileType);
  const path = fileUriToNativePath(uri);
  if (!path) {
    throw new Error('Invalid file path');
  }

  if (Platform.OS === 'web') {
    await Linking.openURL(uri);
    return;
  }

  if (isExpoGo() && Platform.OS === 'android') {
    try {
      await openExpoGoAndroidView(uri, mime);
    } catch {
      await openWithSharingFallback(uri, mime);
    }
    return;
  }

  if (isExpoGo() && Platform.OS === 'ios') {
    await openWithSharingFallback(uri, mime);
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactNativeBlobUtil = require('react-native-blob-util').default as typeof import('react-native-blob-util').default;
    if (Platform.OS === 'android') {
      await ReactNativeBlobUtil.android.actionViewIntent(path, mime, 'Choose app');
      return;
    }
    if (Platform.OS === 'ios') {
      await ReactNativeBlobUtil.ios.presentOpenInMenu(path);
      return;
    }
  } catch {
    await openWithSharingFallback(uri, mime);
  }
}
