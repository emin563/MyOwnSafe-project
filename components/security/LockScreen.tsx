import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      const entered = digits.join('');
      if (verifyPin(entered)) {
        authFlags.beginVaultPostInteractionGrace();
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

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={36} color={Colors.primary} />
      </View>

      <Text style={styles.title}>Enter PIN</Text>
      <Text style={styles.subtitle}>Enter your 4-digit PIN to unlock the Vault.</Text>

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
});
