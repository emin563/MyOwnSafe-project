import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { deleteFileFromArchive } from '@/services/StorageService';
import { ConfirmModal, UseAiWorkflowSheet } from '@/components/ui';
import { LimitReachedDialog } from '@/components/ui';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Document } from '@/db/types';
import type { Tag } from '@/db/types';

type Props = {
  document: Document;
  tags?: Tag[];
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onPressInSelectionMode?: () => void;
};

const MAX_VISIBLE_TAGS = 3;

export function DocumentCard({
  document,
  tags = [],
  selectionMode = false,
  isSelected = false,
  onLongPress,
  onPressInSelectionMode,
}: Props) {
  const { categories, removeDocument, editDocument, duplicateDocument, showToast, isPro, setIsPro } = useAppStore();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [duplicateGateVisible, setDuplicateGateVisible] = useState(false);
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

  const handleShareToAi = async () => {
    setAiSheetVisible(true);
  };

  const handleOpenIn = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Sharing.shareAsync(document.file_uri, { dialogTitle: 'Open with...' });
    } catch {
      // Ignore
    }
  };

  const handleSaveToDevice = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Sharing.shareAsync(document.file_uri, { dialogTitle: 'Save to device' });
    } catch {
      // Ignore
    }
  };

  const handleDelete = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteFileFromArchive(document.file_uri);
    await removeDocument(document.id);
    showToast('Document deleted', 'success');
    setDeleteModalVisible(false);
  };

  const handleDuplicate = async () => {
    if (!isPro) {
      setDuplicateGateVisible(true);
      return;
    }
    if (duplicating) return;
    setDuplicating(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await duplicateDocument(document.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Document duplicated', 'success');
    } catch {
      // ignore
    } finally {
      setDuplicating(false);
    }
  };

  const handleMoveToCategory = async (newCategoryId: number | null) => {
    setMoveModalVisible(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await editDocument(
      document.id,
      document.title,
      document.file_uri,
      document.file_type,
      newCategoryId,
      document.purchase_price ?? null,
      document.expiry_date ?? null,
      document.notes ?? null
    );
    showToast('Moved to category', 'success');
  };

  const handlePress = () => {
    if (selectionMode && onPressInSelectionMode) {
      onPressInSelectionMode();
      return;
    }
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    router.push(`/document/${document.id}`);
  };

  return (
    <>
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale: scaleAnim }] },
          selectionMode && isSelected && styles.cardSelected,
        ]}
      >
        <TouchableOpacity
          style={styles.content}
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={400}
          activeOpacity={0.85}
        >
          {selectionMode && (
            <View style={styles.checkbox}>
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={24}
                color={isSelected ? Colors.primary : Colors.textMuted}
              />
            </View>
          )}
          <View style={styles.thumbnail}>
            {document.file_type === 'image' ? (
              <Image
                source={{ uri: document.file_uri }}
                style={styles.thumbnailImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View
                style={[
                  styles.pdfPlaceholder,
                  (document.file_type === 'word' || document.file_type === 'excel') &&
                    styles.docPlaceholder,
                ]}
              >
                <Ionicons
                  name={
                    document.file_type === 'word'
                      ? 'document-text-outline'
                      : document.file_type === 'excel'
                        ? 'grid-outline'
                        : 'document-outline'
                  }
                  size={28}
                  color={
                    document.file_type === 'word'
                      ? '#2b579a'
                      : document.file_type === 'excel'
                        ? '#217346'
                        : document.file_type === 'document'
                          ? Colors.textMuted
                          : Colors.danger
                  }
                />
                <Text
                  style={[
                    styles.pdfLabel,
                    (document.file_type === 'word' ||
                      document.file_type === 'excel' ||
                      document.file_type === 'document') &&
                      styles.docLabel,
                  ]}
                >
                  {document.file_type === 'word'
                    ? 'Word'
                    : document.file_type === 'excel'
                      ? 'Excel'
                      : document.file_type === 'document'
                        ? 'Doc'
                        : 'PDF'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {document.title}
              </Text>
              {(isExpired || isExpiringSoon) && (
                <View style={[styles.expiryBadge, isExpired ? styles.expiryBadgeExpired : null]}>
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

            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagChipText} numberOfLines={1}>{tag.name}</Text>
                  </View>
                ))}
                {tags.length > MAX_VISIBLE_TAGS && (
                  <View style={styles.tagChip}>
                    <Text style={styles.tagChipText}>+{tags.length - MAX_VISIBLE_TAGS}</Text>
                  </View>
                )}
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

        {!selectionMode && (
        <View style={styles.footer}>
          <Text style={styles.date}>{formatDate(document.updated_at)}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShareToAi} activeOpacity={0.7}>
              <Ionicons name="sparkles-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Use AI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleOpenIn} activeOpacity={0.7}>
              <Ionicons name="open-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Open in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleSaveToDevice} activeOpacity={0.7}>
              <Ionicons name="download-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setMoveModalVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="Move to category"
            >
              <Ionicons name="folder-open-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Move to category</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleDuplicate}
              disabled={duplicating}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionText}>{duplicating ? '…' : 'Duplicate'}</Text>
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
        )}
      </Animated.View>

      <ConfirmModal
        visible={deleteModalVisible}
        title="Delete Document"
        message={`Permanently delete "${document.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />

      <LimitReachedDialog
        visible={duplicateGateVisible}
        kind="documents"
        onClose={() => setDuplicateGateVisible(false)}
        onUpgrade={async () => {
          await setIsPro(true);
        }}
      />

      <UseAiWorkflowSheet
        visible={aiSheetVisible}
        onClose={() => setAiSheetVisible(false)}
        document={{
          id: document.id,
          title: document.title,
          fileType: document.file_type,
          categoryName: category?.name ?? null,
        }}
        fileUri={document.file_uri}
      />

      <Modal visible={moveModalVisible} transparent animationType="slide" onRequestClose={() => setMoveModalVisible(false)}>
        <TouchableOpacity
          style={movePickerStyles.overlay}
          onPress={() => setMoveModalVisible(false)}
          activeOpacity={1}
        >
          <View style={movePickerStyles.sheet}>
            <View style={movePickerStyles.handle} />
            <Text style={movePickerStyles.title}>Move to category</Text>
            <TouchableOpacity
              style={movePickerStyles.item}
              onPress={() => handleMoveToCategory(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="layers-outline" size={18} color={Colors.textSecondary} />
              <Text style={movePickerStyles.itemText}>No category</Text>
            </TouchableOpacity>
            <FlatList
              data={categories}
              keyExtractor={(item) => String(item.id)}
              style={movePickerStyles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={movePickerStyles.item}
                  onPress={() => handleMoveToCategory(item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={item.icon_name as any} size={18} color={Colors.textSecondary} />
                  <Text style={movePickerStyles.itemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.08)',
  },
  checkbox: {
    marginRight: Spacing.sm,
    justifyContent: 'center',
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
  docPlaceholder: {
    backgroundColor: Colors.surfaceHighlight,
  },
  pdfLabel: {
    color: Colors.danger,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightBold,
  },
  docLabel: {
    color: Colors.textSecondary,
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tagChip: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 80,
  },
  tagChipText: {
    color: Colors.textMuted,
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
    flexWrap: 'wrap',
    gap: Spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
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

const movePickerStyles = StyleSheet.create({
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
    maxHeight: '50%',
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  itemText: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
  },
  list: {
    maxHeight: 240,
  },
});
