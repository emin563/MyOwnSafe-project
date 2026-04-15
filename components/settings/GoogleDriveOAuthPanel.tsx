import {
  getGoogleAndroidPackageOAuthRedirectUri,
  getGoogleAndroidReverseClientRedirectUri,
  getGoogleDriveOAuthConfig,
} from '@/config/googleDrive';
import { getSetting, setSetting } from '@/db/settings';
import {
  clearGoogleDriveConnection,
  ensureGoogleDriveVaultFolderReady,
  isGoogleDriveConnected,
  notifyGoogleDriveAccountLinkChanged,
  persistGoogleDriveTokenFromAuth,
  uploadAllVaultDocumentsToGoogleDriveNow,
} from '@/services/GoogleDriveSync';
import { Ionicons } from '@expo/vector-icons';
import { TokenResponse } from 'expo-auth-session/build/TokenRequest';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/theme';
import { googleDriveBackupStyles as styles } from './googleDriveBackup.styles';
import { withExternalActivityGuard } from '@/store/auth-flags';

WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth UI for Google Drive; keep in a separate module so expo-auth-session (PKCE → expo-crypto)
 * is not loaded until this panel is mounted (lazy-loaded from GoogleDriveBackupSection).
 */
export default function GoogleDriveOAuthPanel() {
  const cfg = getGoogleDriveOAuthConfig();
  const androidRedirectUri =
    getGoogleAndroidReverseClientRedirectUri(cfg.androidClientId ?? '') ??
    getGoogleAndroidPackageOAuthRedirectUri();
  const [connected, setConnected] = useState(false);
  const [autoUpload, setAutoUpload] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ensureVaultBusy, setEnsureVaultBusy] = useState(false);
  const [backupNowBusy, setBackupNowBusy] = useState(false);
  const connectSessionRef = useRef(false);

  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      androidClientId: cfg.androidClientId,
      ...(cfg.webClientId ? { webClientId: cfg.webClientId } : {}),
      ...(androidRedirectUri ? { redirectUri: androidRedirectUri } : {}),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      extraParams: {
        access_type: 'offline',
      },
    },
    androidRedirectUri ? {} : { path: 'oauthredirect' }
  );

  const refreshState = useCallback(async () => {
    const c = await isGoogleDriveConnected();
    setConnected(c);
    const au = await getSetting('googleDriveAutoUpload');
    setAutoUpload(au !== '0');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshState();
    }, [refreshState])
  );

  useEffect(() => {
    if (response?.type === 'success' && response.authentication) {
      void (async () => {
        try {
          await persistGoogleDriveTokenFromAuth(response.authentication as TokenResponse);
          await setSetting('googleDriveAutoUpload', '1');
          setAutoUpload(true);
          setConnected(true);
        } catch {
          Alert.alert('Google Drive', 'Could not save your sign-in. Try again.');
        }
      })();
    } else if (response?.type === 'error') {
      if (response.params?.error === 'access_denied') {
        Alert.alert(
          'Google Drive',
          'Google blocked sign-in (access_denied). Play Console closed-beta testers only control who can install the app—not Google Sign-In. In Google Cloud Console (same project as your OAuth client): APIs & Services → OAuth consent screen → add each Google account under Test users while Publishing status is Testing, or move to In production. Drive API must stay enabled there. Workspace orgs may still block access by policy.'
        );
        return;
      }
      const err = response.error;
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Sign-in failed.';
      Alert.alert('Google Drive', msg);
    }
  }, [response]);

  const handleConnect = async () => {
    if (!request) {
      Alert.alert('Google Drive', 'OAuth is still loading. Try again in a moment.');
      return;
    }
    if (connectSessionRef.current) {
      return;
    }
    connectSessionRef.current = true;
    setBusy(true);
    try {
      await withExternalActivityGuard(() =>
        promptAsync(
          Platform.OS === 'android' ? { showInRecents: true, createTask: true } : undefined
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed.';
      Alert.alert('Google Drive', msg);
    } finally {
      setBusy(false);
      connectSessionRef.current = false;
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Google Drive?',
      'Automatic backup uploads will stop. Files already in your Drive stay there.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await clearGoogleDriveConnection();
              await setSetting('googleDriveAutoUpload', '0');
              setAutoUpload(false);
              setConnected(false);
            })();
          },
        },
      ]
    );
  };

  const onToggleAutoUpload = async (value: boolean) => {
    setAutoUpload(value);
    await setSetting('googleDriveAutoUpload', value ? '1' : '0');
    notifyGoogleDriveAccountLinkChanged();
  };

  const handleEnsureVaultFolder = async () => {
    setEnsureVaultBusy(true);
    try {
      await ensureGoogleDriveVaultFolderReady();
      notifyGoogleDriveAccountLinkChanged();
      Alert.alert(
        'Google Drive',
        'The Vault folder is ready in your Drive. New uploads will use this folder (when auto-upload is on, or the next time you save a document).'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create or find the Vault folder.';
      Alert.alert('Google Drive', msg);
    } finally {
      setEnsureVaultBusy(false);
    }
  };

  const handleBackupToDriveNow = async () => {
    if (!autoUpload) {
      Alert.alert(
        'Google Drive',
        'Turn on auto-upload first. Then you can back up existing vault files to the Vault folder in one tap.'
      );
      return;
    }
    setBackupNowBusy(true);
    try {
      const r = await uploadAllVaultDocumentsToGoogleDriveNow();
      const parts = [
        `Uploaded ${r.uploaded} of ${r.total} document file(s).`,
        r.skipped > 0 ? `${r.skipped} skipped (no file path).` : null,
        r.failed > 0 ? `${r.failed} failed.` : null,
      ].filter(Boolean);
      Alert.alert(
        'Google Drive',
        parts.join(' ') + (r.firstError && r.failed > 0 ? ` First error: ${r.firstError}` : '')
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not back up to Drive.';
      Alert.alert('Google Drive', msg);
    } finally {
      setBackupNowBusy(false);
    }
  };

  return (
    <View style={styles.block}>
      {!connected ? (
        <TouchableOpacity
          style={[styles.row, styles.rowBtn]}
          onPress={handleConnect}
          disabled={busy || !request}
          activeOpacity={0.7}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="logo-google" size={20} color={Colors.primary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Connect Google Drive</Text>
            <Text style={styles.rowHint}>
              With auto-upload on, new and updated documents copy into a &quot;Vault&quot; folder in the{' '}
              <Text style={{ fontWeight: '600' }}>Google Drive</Text> app (not Google Photos). Open Drive → browse
              folders → Vault.
            </Text>
          </View>
          {busy ? <ActivityIndicator color={Colors.primary} size="small" /> : null}
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="cloud-done-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Google Drive</Text>
              <Text style={styles.rowHint}>
                Connected. Auto-upload puts files in Drive&apos;s <Text style={{ fontWeight: '600' }}>Vault</Text>{' '}
                folder (not Photos).
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => {
              void handleEnsureVaultFolder();
            }}
            disabled={ensureVaultBusy}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="folder-open-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Create or restore Vault folder</Text>
              <Text style={styles.rowHint}>
                Creates the &quot;Vault&quot; folder in Drive if it is missing (for example, if you deleted it).
                You can use this without turning on auto-upload.
              </Text>
            </View>
            {ensureVaultBusy ? <ActivityIndicator color={Colors.primary} size="small" /> : null}
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => {
              void handleBackupToDriveNow();
            }}
            disabled={backupNowBusy}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="arrow-up-circle-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Back up to Drive now</Text>
              <Text style={styles.rowHint}>
                With auto-upload on, uploads every vault document file to the Vault folder now (for example after
                creating or restoring the folder). Re-running may add duplicate files in Drive.
              </Text>
            </View>
            {backupNowBusy ? <ActivityIndicator color={Colors.primary} size="small" /> : null}
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Auto-upload to Drive</Text>
              <Text style={styles.rowHint}>
                When enabled, each saved document is copied to Vault in the Drive app (Android). Full vault backups
                stay local (export as .zip from Data portability).
              </Text>
            </View>
            <Switch
              value={autoUpload}
              onValueChange={(v) => {
                void onToggleAutoUpload(v);
              }}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.border}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={[styles.row, styles.rowBtn]} onPress={handleDisconnect} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <Ionicons name="unlink-outline" size={20} color={Colors.danger} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Disconnect Google Drive</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
