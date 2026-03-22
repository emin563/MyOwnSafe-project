import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '@/db/schema';
import { useAppStore } from '@/store/app-store';
import { authFlags } from '@/store/auth-flags';
import { LockScreen } from '@/components/security/LockScreen';
import { Toast } from '@/components/ui';
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
    biometricEnabled,
    setUnlocked,
    toast,
    clearToast,
  } = useAppStore();

  const appState = useRef<AppStateStatus>(AppState.currentState);
  // Prevents the AppState listener from firing during the initial bootstrap
  // sequence before settings have loaded and the lock state is known.
  const isAppReady = useRef(false);

  useEffect(() => {
    async function bootstrap() {
      await initDb();
      setDbReady(true);
      await configureNotifications();
      await loadSettings();
      await loadCategories();
      await loadDocuments(null);
      await loadTags();
      await requestNotificationPermissions();
      // Open the gate only AFTER settings are loaded so biometricEnabled /
      // pinEnabled are correct before the listener can act on them.
      isAppReady.current = true;
    }
    bootstrap();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (!isAppReady.current) {
        appState.current = nextState;
        return;
      }

      if (authFlags.isInCooldown()) {
        appState.current = nextState;
        return;
      }

      // When returning to active, clear "picker open" so next background transition can lock.
      if (nextState === 'active') {
        authFlags.systemPickerOpen = false;
      }

      // Only lock when the app goes to background (user left the app).
      // Do not lock if a system picker we opened caused the background (e.g. document/image picker on Android).
      if (appState.current === 'active' && nextState === 'background') {
        if (authFlags.systemPickerOpen) {
          appState.current = nextState;
          return;
        }
        const { pinEnabled: pin, biometricEnabled: bio } = useAppStore.getState();
        if (pin || bio) {
          setUnlocked(false);
        }
      }
      appState.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const showLock = (pinEnabled || biometricEnabled) && !isUnlocked;

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
          name="pdf-viewer"
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
    </>
  );
}
