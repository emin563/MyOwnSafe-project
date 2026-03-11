import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/app-store';
import { authFlags } from '@/store/auth-flags';
import { Colors, Radius, Spacing, Typography } from '@/theme';

type Props = {
  onUnlock: () => void;
};

const PIN_LENGTH = 4;

export function LockScreen({ onUnlock }: Props) {
  const verifyPin = useAppStore((s) => s.verifyPin);
  const biometricEnabled = useAppStore((s) => s.biometricEnabled);
  const pinEnabled = useAppStore((s) => s.pinEnabled);

  // When biometrics is on, start with the loading view; flip to PIN pad on failure
  const [showPinPad, setShowPinPad] = useState(!biometricEnabled);
  const [biometricPending, setBiometricPending] = useState(biometricEnabled);
  const [digits, setDigits] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Biometric authentication ─────────────────────────────────────────────

  const triggerBiometric = useCallback(async () => {
    setBiometricPending(true);
    setErrorMessage(null);

    authFlags.isAuthenticating = true;

    try {
      if (AppState.currentState !== 'active') {
        setShowPinPad(true);
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        if (isMounted.current) setShowPinPad(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Vault',
        fallbackLabel: pinEnabled ? 'Use PIN' : '',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!isMounted.current) return;

      if (result.success) {
        onUnlock();
      } else {
        setShowPinPad(true);
      }
    } catch {
      if (isMounted.current) setShowPinPad(true);
    } finally {
      authFlags.isAuthenticating = false;
      authFlags.authEndedAt = Date.now();
      if (isMounted.current) setBiometricPending(false);
    }
  }, [onUnlock, pinEnabled]);

  // Auto-trigger biometrics on mount (only when enabled).
  // If the app is still in the background (common when LockScreen mounts due to
  // AppState backgrounding), wait for it to become active before triggering.
  useEffect(() => {
    if (!biometricEnabled) return;

    if (AppState.currentState === 'active') {
      triggerBiometric();
      return;
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        triggerBiometric();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── PIN verification ─────────────────────────────────────────────────────

  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      const entered = digits.join('');
      if (verifyPin(entered)) {
        onUnlock();
      } else {
        triggerShake();
        setErrorMessage('Incorrect PIN. Try again.');
        setTimeout(() => {
          if (isMounted.current) setDigits([]);
        }, 400);
      }
    }
  }, [digits, verifyPin, onUnlock, triggerShake]);

  const handlePress = useCallback(
    (key: string) => {
      setErrorMessage(null);
      if (key === 'del') {
        setDigits((prev) => prev.slice(0, -1));
        return;
      }
      if (digits.length >= PIN_LENGTH) return;
      setDigits((prev) => [...prev, key]);
    },
    [digits.length]
  );

  // ── Biometric loading view ───────────────────────────────────────────────

  if (biometricEnabled && biometricPending && !showPinPad) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name="finger-print-outline" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Authenticating…</Text>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.base }} />
      </View>
    );
  }

  // ── PIN pad (primary when biometrics disabled; fallback when it fails) ───

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={36} color={Colors.primary} />
      </View>

      <Text style={styles.title}>Enter PIN</Text>
      <Text style={styles.subtitle}>
        {showPinPad && biometricEnabled
          ? 'Biometric failed. Enter your PIN to unlock.'
          : 'Enter your 4-digit PIN to unlock the Vault.'}
      </Text>

      {/* Dot indicators */}
      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.dot, i < digits.length && styles.dotFilled]} />
        ))}
      </Animated.View>

      {errorMessage ? (
        <View style={styles.errorBadge}>
          <Ionicons name="warning-outline" size={13} color={Colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : (
        <View style={styles.errorPlaceholder} />
      )}

      {/* Keypad */}
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(
          (key, idx) => {
            if (!key) return <View key={`empty-${idx}`} style={styles.keyEmpty} />;
            if (key === 'del') {
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.keyBtn}
                  onPress={() => handlePress('del')}
                  activeOpacity={0.6}
                >
                  <Ionicons name="backspace-outline" size={22} color={Colors.text} />
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={key}
                style={styles.keyBtn}
                onPress={() => handlePress(key)}
                activeOpacity={0.6}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            );
          }
        )}
      </View>

      {/* Retry biometrics after a failed attempt */}
      {biometricEnabled && showPinPad && (
        <TouchableOpacity
          style={styles.biometricRetry}
          onPress={triggerBiometric}
          activeOpacity={0.7}
        >
          <Ionicons name="finger-print-outline" size={18} color={Colors.primary} />
          <Text style={styles.biometricRetryText}>Try Biometrics Again</Text>
        </TouchableOpacity>
      )}
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
    paddingBottom: Spacing.xxxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 163, 127, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
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
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.sm,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.fontSizeSm,
  },
  errorPlaceholder: {
    height: 32,
    marginBottom: Spacing.xl,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
    gap: Spacing.md,
    justifyContent: 'center',
  },
  keyBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keyEmpty: {
    width: 76,
    height: 76,
  },
  keyText: {
    color: Colors.text,
    fontSize: Typography.fontSizeXl,
    fontWeight: Typography.fontWeightMedium,
  },
  biometricRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  biometricRetryText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
});
