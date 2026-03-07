import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { ConfirmModal } from '@/components/ui';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Prompt } from '@/db/types';

type Props = {
  prompt: Prompt;
};

export function PromptCard({ prompt }: Props) {
  const { categories, removePrompt } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const category = categories.find((c) => c.id === prompt.category_id);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(prompt.content);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    await removePrompt(prompt.id);
    setDeleteModalVisible(false);
  };

  return (
    <>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={styles.content}
          onPress={() => router.push(`/prompt/${prompt.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {prompt.title}
            </Text>
            {category && (
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {category.name}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.preview} numberOfLines={3}>
            {prompt.content}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.date}>{formatDate(prompt.updated_at)}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, copied && styles.actionBtnActive]}
              onPress={handleCopy}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={15}
                color={copied ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.actionText, copied && styles.actionTextActive]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/prompt/${prompt.id}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setDeleteModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={15} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <ConfirmModal
        visible={deleteModalVisible}
        title="Delete Prompt"
        message={`Are you sure you want to delete "${prompt.title}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />
    </>
  );
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  content: {
    padding: Spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  badge: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    maxWidth: 120,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightMedium,
  },
  preview: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  date: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  actionBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.1)',
  },
  actionText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeXs,
  },
  actionTextActive: {
    color: Colors.primary,
  },
});
