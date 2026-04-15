import { ConfirmModal, InputModal, LimitReachedDialog } from '@/components/ui';
import type { Tag } from '@/db/types';
import { isLimitError } from '@/services/LimitError';
import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

type TagRowProps = {
  tag: Tag;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
};

const TagRow = memo(
  function TagRow({ tag, isSelected, onSelect, onEdit, onDelete }: TagRowProps) {
    return (
      <TouchableOpacity
        style={[styles.tagRow, isSelected && styles.tagRowActive]}
        onPress={() => onSelect(tag.id)}
        activeOpacity={0.7}
      >
        <View style={styles.tagLeft}>
          <Ionicons
            name="pricetag-outline"
            size={18}
            color={isSelected ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tagLabel, isSelected && styles.tagLabelActive]} numberOfLines={1}>
            {tag.name}
          </Text>
        </View>
        <View style={styles.tagActions}>
          <TouchableOpacity
            onPress={() => onEdit(tag)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Rename tag ${tag.name}`}
          >
            <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(tag)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Delete tag ${tag.name}`}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.tag.id === next.tag.id &&
    prev.tag.name === next.tag.name &&
    prev.isSelected === next.isSelected
);

export default function TagsScreen() {
  const {
    tags,
    selectedTagId,
    setSelectedTagId,
    loadDocuments,
    loadDocumentsByTag,
    loadTags,
    addTag,
    editTag,
    removeTag,
  } = useAppStore(
    useShallow((s) => ({
      tags: s.tags,
      selectedTagId: s.selectedTagId,
      setSelectedTagId: s.setSelectedTagId,
      loadDocuments: s.loadDocuments,
      loadDocumentsByTag: s.loadDocumentsByTag,
      loadTags: s.loadTags,
      addTag: s.addTag,
      editTag: s.editTag,
      removeTag: s.removeTag,
    }))
  );

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModal, setEditModal] = useState<{ visible: boolean; tag: Tag | null }>({
    visible: false,
    tag: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; tag: Tag | null }>({
    visible: false,
    tag: null,
  });
  const [limitVisible, setLimitVisible] = useState(false);
  const [pendingTagName, setPendingTagName] = useState<string | null>(null);

  const leave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(drawer)');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void loadTags();
      });
      return () => {
        cancelled = true;
        task.cancel?.();
      };
    }, [loadTags])
  );

  const handleSelectTag = useCallback(
    (tagId: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedTagId(tagId);
      void loadDocumentsByTag(tagId);
      leave();
    },
    [leave, loadDocumentsByTag, setSelectedTagId]
  );

  /** Clear tag filter, load full vault, go home — for users who do not want to filter by tags. */
  const handleNotUsingTags = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTagId(null);
    void loadDocuments(null);
    leave();
  }, [leave, loadDocuments, setSelectedTagId]);

  const openEdit = useCallback((tag: Tag) => {
    void Haptics.selectionAsync();
    setEditModal({ visible: true, tag });
  }, []);

  const openDelete = useCallback((tag: Tag) => {
    void Haptics.selectionAsync();
    setDeleteModal({ visible: true, tag });
  }, []);

  const openAdd = useCallback(() => {
    void Haptics.selectionAsync();
    setAddModalVisible(true);
  }, []);

  const handleAddTag = useCallback(
    async (name: string) => {
      try {
        await addTag(name);
        setAddModalVisible(false);
      } catch (e) {
        if (isLimitError(e)) {
          setAddModalVisible(false);
          setPendingTagName(name);
          setLimitVisible(true);
          return;
        }
        throw e;
      }
    },
    [addTag]
  );

  const handleEditTag = useCallback(
    async (name: string) => {
      if (!editModal.tag) return;
      try {
        await editTag(editModal.tag.id, name);
        setEditModal({ visible: false, tag: null });
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'DUPLICATE_TAG_NAME') {
          Alert.alert('Name in use', 'Another tag already has this name.');
          return;
        }
        Alert.alert('Could not rename', e instanceof Error ? e.message : 'Try again.');
      }
    },
    [editModal.tag, editTag]
  );

  const handleDeleteTag = useCallback(async () => {
    if (deleteModal.tag) {
      await removeTag(deleteModal.tag.id);
    }
    setDeleteModal({ visible: false, tag: null });
  }, [deleteModal.tag, removeTag]);

  const keyExtractor = useCallback((item: Tag) => String(item.id), []);

  const renderItem = useCallback(
    ({ item }: { item: Tag }) => (
      <TagRow
        tag={item}
        isSelected={item.id === selectedTagId}
        onSelect={handleSelectTag}
        onEdit={openEdit}
        onDelete={openDelete}
      />
    ),
    [handleSelectTag, openDelete, openEdit, selectedTagId]
  );

  const listHeader = useMemo(
    () => (
      <Text style={styles.hint}>
        Tap a tag to filter your documents. Use edit or delete to manage tags.
      </Text>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={leave} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tags</Text>
        <TouchableOpacity
          onPress={openAdd}
          style={styles.headerAddBtn}
          activeOpacity={0.7}
          accessibilityLabel="New tag"
        >
          <Ionicons name="add" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.notTagsRow}
        onPress={handleNotUsingTags}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="No tags: show all documents"
      >
        <Ionicons name="layers-outline" size={22} color={Colors.textSecondary} />
        <Text style={styles.notTagsTitle}>No tags</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      {tags.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="pricetag-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No tags yet</Text>
          <Text style={styles.emptySub}>
            Create tags to filter and organize documents. You can also add tags when editing a document.
          </Text>
          <TouchableOpacity style={styles.emptyCreateBtn} onPress={openAdd} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={Colors.primary} />
            <Text style={styles.emptyCreateText}>Create tag</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tags}
          extraData={selectedTagId}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={14}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <InputModal
        visible={addModalVisible}
        title="New Tag"
        placeholder="e.g. Tax, 2025, Urgent…"
        confirmLabel="Create"
        onConfirm={handleAddTag}
        onCancel={() => setAddModalVisible(false)}
      />
      <InputModal
        visible={editModal.visible}
        title="Rename Tag"
        placeholder="Tag name"
        initialValue={editModal.tag?.name ?? ''}
        confirmLabel="Save"
        onConfirm={handleEditTag}
        onCancel={() => setEditModal({ visible: false, tag: null })}
      />
      <ConfirmModal
        visible={deleteModal.visible}
        title="Delete Tag"
        message={`Delete "${deleteModal.tag?.name}"? It will be removed from all documents that use it.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteTag}
        onCancel={() => setDeleteModal({ visible: false, tag: null })}
      />
      <LimitReachedDialog
        visible={limitVisible}
        kind="tags"
        onClose={() => setLimitVisible(false)}
        onUpgrade={async () => {
          if (!pendingTagName) return;
          const retryName = pendingTagName;
          setPendingTagName(null);
          await handleAddTag(retryName);
        }}
        onManage={() => {
          setLimitVisible(false);
          void loadTags();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
  },
  headerAddBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  notTagsTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: 4,
    backgroundColor: Colors.surface,
  },
  tagRowActive: {
    backgroundColor: Colors.surfaceHighlight,
  },
  tagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  tagLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    flex: 1,
  },
  tagLabelActive: {
    color: Colors.text,
    fontWeight: Typography.fontWeightMedium,
  },
  tagActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    opacity: 0.75,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginTop: Spacing.sm,
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
  },
  emptyCreateText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
});
