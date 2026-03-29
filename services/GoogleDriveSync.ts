import { Platform } from 'react-native';
import { TokenResponse } from 'expo-auth-session/build/TokenRequest';
import { getGoogleDriveOAuthConfig, isGoogleDriveOAuthConfigured } from '@/config/googleDrive';
import type { FileType } from '@/db/types';
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
  emitGoogleDriveLinkStatusChanged();
}

export async function clearGoogleDriveConnection(): Promise<void> {
  await clearAllDriveStorageKeys();
  emitGoogleDriveLinkStatusChanged();
}

export async function isGoogleDriveConnected(): Promise<boolean> {
  const t = await loadStoredToken();
  return t != null && Boolean(t.accessToken);
}

/** Subscribers run when the user connects, disconnects, or tokens are cleared (e.g. sign-in / sign-out). */
const driveLinkStatusListeners = new Set<() => void>();

export function subscribeGoogleDriveLinkStatusChanged(onChange: () => void): () => void {
  driveLinkStatusListeners.add(onChange);
  return () => {
    driveLinkStatusListeners.delete(onChange);
  };
}

function emitGoogleDriveLinkStatusChanged(): void {
  for (const cb of driveLinkStatusListeners) {
    try {
      cb();
    } catch {
      /* ignore listener errors */
    }
  }
}

/** Call after local-only changes that affect {@link getGoogleDriveAccountLinkStatus} (e.g. auto-upload toggle). */
export function notifyGoogleDriveAccountLinkChanged(): void {
  emitGoogleDriveLinkStatusChanged();
}

export type GoogleDriveAccountLinkStatus = {
  /** `androidClientId` (etc.) present in app config */
  configured: boolean;
  /** OAuth finished and a stored access token exists */
  linked: boolean;
  /** Settings: copy new documents and backups to Drive */
  autoUploadEnabled: boolean;
};

/**
 * Async snapshot for UI or logic: whether Google Drive is configured and the user has linked an account.
 */
