import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  /** Called when user taps "I already bought Pro" to restore access (e.g. restore purchases / account). */
  onRestore?: () => void;
};

const BENEFITS = [
  {
    title: 'Unlimited Storage:',
    description: 'Break the 3-file limit. Store thousands of photos and PDFs.',
  },
  {
    title: 'No Subscriptions:',
    description: 'One-time payment. Your data stays on your device forever.',
  },
  {
    title: 'Custom Folders:',
    description: 'Create unlimited categories to stay organized.',
  },
  {
    title: '100% Offline Security:',
    description: 'We never see your data.',
  },
];

export function PaywallModal({ visible, onClose, onUpgrade, onRestore }: Props) {
  const insets = useSafeAreaInsets();

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

          <Text style={styles.plusIntro}>Everything in Free, Plus:</Text>
          <View style={styles.benefits}>
            {BENEFITS.map((item, idx) => (
              <View key={idx} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} style={styles.benefitCheck} />
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{item.title}</Text>
                  <Text style={styles.benefitDesc}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.priceBox}>
            <Text style={styles.priceText}>$9.99, One Time Payment</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && styles.upgradeBtnPressed]}
            onPress={onUpgrade}
          >
            <Text style={styles.upgradeBtnText}>Upgrade for Lifetime Access</Text>
          </Pressable>

          {onRestore && (
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={onRestore}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={18} color={Colors.primary} style={styles.restoreIcon} />
              <Text style={styles.restoreBtnText}>I already bought Pro — restore my account</Text>
            </TouchableOpacity>
          )}

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
    marginBottom: Spacing.xl,
  },
  plusIntro: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    marginBottom: Spacing.md,
  },
  benefits: {
    marginBottom: Spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  benefitCheck: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: 2,
  },
  benefitDesc: {
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
  priceText: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
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
