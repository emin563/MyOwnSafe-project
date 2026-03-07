import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Colors, Radius } from '@/theme';

type Props = {
  onPress: () => void;
  children: React.ReactNode;
  size?: number;
  style?: ViewStyle;
  active?: boolean;
};

export function IconButton({ onPress, children, size = 36, style, active }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        active && styles.active,
        style,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  active: {
    backgroundColor: Colors.primary,
  },
});