export async function getGoogleDriveAccountLinkStatus(): Promise<GoogleDriveAccountLinkStatus> {
  const configured = isGoogleDriveOAuthConfigured();
  if (Platform.OS !== 'android' || !configured) {
    return { configured, linked: false, autoUploadEnabled: false };
  }
  const linked = await isGoogleDriveConnected();
  const auto = await getSetting('googleDriveAutoUpload');
  return {
    configured: true,
    linked,
    autoUploadEnabled: auto !== '0',
  };
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

  let existing: string | undefined;
  if (listRes.ok) {
    const listJson = (await listRes.json()) as { files?: { id: string }[] };
    existing = listJson.files?.[0]?.id;
  } else if (listRes.status === 401) {
    const errText = await listRes.text().catch(() => '');
    throw new Error(`Drive folder list failed (${listRes.status}): ${errText.slice(0, 200)}`);
  }
  // drive.file scope often cannot list Drive root; skip list and create "Vault" below.

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

function extensionFromFileUri(fileUri: string): string {
  const seg = fileUri.split('/').pop() ?? '';
  const dot = seg.lastIndexOf('.');
  return dot >= 0 ? seg.slice(dot) : '';
}

function contentTypeForVaultFile(fileType: FileType, extLower: string): string {
  if (fileType === 'pdf' || extLower === '.pdf') return 'application/pdf';
  if (extLower === '.png') return 'image/png';
  if (extLower === '.webp') return 'image/webp';
  if (extLower === '.gif') return 'image/gif';
  if (fileType === 'image' || extLower === '.jpg' || extLower === '.jpeg') return 'image/jpeg';
  if (extLower === '.doc') return 'application/msword';
  if (extLower === '.docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (extLower === '.xls') return 'application/vnd.ms-excel';
  if (extLower === '.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return 'application/octet-stream';
}

function driveDocumentDisplayName(documentId: number, title: string, extWithDot: string): string {
  const safe =
    title
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'document';
  return `Vault_${documentId}_${safe}${extWithDot}`;
}

/** Strip file URI to a filesystem path for react-native-blob-util (handles file:/// and encoding). */
function toNativeReadablePath(fileUri: string): string {
  let u = fileUri.trim();
  if (u.startsWith('file://')) {
    u = u.slice('file://'.length);
  } else if (u.startsWith('file:')) {
    u = u.slice('file:'.length);
  }
  if (u.startsWith('//')) {
    u = u.slice(1);
  }
  try {
    return decodeURIComponent(u);
  } catch {
    return u;
  }
}

/**
 * Uploads a local file into the Drive "Vault" folder using a resumable session with parents set.
 * Avoids POST-to-root + PATCH move, which often fails with https://www.googleapis.com/auth/drive.file only.
 */
async function uploadLocalFileToVaultFolder(
  fileUri: string,
  displayFileName: string,
  contentType: string
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
  const nativePath = toNativeReadablePath(fileUri);

  let size: number;
  try {
    const st = await RNBlob.fs.stat(nativePath);
    size = typeof st.size === 'number' ? st.size : parseInt(String(st.size), 10);
  } catch {
    throw new Error('Could not read the local file for Google Drive upload.');
  }
  if (!Number.isFinite(size) || size < 0) {
    throw new Error('Invalid file size for Google Drive upload.');
  }

  const initRes = await fetch(`${DRIVE_UPLOAD}?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify({ name: displayFileName, parents: [folderId] }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`Drive upload session failed (${initRes.status}): ${errText.slice(0, 200)}`);
  }

  const sessionUrl = initRes.headers.get('Location') ?? initRes.headers.get('location');
  if (!sessionUrl) {
    throw new Error('Drive upload session returned no Location header.');
  }

  const uploadResp = await RNBlob.fetch(
    'PUT',
    sessionUrl,
    {
      Authorization: `Bearer ${accessToken}`,
      'Content-Length': String(size),
    },
    RNBlob.wrap(nativePath)
  );

  const status = uploadResp.info().status;
  if (status < 200 || status >= 300) {
    const t = await uploadResp.text();
    throw new Error(`Drive upload PUT failed (${status}): ${t.slice(0, 200)}`);
  }
}

/**
 * Uploads the local backup zip to the user's Google Drive (Vault folder). Best-effort; throws on hard failures.
 */
export async function uploadVaultBackupZipToGoogleDrive(
  zipFileUri: string,
  displayFileName: string
): Promise<void> {
  await uploadLocalFileToVaultFolder(zipFileUri, displayFileName, 'application/zip');
}

/**
 * When auto-upload is on and Drive is connected, copies a saved vault document file to the Drive "Vault" folder.
 * Errors are swallowed so capture/save is never blocked.
 */
export async function maybeUploadVaultDocumentToGoogleDrive(
  fileUri: string,
  fileType: FileType,
  title: string,
  documentId: number
): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!isGoogleDriveOAuthConfigured()) return;

  const pro = await getSetting('isPro');
  if (pro !== 'true') return;

  const auto = await getSetting('googleDriveAutoUpload');
  if (auto === '0') return;

  const connected = await isGoogleDriveConnected();
  if (!connected) return;

  try {
    const ext = extensionFromFileUri(fileUri);
    const extForName =
      ext || (fileType === 'pdf' ? '.pdf' : fileType === 'image' ? '.jpg' : '.bin');
    const extLower = extForName.toLowerCase();
    const displayName = driveDocumentDisplayName(documentId, title, extForName);
    const contentType = contentTypeForVaultFile(fileType, extLower);
    await uploadLocalFileToVaultFolder(fileUri, displayName, contentType);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (__DEV__) {
      console.warn('[Drive document upload]', message);
    }
    try {
      const { useAppStore } = await import('@/store/app-store');
      const short =
        message.length > 140 ? `${message.slice(0, 137)}…` : message;
      useAppStore.getState().showToast(`Drive upload: ${short}`, 'info');
    } catch {
      /* avoid import cycles / store not ready */
    }
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

  const pro = await getSetting('isPro');
  if (pro !== 'true') return;

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
