import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Spacing, Radius, Typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function PillButton({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: Props) {
  const containerStyles: ViewStyle[] = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    (disabled || loading) && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const labelStyles: TextStyle[] = [
    styles.label,
    styles[`labelSize_${size}`],
    styles[`labelVariant_${variant}`],
    textStyle as TextStyle,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.text} />
      ) : (
        <>
          {icon}
          <Text style={labelStyles}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  size_sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  size_md: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  size_lg: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  variant_primary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  variant_secondary: {
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.border,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
  variant_danger: {
    backgroundColor: Colors.dangerMuted,
    borderColor: Colors.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontWeight: Typography.fontWeightMedium,
  },
  labelSize_sm: {
    fontSize: Typography.fontSizeSm,
  },
  labelSize_md: {
    fontSize: Typography.fontSizeBase,
  },
  labelSize_lg: {
    fontSize: Typography.fontSizeMd,
  },
  labelVariant_primary: {
    color: Colors.white,
  },
  labelVariant_secondary: {
    color: Colors.text,
  },
  labelVariant_ghost: {
    color: Colors.textSecondary,
  },
  labelVariant_danger: {
    color: Colors.danger,
  },
});
