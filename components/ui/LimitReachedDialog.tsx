import type { LimitKind } from '@/services/limits';
import { getLimitReachedCopy } from '@/services/limits';
import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PaywallModal } from './PaywallModal';
import { QuizWhyPro } from './QuizWhyPro';

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
  const isIntroEligible = useAppStore((s) => s.isIntroEligible);
  const isPro = useAppStore((s) => s.isPro);

  const copy = getLimitReachedCopy(kind);

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
            <Text style={styles.limitTitle}>{copy.title}</Text>
            <Text style={styles.limitBody}>{copy.body}</Text>
            <Text style={styles.limitBodySecondary}>{copy.footnote}</Text>

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
                <Text style={styles.limitPrimaryText}>Unlock Pro (One-time)</Text>
              </TouchableOpacity>
              <Text style={styles.limitTangible}>
                {isIntroEligible ? (
                  '$8 one-time — about the price of a meal. No recurring fees.'
                ) : (
                  'One-time purchase. No subscription. No recurring fees.'
                )}
              </Text>

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
                <Text style={styles.limitSecondaryText}>
                  {kind === 'documents' ? 'Free a slot (delete or merge)' : 'Free a slot or manage in drawer'}
                </Text>
              </TouchableOpacity>

              {!isPro ? (
                <TouchableOpacity
                  style={styles.limitTertiaryBtn}
                  onPress={() => setShowWhyPro(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.limitTertiaryText}>Is Pro right for you? (Quick check)</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWhyPro && !isPro}
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

