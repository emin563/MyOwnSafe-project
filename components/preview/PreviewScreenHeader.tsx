import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/theme';
import { PREVIEW_COPY } from '@/constants/previewCopy';

type Props = {
  title: string;
  onBack: () => void;
  /** Header action: hand off file to another app (VIEW / Open in), not share sheet semantics where avoidable */
  onOpenInApp?: () => void;
  openDisabled?: boolean;
  openLoading?: boolean;
  /** Shown below the title row */
  subtitle?: string | null;
};

export function PreviewScreenHeader({
  title,
  onBack,
  onOpenInApp,
  openDisabled,
  openLoading,
  subtitle,
}: Props) {
  const showOpen = Boolean(onOpenInApp);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title.trim() || PREVIEW_COPY.screenTitle}
        </Text>
        {showOpen ? (
          <TouchableOpacity
            onPress={onOpenInApp}
            style={styles.headerBtn}
            activeOpacity={0.7}
            disabled={openDisabled || openLoading}
            accessibilityLabel={PREVIEW_COPY.openInAppA11y}
            accessibilityRole="button"
          >
            {openLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="open-outline" size={22} color={Colors.text} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>
      {subtitle ? (
        <View style={styles.subtitleBar}>
          <Text style={styles.subtitleText}>{subtitle}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
    marginHorizontal: Spacing.xs,
  },
  subtitleBar: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    paddingTop: 0,
  },
  subtitleText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeXs,
    lineHeight: Typography.lineHeightBase,
    textAlign: 'center',
  },
});
