import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '@/db/schema';
import { useAppStore } from '@/store/app-store';
import { authFlags, MIN_MINIMIZED_MS_FOR_VAULT_LOCK } from '@/store/auth-flags';
import { shouldArmVaultMinimizeTimer } from '@/services/vaultLockPolicy';
import { LockScreen } from '@/components/security/LockScreen';
import { Toast } from '@/components/ui';
import { InputModal } from '@/components/ui/InputModal';
import {
  configureNotifications,
  requestNotificationPermissions,
} from '@/services/NotificationService';
export default function RootLayout() {
  const {
    setDbReady,
    loadCategories,
    loadDocuments,
    loadTags,
    loadSettings,
    isUnlocked,
    pinEnabled,
    setUnlocked,
    vaultNamePromptVisible,
    setVaultName,
    dismissVaultNamePrompt,
    toast,
    clearToast,
  } = useAppStore();

  const appState = useRef<AppStateStatus>(AppState.currentState);
  /** Set when the app actually minimizes (background); cleared on resume. */
  const vaultMinimizedAt = useRef<number | null>(null);
  // Prevents the AppState listener from firing during the initial bootstrap
  // sequence before settings have loaded and the lock state is known.
  const isAppReady = useRef(false);

  const showLock = pinEnabled && !isUnlocked;

  useEffect(() => {
    async function bootstrap() {
      await initDb();
      setDbReady(true);
      await configureNotifications();
      await loadSettings();
      // Lock flags come from settings; allow AppState handling while the rest
      // of bootstrap (documents, tags, notifications) continues — otherwise
      // the listener ignores background during early bootstrap.
      isAppReady.current = true;
      await loadCategories();
      await loadDocuments(null);
      await loadTags();
      await requestNotificationPermissions();
    }
    bootstrap();

    /**
     * Vault lock: only after the user minimizes the app (background) and opens it again.
     * Ignores pickers and very short background blips.
     */
    function applyVaultLockOnMinimizeResume(nextState: AppStateStatus) {
      const prev = appState.current;

      if (!isAppReady.current) {
        appState.current = nextState;
        return;
      }

      const minimized =
        nextState === 'background' &&
        (prev === 'active' || prev === 'inactive');
      const resumedFromMinimize =
        nextState === 'active' &&
        (prev === 'background' || prev === 'inactive');

      if (resumedFromMinimize) {
        authFlags.systemPickerOpen = false;
        const started = vaultMinimizedAt.current;
        vaultMinimizedAt.current = null;
        if (started != null) {
          const awayMs = Date.now() - started;
          const { pinEnabled } = useAppStore.getState();
          if (pinEnabled && awayMs >= MIN_MINIMIZED_MS_FOR_VAULT_LOCK) {
            setUnlocked(false);
          }
        }
      }

      if (minimized) {
        if (!shouldArmVaultMinimizeTimer()) {
          appState.current = nextState;
          return;
        }
        const { pinEnabled } = useAppStore.getState();
        if (pinEnabled) {
          vaultMinimizedAt.current = Date.now();
        }
      }

      appState.current = nextState;
    }

    const subscription = AppState.addEventListener('change', applyVaultLockOnMinimizeResume);

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen
          name="document/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="document/import-review"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="capture"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="oauth2redirect"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="oauthredirect"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="pdf-viewer"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="file-preview"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="privacy-offline"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ocr-extraction-info"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="multi-page-info"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="app-locking-info"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
      </Stack>

      {showLock && (
        <View style={StyleSheet.absoluteFill}>
          <LockScreen onUnlock={() => setUnlocked(true)} />
        </View>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={clearToast}
        />
      )}

      <InputModal
        visible={vaultNamePromptVisible}
        title="Name your vault (optional)"
        placeholder="e.g. My Vault"
        confirmLabel="Save"
        onConfirm={async (value) => {
          await setVaultName(value);
        }}
        onCancel={() => {
          void dismissVaultNamePrompt();
        }}
      />
    </>
  );
}
