import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PaywallModal } from './PaywallModal';
import { QuizWhyPro } from './QuizWhyPro';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** After purchase / restore (should set isPro in the store). */
  onUpgrade: () => Promise<void> | void;
  /** Explains what the Pro feature does (shown under the title). */
  featureDescription: string;
};

/**
 * Same visual language as {@link LimitReachedDialog}: Pro upsell with quiz + paywall,
 * for features that are included in Pro rather than numeric Free limits.
 */
export function ProIncludedFeatureDialog({
  visible,
  onClose,
  onUpgrade,
  featureDescription,
}: Props) {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [showWhyPro, setShowWhyPro] = useState(false);
  const isIntroEligible = useAppStore((s) => s.isIntroEligible);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowWhyPro(false);
          setPaywallVisible(false);
          onClose();
        }}
      >
        <View style={styles.limitOverlay}>
          <View style={styles.limitCard}>
            <Text style={styles.limitTitle}>This feature is included in the Pro version</Text>
            <Text style={styles.limitBody}>{featureDescription}</Text>

            <Text style={styles.optionsHeading}>Options</Text>

            <View style={styles.limitButtons}>
              <TouchableOpacity
                style={styles.limitPrimaryBtn}
                onPress={() => {
                  onClose();
                  setShowWhyPro(false);
                  setPaywallVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.limitPrimaryText}>Buy Pro</Text>
              </TouchableOpacity>
              <Text style={styles.limitTangible}>
                {isIntroEligible
                  ? '$8 intro for 7 days, then $10 (one-time). No recurring fees.'
                  : 'One-time purchase. No subscription. No recurring fees.'}
              </Text>

              <TouchableOpacity
                style={styles.limitTertiaryBtn}
                onPress={() => setShowWhyPro(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.limitTertiaryText}>Why should I buy Pro?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.limitSecondaryBtn}
                onPress={() => {
                  setShowWhyPro(false);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.limitSecondaryText}>Continue without using this feature</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWhyPro}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWhyPro(false)}
      >
        <View style={styles.limitOverlay}>
          <View style={styles.quizWhyProWrap}>
            <QuizWhyPro
              onUpgrade={() => {
                setShowWhyPro(false);
                setPaywallVisible(true);
              }}
              onClose={() => setShowWhyPro(false)}
            />
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
  limitOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
  },
  limitCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  limitTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  limitBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: Typography.lineHeightBase,
  },
  optionsHeading: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  limitButtons: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  limitPrimaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
  },
  limitPrimaryText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  limitSecondaryBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  limitSecondaryText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  limitTertiaryBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  limitTertiaryText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  limitTangible: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  quizWhyProWrap: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: Spacing.base,
  },
});
