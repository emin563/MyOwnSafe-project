import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Colors, Spacing, Radius, Typography } from '@/theme';
import { PillButton } from './PillButton';

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  confirmLabel?: string;
};

export function InputModal({
  visible,
  title,
  placeholder = 'Enter text...',
  initialValue = '',
  onConfirm,
  onCancel,
  confirmLabel = 'Save',
}: Props) {
  const [value, setValue] = React.useState(initialValue);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }).start();
    }
  }, [visible, initialValue]);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} onPress={onCancel} activeOpacity={1}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <Animated.View style={[styles.card, { opacity }]}>
            <TouchableOpacity activeOpacity={1}>
              <Text style={styles.title}>{title}</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder={placeholder}
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.primary}
                autoFocus
                onSubmitEditing={handleConfirm}
              />
              <View style={styles.actions}>
                <PillButton
                  label="Cancel"
                  onPress={onCancel}
                  variant="ghost"
                  style={styles.actionBtn}
                />
                <PillButton
                  label={confirmLabel}
                  onPress={handleConfirm}
                  variant="primary"
                  style={styles.actionBtn}
                  disabled={!value.trim()}
                />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
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
  kav: {
    width: '100%',
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
    marginBottom: Spacing.base,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  actionBtn: {
    minWidth: 80,
  },
});
