import { isGoogleDriveOAuthConfigured } from '@/config/googleDrive';
import { Colors, Spacing } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
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

export function GoogleDriveBackupSection() {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (
    <>
      <View style={sectionStyles.topDivider} />
      {!isGoogleDriveOAuthConfigured() ? (
        <GoogleDriveNotConfigured />
      ) : (
        <Suspense
          fallback={
            <View style={styles.row}>
              <ActivityIndicator color={Colors.primary} size="small" />
            </View>
          }
        >
          <GoogleDriveOAuthPanel />
        </Suspense>
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
