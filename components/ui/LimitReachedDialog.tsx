import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { PaywallModal } from './PaywallModal';
import { QuizWhyPro } from './QuizWhyPro';
import type { LimitKind } from '@/services/limits';
import { getFreeLimit } from '@/services/limits';

type Props = {
  visible: boolean;
  kind: LimitKind;
  onClose: () => void;
  /** Called after user upgrades/restores (should set isPro). */
  onUpgrade: () => Promise<void> | void;
  /** Optional override for "Manage/Delete" action; defaults to go home. */
  onManage?: () => void;
};

export function LimitReachedDialog({ visible, kind, onClose, onUpgrade, onManage }: Props) {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [showWhyPro, setShowWhyPro] = useState(false);

  const limit = getFreeLimit(kind);
  const noun =
    kind === 'documents' ? 'documents' : kind === 'categories' ? 'categories' : 'tags';

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
            <Text style={styles.limitTitle}>Limit reached</Text>
            <Text style={styles.limitBody}>
              You&apos;ve reached the free limit for {noun} ({limit}).
            </Text>
            <Text style={styles.limitBodySecondary}>
              You can delete some items or upgrade to Pro to remove limits.
            </Text>

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
                <Text style={styles.limitPrimaryText}>Get Pro – one-time payment</Text>
              </TouchableOpacity>
              <Text style={styles.limitTangible}>About the price of a lunch — one-time, no subscription.</Text>

              <TouchableOpacity
                style={styles.limitSecondaryBtn}
                onPress={() => {
                  onClose();
                  setShowWhyPro(false);
                  if (onManage) onManage();
                  else router.replace('/(drawer)');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.limitSecondaryText}>Manage / Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.limitTertiaryBtn}
                onPress={() => setShowWhyPro(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.limitTertiaryText}>Why should I get Pro?</Text>
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
    marginBottom: Spacing.xs,
  },
  limitBodySecondary: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
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

