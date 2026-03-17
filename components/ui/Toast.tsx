import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '@/theme';

type Props = {
  message: string;
  type?: 'success' | 'danger' | 'info';
  onDone: () => void;
};

export function Toast({ message, type = 'info', onDone }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 8, duration: 160, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 2000);

    return () => clearTimeout(t);
  }, [message, onDone, opacity, translateY]);

  const bg =
    type === 'success'
      ? 'rgba(16, 163, 127, 0.18)'
      : type === 'danger'
        ? 'rgba(239, 68, 68, 0.18)'
        : Colors.surfaceRaised;

  const border =
    type === 'success' ? Colors.primary : type === 'danger' ? Colors.danger : Colors.border;

  return (
    <SafeAreaView pointerEvents="none" style={styles.root} edges={['bottom']}>
      <Animated.View
        style={[
          styles.container,
          {
            paddingBottom: Math.max(insets.bottom, Spacing.base),
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.toast, { backgroundColor: bg, borderColor: border }]}>
          <Text style={styles.text} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    paddingHorizontal: Spacing.base,
  },
  toast: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  text: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
  },
});

