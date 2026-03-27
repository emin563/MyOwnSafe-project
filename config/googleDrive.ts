import Constants from 'expo-constants';

export type GoogleDriveOAuthExtra = {
  androidClientId?: string;
  webClientId?: string;
};

/**
 * Set in app.json → expo.extra.googleDriveOAuth (see app.json comments).
 * Both IDs are required for Google OAuth on Android with expo-auth-session.
 */
export function getGoogleDriveOAuthConfig(): GoogleDriveOAuthExtra {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const raw = extra?.googleDriveOAuth as GoogleDriveOAuthExtra | undefined;
  return {
    androidClientId: typeof raw?.androidClientId === 'string' ? raw.androidClientId.trim() : '',
    webClientId: typeof raw?.webClientId === 'string' ? raw.webClientId.trim() : '',
  };
}

export function isGoogleDriveOAuthConfigured(): boolean {
  const { androidClientId, webClientId } = getGoogleDriveOAuthConfig();
  return Boolean(androidClientId && webClientId);
}
