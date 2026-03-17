import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { PillButton } from './PillButton';

type Props = {
  visible: boolean;
  onContinue: () => void;
  onCancel: () => void;
};

export function AiEducationSheet({ visible, onContinue, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} onPress={onCancel} activeOpacity={1}>
        <View style={styles.sheet}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.handle} />
            <Text style={styles.title}>Use AI when you want</Text>

            <View style={styles.bullets}>
              <Bullet text="Your vault stays offline-first." />
              <Bullet text="Export a copy to any AI app for summaries, extraction, or Q&A." />
              <Bullet text="No forced subscriptions or lock-in." />
            </View>

            <View style={styles.actions}>
              <PillButton label="Cancel" variant="ghost" size="md" onPress={onCancel} style={{ flex: 1 }} />
              <PillButton
                label="Continue to share"
                variant="primary"
                size="md"
                onPress={onContinue}
                style={{ flex: 1 }}
              />
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceRaised,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxxl,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.md,
  },
  bullets: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  bulletText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});

