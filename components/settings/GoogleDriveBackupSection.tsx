import { isGoogleDriveOAuthConfigured } from '@/config/googleDrive';
import { Colors, Spacing } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { lazy, Suspense } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GoogleDriveLinkStatusRow } from './GoogleDriveLinkStatusRow';
import { googleDriveBackupStyles as styles } from './googleDriveBackup.styles';

const GoogleDriveOAuthPanel = lazy(() => import('./GoogleDriveOAuthPanel'));

function GoogleDriveNotConfigured() {
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Ionicons name="logo-google" size={20} color={Colors.textMuted} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>Google Drive backup</Text>
          <Text style={styles.rowHint}>
            Add googleDriveOAuth.androidClientId in app.json extra (Android OAuth client from Google Cloud Console,
            package + SHA-1), then rebuild the native app.
          </Text>
        </View>
      </View>
    </View>
  );
}

function GoogleDriveProTeaser({ onRequestPro }: { onRequestPro: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.row, styles.rowBtn]}
      onPress={onRequestPro}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        <Ionicons name="logo-google" size={20} color={Colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>Google Drive backup (Pro)</Text>
        <Text style={styles.rowHint}>
          Pro: link your Google account and auto-upload saved documents to a Vault folder (Android). Full vault
          backups stay local (.zip export). One-time purchase unlocks this with full backup, bulk tools, and more.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

type Props = {
  isPro: boolean;
  onRequestPro: () => void;
};

export function GoogleDriveBackupSection({ isPro, onRequestPro }: Props) {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (
    <>
      <View style={sectionStyles.topDivider} />
      {!isPro ? (
        <GoogleDriveProTeaser onRequestPro={onRequestPro} />
      ) : !isGoogleDriveOAuthConfigured() ? (
        <GoogleDriveNotConfigured />
      ) : (
        <>
          <GoogleDriveLinkStatusRow />
          <Suspense
            fallback={
              <View style={styles.row}>
                <ActivityIndicator color={Colors.primary} size="small" />
              </View>
            }
          >
            <GoogleDriveOAuthPanel />
          </Suspense>
        </>
      )}
    </>
  );
}

const sectionStyles = StyleSheet.create({
  topDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
  },
});
