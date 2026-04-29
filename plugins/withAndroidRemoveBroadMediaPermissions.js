const { AndroidConfig } = require('expo/config-plugins');

/**
 * Strips permissions merged by dependencies that the app does not need at runtime:
 *
 * - READ_MEDIA_IMAGES / READ_MEDIA_VIDEO — Google Play Photo and Video Permissions policy;
 *   the app uses the system Photo Picker on Android 13+ instead.
 * - READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE — legacy pre-API-33 permissions pulled in
 *   by react-native-blob-util and similar libs; no-ops on modern Android.
 * - SYSTEM_ALERT_WINDOW — injected by the Expo dev client; not needed in production.
 *
 * Uses `withBlockedPermissions` so any existing `uses-permission` nodes are removed from the
 * **mod manifest** before a single `tools:node="remove"` entry is added (avoids duplicate bare
 * + remove lines that leave the permission effective in the merged APK/AAB).
 *
 * @see https://support.google.com/googleplay/android-developer/answer/15800983
 */
const PERMISSIONS_TO_REMOVE = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

function withAndroidRemoveBroadMediaPermissions(config) {
  return AndroidConfig.Permissions.withBlockedPermissions(config, PERMISSIONS_TO_REMOVE);
}

module.exports = withAndroidRemoveBroadMediaPermissions;
