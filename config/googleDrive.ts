import Constants from 'expo-constants';

export type GoogleDriveOAuthExtra = {
  androidClientId?: string;
  webClientId?: string;
};

const ANDROID_CLIENT_SUFFIX = '.apps.googleusercontent.com';

/**
 * Google OAuth for Android native clients requires this exact redirect pattern (not the app package name).
 * @see https://developers.google.com/identity/protocols/oauth2/native-app
 */
export function getGoogleAndroidOAuthRedirectUri(androidClientId: string): string | null {
  const id = androidClientId?.trim() ?? '';
  if (!id.endsWith(ANDROID_CLIENT_SUFFIX)) return null;
  const idPart = id.slice(0, -ANDROID_CLIENT_SUFFIX.length);
  if (!idPart) return null;
  return `com.googleusercontent.apps.${idPart}:/oauth2redirect`;
}

/**
 * Set in app.json → expo.extra.googleDriveOAuth (see app.json comments).
 * On Android, `expo-auth-session` Google provider uses `androidClientId` (PKCE); token refresh uses the same ID.
 * `webClientId` is optional for this app’s Drive flow but can be set to a Web client if you add iOS/web later.
 */
export function getGoogleDriveOAuthConfig(): GoogleDriveOAuthExtra {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const raw = extra?.googleDriveOAuth as GoogleDriveOAuthExtra | undefined;
  return {
    androidClientId: typeof raw?.androidClientId === 'string' ? raw.androidClientId.trim() : '',
    webClientId: typeof raw?.webClientId === 'string' ? raw.webClientId.trim() : '',
  };
}

/** True when Drive OAuth can run (Android native client ID present). Drive backup is Android-only in this app. */
export function isGoogleDriveOAuthConfigured(): boolean {
  const { androidClientId } = getGoogleDriveOAuthConfig();
  return Boolean(androidClientId);
}
