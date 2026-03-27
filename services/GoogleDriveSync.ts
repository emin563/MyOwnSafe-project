import { Platform } from 'react-native';
import { TokenResponse } from 'expo-auth-session/build/TokenRequest';
import { getGoogleDriveOAuthConfig, isGoogleDriveOAuthConfigured } from '@/config/googleDrive';
import { deleteSetting, getSetting, setSetting } from '@/db/settings';

const SECURE_TOKEN_KEY = 'vault_google_drive_token_v1';
const SECURE_FOLDER_KEY = 'vault_google_drive_vault_folder_id_v1';
/** SQLite fallback keys when expo-secure-store native module is unavailable (e.g. Expo Go). */
const SQLITE_TOKEN_KEY = 'googleDriveTokenV1';
const SQLITE_FOLDER_KEY = 'googleDriveFolderIdV1';

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/** Minimal discovery for token refresh only (avoids importing expo-auth-session index → PKCE → expo-crypto at load). */
const GOOGLE_TOKEN_DISCOVERY = {
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
} as const;

type ExpoSecureStoreModule = typeof import('expo-secure-store');
let secureStoreModule: ExpoSecureStoreModule | null | undefined;

function resolveExpoSecureStore(): ExpoSecureStoreModule | null {
  if (secureStoreModule !== undefined) return secureStoreModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStoreModule = require('expo-secure-store') as ExpoSecureStoreModule;
  } catch {
    secureStoreModule = null;
  }
  return secureStoreModule;
}

async function vaultStorageGet(which: 'token' | 'folder'): Promise<string | null> {
  const ss = resolveExpoSecureStore();
  if (ss) {
    const k = which === 'token' ? SECURE_TOKEN_KEY : SECURE_FOLDER_KEY;
    return ss.getItemAsync(k);
  }
  const k = which === 'token' ? SQLITE_TOKEN_KEY : SQLITE_FOLDER_KEY;
  return getSetting(k);
}

async function vaultStorageSet(which: 'token' | 'folder', value: string): Promise<void> {
  const ss = resolveExpoSecureStore();
  if (ss) {
    const k = which === 'token' ? SECURE_TOKEN_KEY : SECURE_FOLDER_KEY;
    await ss.setItemAsync(k, value);
    return;
  }
  const k = which === 'token' ? SQLITE_TOKEN_KEY : SQLITE_FOLDER_KEY;
  await setSetting(k, value);
}

async function vaultStorageDelete(which: 'token' | 'folder'): Promise<void> {
  const ss = resolveExpoSecureStore();
  if (ss) {
    const k = which === 'token' ? SECURE_TOKEN_KEY : SECURE_FOLDER_KEY;
    await ss.deleteItemAsync(k);
    return;
  }
  const k = which === 'token' ? SQLITE_TOKEN_KEY : SQLITE_FOLDER_KEY;
  await deleteSetting(k);
}

async function clearAllDriveStorageKeys(): Promise<void> {
  const ss = resolveExpoSecureStore();
  if (ss) {
    try {
      await ss.deleteItemAsync(SECURE_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    try {
      await ss.deleteItemAsync(SECURE_FOLDER_KEY);
    } catch {
      /* ignore */
    }
  }
  await deleteSetting(SQLITE_TOKEN_KEY);
  await deleteSetting(SQLITE_FOLDER_KEY);
}

function getReactNativeBlobUtil(): typeof import('react-native-blob-util').default | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-blob-util').default;
  } catch {
    return null;
  }
}

function parseTokenResponse(raw: string): TokenResponse | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.accessToken !== 'string' || !data.accessToken) return null;
    return new TokenResponse(
      {
        accessToken: data.accessToken as string,
        refreshToken: typeof data.refreshToken === 'string' ? data.refreshToken : undefined,
        expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : undefined,
        issuedAt: typeof data.issuedAt === 'number' ? data.issuedAt : undefined,
        tokenType: 'bearer',
        scope: typeof data.scope === 'string' ? data.scope : undefined,
      },
      undefined
    );
  } catch {
    return null;
  }
}

async function loadStoredToken(): Promise<TokenResponse | null> {
  const raw = await vaultStorageGet('token');
  if (!raw) return null;
  return parseTokenResponse(raw);
}

async function saveToken(token: TokenResponse): Promise<void> {
  await vaultStorageSet('token', JSON.stringify(token.getRequestConfig()));
}

export async function persistGoogleDriveTokenFromAuth(authentication: TokenResponse): Promise<void> {
  await saveToken(authentication);
}

