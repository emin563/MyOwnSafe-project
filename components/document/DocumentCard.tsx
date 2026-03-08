import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { deleteFileFromArchive } from '@/services/StorageService';
import { ConfirmModal } from '@/components/ui';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Document } from '@/db/types';

type Props = {
  document: Document;
};

export function DocumentCard({ document }: Props) {
  const { categories, removeDocument } = useAppStore();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const category = categories.find((c) => c.id === document.category_id);
  const isExpiringSoon = checkExpiringSoon(document.expiry_date);
  const isExpired = checkExpired(document.expiry_date);

  const handleShare = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Sharing.shareAsync(document.file_uri);
    } catch {
      // Ignore sharing errors
    }
  };

  const handleDelete = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteFileFromArchive(document.file_uri);
    await removeDocument(document.id);
    setDeleteModalVisible(false);
  };

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    router.push(`/document/${document.id}`);
  };

  return (
    <>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity style={styles.content} onPress={handlePress} activeOpacity={0.85}>
          <View style={styles.thumbnail}>
            {document.file_type === 'image' ? (
              <Image
                source={{ uri: document.file_uri }}
                style={styles.thumbnailImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.pdfPlaceholder}>
                <Ionicons name="document-outline" size={28} color={Colors.danger} />
                <Text style={styles.pdfLabel}>PDF</Text>
              </View>
            )}
          </View>

          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {document.title}
              </Text>
              {(isExpired || isExpiringSoon) && (
                <View style={[styles.expiryBadge, isExpired ? styles.expiryBadgeExpired : styles.expiryBadgeWarn]}>
                  <Ionicons
                    name={isExpired ? 'close-circle' : 'warning'}
                    size={11}
                    color={isExpired ? Colors.danger : '#f59e0b'}
                  />
                  <Text style={[styles.expiryBadgeText, isExpired && styles.expiryBadgeTextExpired]}>
                    {isExpired ? 'Expired' : 'Expiring'}
                  </Text>
                </View>
              )}
            </View>

            {category && (
              <View style={styles.categoryRow}>
                <Ionicons name={category.icon_name as any} size={12} color={Colors.primary} />
                <Text style={styles.categoryText} numberOfLines={1}>
                  {category.name}
                </Text>
              </View>
            )}

            <View style={styles.metaRow}>
              {document.purchase_price != null && (
                <View style={styles.metaChip}>
                  <Ionicons name="pricetag-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.metaChipText}>
                    ${document.purchase_price.toFixed(2)}
                  </Text>
                </View>
              )}
              {document.expiry_date && (
                <View style={styles.metaChip}>
                  <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.metaChipText}>{formatDate(document.expiry_date)}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.date}>{formatDate(document.updated_at)}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/document/${document.id}`)}
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
        title="Delete Document"
        message={`Permanently delete "${document.title}"? This cannot be undone.`}
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

function checkExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  try {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  } catch {
    return false;
  }
}

function checkExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  try {
    return new Date(expiryDate) < new Date();
  } catch {
    return false;
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
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  thumbnail: {
    width: 72,
    height: 88,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceHighlight,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  pdfPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  pdfLabel: {
    color: Colors.danger,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightBold,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  expiryBadgeExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  expiryBadgeText: {
    color: '#f59e0b',
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightMedium,
  },
  expiryBadgeTextExpired: {
    color: Colors.danger,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightMedium,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  metaChipText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
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
  actionText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeXs,
  },
});
