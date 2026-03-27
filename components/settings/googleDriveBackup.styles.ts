import { Colors, Spacing, Typography } from '@/theme';
import { StyleSheet } from 'react-native';

export const googleDriveBackupStyles = StyleSheet.create({
  block: {
    marginTop: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  rowBtn: {
    opacity: 1,
  },
  rowIcon: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  rowLabelDanger: {
    color: Colors.danger,
  },
  rowHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 36 + Spacing.md,
  },
});
