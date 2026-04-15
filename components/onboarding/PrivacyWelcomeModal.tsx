import { Colors, Radius, Spacing, Typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  requestNotificationPermissions,
} from '@/services/NotificationService';
import { requestRequiredVaultPermissionsWithNotices } from '@/services/requiredPermissions';

type PrivacyWelcomeModalProps = {
  visible: boolean;
  onGetStarted: () => void | Promise<void>;
};

export function PrivacyWelcomeModal({ visible, onGetStarted }: PrivacyWelcomeModalProps) {
  const [busy, setBusy] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const handleGrantRequired = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const ok = await requestRequiredVaultPermissionsWithNotices();
      if (!ok) return;
      await onGetStarted();
    } finally {
      setBusy(false);
    }
  }, [busy, onGetStarted]);

  const handleOptionalNotifications = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await requestNotificationPermissions();
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const openAndroidSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        /* Explicit action required */
      }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Permissions for Vault</Text>
          <Text style={styles.subtitle}>
            Vault needs a few system permissions to scan documents, import files, and optionally remind you before
            expiry dates. Below is what we use and why.
          </Text>

          <Text style={styles.sectionLabel}>Required</Text>
          <View style={styles.card}>
            <View style={styles.permBlock}>
              <View style={styles.permHeader}>
                <Ionicons name="camera-outline" size={22} color={Colors.primary} />
                <Text style={styles.permTitle}>Camera</Text>
                <View style={styles.badgeReq}>
                  <Text style={styles.badgeReqText}>Required</Text>
                </View>
              </View>
              <Text style={styles.permShort}>
                Scan receipts, warranties, and papers into your vault. Without camera access, document scanning is not
                possible.
              </Text>
            </View>
            <View style={styles.inCardDivider} />
            <View style={styles.permBlock}>
              <View style={styles.permHeader}>
                <Ionicons name="folder-outline" size={22} color={Colors.primary} />
                <Text style={styles.permTitle}>File management</Text>
                <View style={styles.badgeReq}>
                  <Text style={styles.badgeReqText}>Required</Text>
                </View>
              </View>
              <Text style={styles.permShort}>
                Read photos and files you choose so we can import them and save exports. Without this permission, files
                cannot be uploaded or downloaded through the app.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Optional</Text>
          <View style={styles.card}>
            <View style={styles.permBlock}>
              <View style={styles.permHeader}>
                <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
                <Text style={styles.permTitle}>Notifications</Text>
                <View style={styles.badgeOpt}>
                  <Text style={styles.badgeOptText}>Optional</Text>
                </View>
              </View>
              <Text style={styles.permShort}>
                Remind you before warranties and documents expire. You can turn this on later in Settings or here.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>One-time</Text>
          <View style={styles.card}>
            <View style={styles.permBlock}>
              <View style={styles.permHeader}>
                <Ionicons name="storefront-outline" size={22} color={Colors.primary} />
                <Text style={styles.permTitle}>Google Play (Pro)</Text>
                <View style={styles.badgeOnce}>
                  <Text style={styles.badgeOnceText}>When you buy</Text>
                </View>
              </View>
              <Text style={styles.permShort}>
                Google Play billing applies only if you choose to purchase Pro. Nothing is charged without your
                confirmation.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.showMoreRow}
            onPress={() => setDetailsExpanded((v) => !v)}
            activeOpacity={0.75}
          >
            <Text style={styles.showMoreText}>{detailsExpanded ? 'Show less' : 'Show more'}</Text>
            <Ionicons
              name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.primary}
            />
          </TouchableOpacity>

          {detailsExpanded ? (
            <View style={styles.detailsCard}>
              <Text style={styles.detailsHeading}>Why each permission exists</Text>
              <Text style={styles.detailsBody}>
                <Text style={styles.detailsBold}>Camera (required): </Text>
                Used only when you use Scan to capture a document.
              </Text>
              <Text style={styles.detailsBody}>
                <Text style={styles.detailsBold}>File management (required): </Text>
                Lets you pick images and documents from storage and save vault data. If this is off, imports and many
                save flows will not work.
              </Text>
              <Text style={styles.detailsBody}>
                <Text style={styles.detailsBold}>Notifications (optional): </Text>
                Local reminders only; no marketing. You can deny and still use the vault.
              </Text>
              <Text style={styles.detailsBody}>
                <Text style={styles.detailsBold}>Google Play (one-time): </Text>
                Store permission appears when you start a purchase; you approve each transaction.
              </Text>
            </View>
          ) : null}

          {Platform.OS === 'android' ? (
            <View style={styles.settingsHint}>
              <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.settingsHintText}>
                You can open <Text style={styles.settingsEmphasis}>Android app settings</Text> anytime to allow Camera and
                Files <Text style={styles.settingsEmphasis}>only while the app is in use</Text>, or to change permissions
                later. Use the button below.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={handleGrantRequired}
            activeOpacity={0.85}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Grant required permissions and continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, busy && styles.btnDisabled]}
            onPress={handleOptionalNotifications}
            activeOpacity={0.85}
            disabled={busy}
          >
            <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>Enable expiry reminders (optional)</Text>
          </TouchableOpacity>

          {Platform.OS === 'android' ? (
            <TouchableOpacity style={styles.tertiaryBtn} onPress={openAndroidSettings} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.tertiaryBtnText}>Open Android app settings</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  heroIcon: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSizeXl,
    fontWeight: Typography.fontWeightBold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: Typography.lineHeightLg,
  },
  subtitle: {
    fontSize: Typography.fontSizeBase,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: Typography.lineHeightBase,
  },
  sectionLabel: {
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  permBlock: {
    gap: Spacing.xs,
  },
  permHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  permTitle: {
    flex: 1,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.text,
    minWidth: 120,
  },
  badgeReq: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeReqText: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    color: '#fca5a5',
  },
  badgeOpt: {
    backgroundColor: 'rgba(16, 163, 127, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeOptText: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.primary,
  },
  badgeOnce: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeOnceText: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textSecondary,
  },
  permShort: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginLeft: 30,
  },
  inCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  showMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  showMoreText: {
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.primary,
  },
  detailsCard: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  detailsHeading: {
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  detailsBody: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  detailsBold: {
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.text,
  },
  settingsHint: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  settingsHintText: {
    flex: 1,
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  settingsEmphasis: {
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.text,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: '#fff',
    textAlign: 'center',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryBtnText: {
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  tertiaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tertiaryBtnText: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
