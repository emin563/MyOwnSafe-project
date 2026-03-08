import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/theme';

type Props = {
  onUnlock: () => void;
};

export function LockScreen({ onUnlock }: Props) {
  const [authenticating, setAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Attempt authentication as soon as the lock screen appears
    triggerAuth();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        // App resumed — try to authenticate again
        triggerAuth();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const triggerAuth = async () => {
    if (authenticating) return;
    setErrorMessage(null);
    setAuthenticating(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Device has no biometric capability — unlock immediately
        onUnlock();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Vault',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onUnlock();
      } else {
        setErrorMessage('Authentication failed. Please try again.');
      }
    } catch {
      setErrorMessage('Biometric authentication is unavailable.');
    } finally {
      setAuthenticating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="shield-checkmark" size={56} color={Colors.primary} />
      </View>

      <Text style={styles.title}>Vault is Locked</Text>
      <Text style={styles.subtitle}>
        Authenticate to access your secure documents.
      </Text>

      {errorMessage && (
        <View style={styles.errorBadge}>
          <Ionicons name="warning-outline" size={14} color={Colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.unlockBtn, authenticating && styles.unlockBtnDisabled]}
        onPress={triggerAuth}
        disabled={authenticating}
        activeOpacity={0.8}
      >
        {authenticating ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <>
            <Ionicons name="finger-print-outline" size={20} color={Colors.white} />
            <Text style={styles.unlockBtnText}>Unlock with Biometrics</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.base,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 163, 127, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.fontSizeXl,
    fontWeight: Typography.fontWeightBold,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    lineHeight: Typography.lineHeightBase,
    marginBottom: Spacing.lg,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.fontSizeSm,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
    minWidth: 220,
    justifyContent: 'center',
  },
  unlockBtnDisabled: {
    opacity: 0.6,
  },
  unlockBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
});
