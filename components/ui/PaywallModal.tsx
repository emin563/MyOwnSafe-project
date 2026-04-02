import { FREE_TIER_ONE_LINERS } from '@/services/limits';
import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  /** Called when user taps "I already bought Pro" to restore access (e.g. restore purchases / account). */
  onRestore?: () => void;
};

type PlusCategory = {
  title: string;
  items: readonly string[];
};

/**
 * All Pro benefits in readable groups (nothing omitted vs former BENEFITS + PRO_ONLY_FEATURES).
 * Order: strongest hooks first, then supporting points.
 */
const PLUS_CATEGORIES: readonly PlusCategory[] = [
  {
    title: 'More room in your vault',
    items: [
      'Remove Free limits: 25 files, 5 custom categories you create, and 10 tags.',
      'Unlimited on-device “Text from photo” reads (Free starts with weekly bonus reads; Pro has no cap).',
      'Create unlimited categories to stay organized.',
      'Advanced sort and filter so you can find documents faster.',
    ],
  },
  {
    title: 'Backup & optional cloud',
    items: [
      'Export your full vault as a .zip file and restore from it anytime.',
      'Google Drive (Android): auto-upload saved documents and backup zips to a Vault folder in the account you link.',
    ],
  },
  {
    title: 'Capture & bulk actions',
    items: [
      'Multi-page camera scan: combine several photos into one PDF.',
      'Long-press to select multiple documents; bulk delete, move, tag, or zip-share.',
    ],
  },
  {
    title: 'AI workflows',
    items: [
      'Full library of AI prompt templates (Free includes one template per category).',
      'Export a copy to any AI app when you need it—no lock-in, no recurring fees.',
    ],
  },
  {
    title: 'Privacy & pricing',
    items: [
      'Your documents stay on your device for everyday use; no cloud required for the core vault.',
      'We never see your data.',
      'One-time payment—no subscriptions.',
    ],
  },
];

export function PaywallModal({ visible, onClose, onUpgrade, onRestore }: Props) {
  const insets = useSafeAreaInsets();
  const isIntroEligible = useAppStore((s) => s.isIntroEligible);
  const purchasePro = useAppStore((s) => s.purchasePro);
  const restorePro = useAppStore((s) => s.restorePro);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const result = await purchasePro();
      if (result.success) {
        onUpgrade();
        onClose();
      } else if (!result.cancelled) {
        Alert.alert('Purchase Failed', result.message || 'Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const result = await restorePro();
      if (result.success) {
        Alert.alert('Restored', 'Your Pro purchase has been restored.');
        if (onRestore) onRestore();
        onClose();
      } else {
        Alert.alert('Not Found', result.message || 'No previous purchase found.');
      }
    } catch {
      Alert.alert('Error', 'Could not restore purchases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.base }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.shieldWrap}>
            <Ionicons name="shield-checkmark" size={72} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Unlock Full Potential</Text>
          <Text style={styles.tagline}>
            Is your data in the cloud or under your control?
          </Text>

          <Text style={styles.freeBlockTitle}>What you get on Free (no surprises)</Text>
          {FREE_TIER_ONE_LINERS.map((line, i) => (
            <Text key={`free-${i}`} style={styles.freeBlockLine}>
              • {line}
            </Text>
          ))}

          <Text style={styles.plusIntro}>Everything in Free, plus:</Text>
          <View style={styles.benefits}>
            {PLUS_CATEGORIES.map((category, catIdx) => (
              <View
                key={category.title}
                style={[styles.categoryBlock, catIdx > 0 && styles.categoryBlockSpaced]}
              >
                <Text style={styles.categoryTitle}>{category.title}</Text>
                {category.items.map((line, lineIdx) => (
                  <View key={`${catIdx}-${lineIdx}`} style={styles.benefitRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={Colors.primary}
                      style={styles.benefitCheck}
                    />
                    <Text style={styles.benefitLine}>{line}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.priceBox}>
            {isIntroEligible ? (
              <>
                <Text style={styles.priceNormal}>$10 — one-time payment</Text>
                <Text style={styles.priceIntroHighlight}>For 7 days just $8</Text>
                <Text style={styles.priceTangible}>About the price of a lunch — one-time, no subscription.</Text>
              </>
            ) : (
              <>
                <Text style={styles.priceText}>$10 — one-time payment</Text>
                <Text style={styles.priceFinePrint}>No subscriptions, ever.</Text>
                <Text style={styles.priceTangible}>About the price of a lunch — one-time, no subscription.</Text>
              </>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && styles.upgradeBtnPressed, loading && styles.upgradeBtnDisabled]}
            onPress={handleUpgrade}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.upgradeBtnText}>Unlock Pro (One-time)</Text>
            )}
          </Pressable>

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Ionicons name="refresh-outline" size={18} color={Colors.primary} style={styles.restoreIcon} />
            <Text style={styles.restoreBtnText}>I already bought Pro — restore my purchase</Text>
          </TouchableOpacity>

          <Text style={styles.noSub}>No subscriptions, ever.</Text>

          <View style={styles.footer}>
            <Ionicons name="shield-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.footerText}>Bank-Grade Encryption</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06060a',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  shieldWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: Typography.fontWeightBold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  tagline: {
    color: Colors.primary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  freeBlockTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.sm,
  },
  freeBlockLine: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  plusIntro: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  benefits: {
    marginBottom: Spacing.xl,
  },
  categoryBlock: {},
  categoryBlockSpaced: {
    marginTop: Spacing.lg,
  },
  categoryTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
    marginBottom: Spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  benefitCheck: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  benefitLine: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
  priceBox: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  priceNormal: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    marginBottom: Spacing.xs,
  },
  priceIntroHighlight: {
    color: Colors.primary,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightBold,
    marginTop: Spacing.xs,
  },
  priceText: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  priceFinePrint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    marginTop: 4,
    textAlign: 'center',
  },
  priceTangible: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  upgradeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.base + 4,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  upgradeBtnPressed: {
    opacity: 0.85,
  },
  upgradeBtnDisabled: {
    opacity: 0.6,
  },
  upgradeBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  restoreIcon: {
    marginRight: Spacing.xs,
  },
  restoreBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  noSub: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
});
