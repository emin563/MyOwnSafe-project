import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '@/theme';
import { PillButton } from './PillButton';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} onPress={onCancel} activeOpacity={1}>
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={1}>
            <Text style={styles.title}>{title}</Text>
            {message && <Text style={styles.message}>{message}</Text>}
            <View style={styles.actions}>
              <PillButton
                label="Cancel"
                onPress={onCancel}
                variant="ghost"
                style={styles.btn}
              />
              <PillButton
                label={confirmLabel}
                onPress={onConfirm}
                variant="danger"
                style={styles.btn}
              />
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '88%',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.sm,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.base,
  },
  btn: {
    minWidth: 80,
  },
});
