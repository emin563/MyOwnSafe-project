import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '@/db/schema';
import { useAppStore } from '@/store/app-store';
import { Toast } from '@/components/ui';
import { InputModal } from '@/components/ui/InputModal';
import {
  configureNotifications,
  requestNotificationPermissions,
} from '@/services/NotificationService';
import { configureRevenueCat } from '@/services/PurchaseService';
export default function RootLayout() {
  const {
    setDbReady,
    loadCategories,
    loadDocuments,
    loadTags,
    loadSettings,
    vaultNamePromptVisible,
    setVaultName,
    dismissVaultNamePrompt,
    toast,
    clearToast,
  } = useAppStore();

  useEffect(() => {
    async function bootstrap() {
      await initDb();
      setDbReady(true);
      configureRevenueCat();
      await configureNotifications();
      await loadSettings();
      await loadCategories();
      await loadDocuments(null);
      await loadTags();
      await requestNotificationPermissions();
    }
    bootstrap();
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
