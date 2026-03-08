import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '@/db/schema';
import { useAppStore } from '@/store/app-store';
import { LockScreen } from '@/components/security/LockScreen';
import {
  configureNotifications,
  requestNotificationPermissions,
} from '@/services/NotificationService';

export default function RootLayout() {
  const {
    setDbReady,
    loadCategories,
    loadDocuments,
    loadSettings,
    isUnlocked,
    biometricEnabled,
    setUnlocked,
  } = useAppStore();

  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    async function bootstrap() {
      await initDb();
      setDbReady(true);
      await configureNotifications();
      await loadSettings();
      await loadCategories();
      await loadDocuments(null);
      // Request notification permissions only when the runtime supports them
      await requestNotificationPermissions();
    }
    bootstrap();

    // Lock the app whenever it enters the background
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appState.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        // Re-lock only when biometric guard is active
        if (useAppStore.getState().biometricEnabled) {
          setUnlocked(false);
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const showLock = biometricEnabled && !isUnlocked;

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
      </Stack>

      {showLock && (
        <View style={StyleSheet.absoluteFill}>
          <LockScreen onUnlock={() => setUnlocked(true)} />
        </View>
      )}
    </>
  );
}
