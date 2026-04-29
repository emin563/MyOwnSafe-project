import { PrivacyWelcomeModal } from '@/components/onboarding/PrivacyWelcomeModal';
import { Toast } from '@/components/ui';
import { InputModal } from '@/components/ui/InputModal';
import { initDb } from '@/db/schema';
import { configureNotifications } from '@/services/NotificationService';
import { configureRevenueCat } from '@/services/PurchaseService';
import { useAppStore } from '@/store/app-store';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

const FAST_STACK_MS = 280;
const horizontalStackOptions =
  Platform.OS === 'ios'
    ? { animation: 'simple_push' as const, animationDuration: FAST_STACK_MS }
    : { animation: 'default' as const };
const iosTransitionOnly =
  Platform.OS === 'ios' ? { animationDuration: FAST_STACK_MS } : {};

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
    settingsHydrated,
    privacyOnboardingCompleted,
    completePrivacyOnboarding,
  } = useAppStore(
    useShallow((s) => ({
      setDbReady: s.setDbReady,
      loadCategories: s.loadCategories,
      loadDocuments: s.loadDocuments,
      loadTags: s.loadTags,
      loadSettings: s.loadSettings,
      vaultNamePromptVisible: s.vaultNamePromptVisible,
      setVaultName: s.setVaultName,
      dismissVaultNamePrompt: s.dismissVaultNamePrompt,
      toast: s.toast,
      clearToast: s.clearToast,
      settingsHydrated: s.settingsHydrated,
      privacyOnboardingCompleted: s.privacyOnboardingCompleted,
      completePrivacyOnboarding: s.completePrivacyOnboarding,
    }))
  );

  useEffect(() => {
    async function bootstrap() {
      await initDb();
      setDbReady(true);
      configureRevenueCat();
      await configureNotifications();
      await loadSettings();
      await Promise.all([loadCategories(), loadDocuments(null), loadTags()]);
    }
    bootstrap();
  }, [loadCategories, loadDocuments, loadSettings, loadTags, setDbReady]);

  return (
    <>
      {/* Android 15 / edge-to-edge: backgroundColor & translucent are deprecated no-ops; use theme + safe area instead */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          ...horizontalStackOptions,
        }}
      >
        <Stack.Screen name="(drawer)" />
        <Stack.Screen
          name="document/[id]"
          options={{
            animation: 'slide_from_bottom',
            ...iosTransitionOnly,
          }}
        />
        <Stack.Screen
          name="document/import-review"
          options={{
            animation: 'slide_from_bottom',
            ...iosTransitionOnly,
          }}
        />
        <Stack.Screen
          name="capture"
          options={{
            animation: 'slide_from_bottom',
            ...iosTransitionOnly,
          }}
        />
        <Stack.Screen
          name="pdf-viewer"
          options={{
            animation: 'slide_from_bottom',
            ...iosTransitionOnly,
          }}
        />
        <Stack.Screen
          name="file-preview"
          options={{
            animation: 'slide_from_bottom',
            ...iosTransitionOnly,
          }}
        />
        <Stack.Screen
          name="oauth2redirect"
          options={{
            animation: 'fade',
            ...iosTransitionOnly,
          }}
        />
        <Stack.Screen
          name="oauthredirect"
          options={{
            animation: 'fade',
            ...iosTransitionOnly,
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

      <PrivacyWelcomeModal
        visible={settingsHydrated && !privacyOnboardingCompleted}
        onGetStarted={() => completePrivacyOnboarding()}
      />
    </>
  );
}
