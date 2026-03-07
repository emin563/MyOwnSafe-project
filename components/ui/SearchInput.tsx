import React from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/theme';

type Props = TextInputProps & {
  containerStyle?: ViewStyle;
};

export function SearchInput({ containerStyle, style, ...props }: Props) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.icon} />
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={Colors.textMuted}
        selectionColor={Colors.primary}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    paddingVertical: 0,
  },
});
