import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { PillButton } from './PillButton';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onContinue: (dontShowAgain: boolean) => void;
};

export function AiShareDisclaimerModal({ visible, onCancel, onContinue }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Privacy note</Text>
          <Text style={styles.message}>
            Sharing sends a copy to another app/service. Their privacy rules apply.
          </Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setDontShowAgain((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={dontShowAgain ? 'checkbox' : 'square-outline'}
              size={22}
              color={dontShowAgain ? Colors.primary : Colors.textMuted}
            />
            <Text style={styles.checkboxText}>Don’t show again</Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <PillButton label="Cancel" variant="ghost" size="md" onPress={onCancel} style={{ flex: 1 }} />
            <PillButton
              label="Continue"
              variant="primary"
              size="md"
              onPress={() => onContinue(dontShowAgain)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
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
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  checkboxText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});

