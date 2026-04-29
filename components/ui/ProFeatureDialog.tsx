import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PaywallModal } from './PaywallModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  /** Called after user completes purchase / restore from the paywall. */
  onUpgrade: () => Promise<void> | void;
};

/**
 * Explains that an action is not included in the Free plan (not a numeric slot limit).
 * Use instead of LimitReachedDialog when the gate is a Pro-only feature (e.g. multi-select bulk actions).
 */
export function ProFeatureDialog({ visible, onClose, title, message, onUpgrade }: Props) {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const isIntroEligible = useAppStore((s) => s.isIntroEligible);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.body}>{message}</Text>
            <Text style={styles.hint}>
              Full Free vs Pro limits are in{' '}
              <Text style={styles.hintLink} onPress={() => router.push('/settings')}>
                Settings → Free plan
              </Text>
              .
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                onClose();
                setPaywallVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>Unlock Pro (one-time)</Text>
            </TouchableOpacity>
            <Text style={styles.tangible}>
              {isIntroEligible
                ? '$8 one-time — about the price of a meal. No recurring fees.'
                : 'One-time purchase. No subscription.'}
            </Text>

            <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.dismissText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUpgrade={async () => {
          await onUpgrade();
          setPaywallVisible(false);
        }}
        onRestore={async () => {
          await onUpgrade();
          setPaywallVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  hintLink: {
    color: Colors.primary,
    fontWeight: Typography.fontWeightSemibold,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
  },
  primaryText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  tangible: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dismissBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  dismissText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
});