export async function clearGoogleDriveConnection(): Promise<void> {
  await clearAllDriveStorageKeys();
}

export async function isGoogleDriveConnected(): Promise<boolean> {
  const t = await loadStoredToken();
  return t != null && Boolean(t.accessToken);
}

async function getOrLoadFolderId(accessToken: string): Promise<string> {
  const cached = await vaultStorageGet('folder');
  if (cached) return cached;

  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.folder' and name='Vault' and trashed=false and 'root' in parents"
  );
  const listUrl = `${DRIVE_FILES}?q=${q}&fields=files(id)&pageSize=10`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    const errText = await listRes.text().catch(() => '');
    throw new Error(`Drive folder list failed (${listRes.status}): ${errText.slice(0, 200)}`);
  }
  const listJson = (await listRes.json()) as { files?: { id: string }[] };
  const existing = listJson.files?.[0]?.id;
  if (existing) {
    await vaultStorageSet('folder', existing);
    return existing;
  }

  const createRes = await fetch(DRIVE_FILES, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Vault',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`Drive folder create failed (${createRes.status}): ${errText.slice(0, 200)}`);
  }
  const created = (await createRes.json()) as { id?: string };
  if (!created.id) throw new Error('Drive folder create returned no id.');
  await vaultStorageSet('folder', created.id);
  return created.id;
}

async function getFreshAccessToken(): Promise<string | null> {
  if (!isGoogleDriveOAuthConfigured() || Platform.OS !== 'android') return null;

  let token = await loadStoredToken();
  if (!token?.accessToken) return null;

  const { androidClientId } = getGoogleDriveOAuthConfig();
  if (!androidClientId) return null;

  if (!TokenResponse.isTokenFresh(token) && token.refreshToken) {
    try {
      await token.refreshAsync({ clientId: androidClientId }, GOOGLE_TOKEN_DISCOVERY);
      await saveToken(token);
    } catch {
      return null;
    }
  }

  if (!TokenResponse.isTokenFresh(token)) {
    return null;
  }

  return token.accessToken;
}

/**
 * Uploads the local backup zip to the user's Google Drive (Vault folder). Best-effort; throws on hard failures.
 */
export async function uploadVaultBackupZipToGoogleDrive(
  zipFileUri: string,
  displayFileName: string
): Promise<void> {
  const accessToken = await getFreshAccessToken();
  if (!accessToken) {
    throw new Error('Google Drive is not connected or the session expired. Connect again in Settings.');
  }

  const RNBlob = getReactNativeBlobUtil();
  if (!RNBlob) {
    throw new Error('Drive upload requires a dev build (native file upload module missing).');
  }

  const folderId = await getOrLoadFolderId(accessToken);
  const path = zipFileUri.replace(/^file:\/\//, '');

  const uploadUrl = `${DRIVE_UPLOAD}?uploadType=media`;
  const uploadResp = await RNBlob.fetch(
    'POST',
    uploadUrl,
    {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/zip',
    },
    RNBlob.wrap(path)
  );

  const status = uploadResp.info().status;
  if (status < 200 || status >= 300) {
    const t = await uploadResp.text();
    throw new Error(`Drive upload failed (${status}): ${t.slice(0, 200)}`);
  }

  let fileId: string;
  try {
    const json = uploadResp.json() as { id?: string };
    fileId = json?.id ?? '';
  } catch {
    throw new Error('Drive upload returned invalid JSON.');
  }
  if (!fileId) throw new Error('Drive upload returned no file id.');

  const patchUrl = `${DRIVE_FILES}/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(folderId)}&removeParents=root`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: displayFileName }),
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text().catch(() => '');
    throw new Error(`Drive file finalize failed (${patchRes.status}): ${errText.slice(0, 200)}`);
  }
}

/**
 * If the user enabled auto-upload and Drive is connected, uploads silently. Swallows errors (backup/share still proceeds).
 */
export async function maybeUploadVaultBackupToGoogleDrive(
  zipFileUri: string,
  displayFileName: string
): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!isGoogleDriveOAuthConfigured()) return;

  const auto = await getSetting('googleDriveAutoUpload');
  if (auto === '0') return;

  const connected = await isGoogleDriveConnected();
  if (!connected) return;

  try {
    await uploadVaultBackupZipToGoogleDrive(zipFileUri, displayFileName);
  } catch {
    // Intentionally silent: do not block share sheet or alarm the user for optional cloud copy.
  }
}
