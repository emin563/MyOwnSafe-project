import { useGoogleDriveAccountLinkStatus } from '@/hooks/useGoogleDriveAccountLinkStatus';
import { Colors } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { googleDriveBackupStyles as styles } from './googleDriveBackup.styles';

/**
 * Read-only row: whether a Google account is linked for Drive backup (uses {@link getGoogleDriveAccountLinkStatus}).
 */
export function GoogleDriveLinkStatusRow() {
  const { status, loading } = useGoogleDriveAccountLinkStatus();

  const label = loading
    ? 'Checking Google account…'
    : status.linked
      ? 'Google account linked'
      : 'Google account not linked';

  const hint = loading
    ? undefined
    : status.linked
      ? status.autoUploadEnabled
        ? 'Auto-upload to Drive is on.'
        : 'Turn on auto-upload below to sync new files to Drive.'
      : 'Tap Connect Google Drive below to link your account.';

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="small" />
        ) : (
          <Ionicons
            name={status.linked ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={status.linked ? Colors.primary : Colors.textMuted}
          />
        )}
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}
