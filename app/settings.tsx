import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { createBackup, restoreFromBackup } from '@/services/BackupService';
import { cancelAllNotifications } from '@/services/NotificationService';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import { PaywallModal, QuizWhyPro } from '@/components/ui';

export default function SettingsScreen() {
  const {
    biometricEnabled,
    setBiometricEnabled,
    loadDocuments,
    loadCategories,
    setUnlocked,
    setIsPro,
    isPro,
  } = useAppStore();

  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [premiumExpanded, setPremiumExpanded] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  // ── Biometric toggle ────────────────────────────────────────────────────

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Verify the device actually supports biometrics before enabling
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometrics Unavailable',
          'Your device does not have biometric authentication set up. Please configure Face ID or fingerprint in your device settings first.'
        );
        return;
      }

      // Confirm with a live auth before enabling the lock
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable Vault lock',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (!auth.success) return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setBiometricEnabled(value);

    if (value) {
      // Mark as unlocked since the user just passed auth
      setUnlocked(true);
    }
  };

  // ── Backup ──────────────────────────────────────────────────────────────

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createBackup();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      Alert.alert('Backup Failed', message);
    } finally {
      setBackupLoading(false);
    }
  };

  // ── Restore ─────────────────────────────────────────────────────────────

  const handleRestore = async () => {
    Alert.alert(
      'Restore from Backup',
      'This will replace ALL current data with the contents of the selected backup file. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoreLoading(true);
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              // Cancel all pending notifications — they will be rescheduled
              await cancelAllNotifications();
              const success = await restoreFromBackup();
              if (success) {
                // Reload the store after restore
                await loadCategories();
                await loadDocuments(null);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Restore Complete', 'Your data has been restored successfully.');
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'An unknown error occurred.';
              Alert.alert('Restore Failed', message);
            } finally {
              setRestoreLoading(false);
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Security Section */}
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="finger-print-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Biometric Lock</Text>
              <Text style={styles.rowHint}>
                Lock Vault when the app moves to the background
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.border}
            />
          </View>
        </View>

        {/* Data Portability Section */}
        <Text style={styles.sectionTitle}>Data Portability</Text>
        <View style={styles.card}>
          {/* Backup */}
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={handleBackup}
            disabled={backupLoading}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Create Backup</Text>
              <Text style={styles.rowHint}>
                Export all documents and media as a .zip file
              </Text>
            </View>
            {backupLoading ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Restore */}
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={handleRestore}
            disabled={restoreLoading}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="cloud-download-outline" size={20} color={Colors.danger} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Restore from Backup</Text>
              <Text style={styles.rowHint}>
                Replace current data with a backup .zip file
              </Text>
            </View>
            {restoreLoading ? (
              <ActivityIndicator color={Colors.danger} size="small" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>

        {/* About: Why Pro (quiz) + MyOwnSafe Pro (paywall) */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => setPremiumExpanded((e) => !e)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Why should I buy Pro</Text>
              <Text style={styles.rowHint}>
                {premiumExpanded ? 'Tap to collapse' : 'Answer a few questions'}
              </Text>
            </View>
            <Ionicons
              name={premiumExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
          {premiumExpanded && (
            <>
              <View style={styles.divider} />
              <View style={styles.premiumContent}>
                <Text style={styles.premiumTitle}>Why go Pro?</Text>
                <Text style={styles.premiumText}>
                  Answer a few quick questions to see if unlimited, offline, one-time Pro fits how you
                  use your vault.
                </Text>
              </View>
              <QuizWhyPro
                onUpgrade={() => setPaywallVisible(true)}
                onClose={() => setPremiumExpanded(false)}
              />
            </>
          )}
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => setPaywallVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>MyOwnSafe Pro</Text>
              <Text style={styles.rowHint}>
                {isPro
                  ? 'Pro is active · Unlimited files & categories'
                  : 'Unlock unlimited files & categories (one-time purchase)'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUpgrade={() => {
          setIsPro(true);
          setPaywallVisible(false);
        }}
        onRestore={() => {
          setIsPro(true);
          setPaywallVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.md,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginLeft: Spacing.sm,
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 64,
  },
  rowBtn: {},
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 2,
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
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
  },
  premiumContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  premiumTitle: {
    color: Colors.primary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.sm,
  },
  premiumText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  premiumNote: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
});
