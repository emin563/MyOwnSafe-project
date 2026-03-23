import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/app-store';
import { SearchInput, IconButton, InputModal, ConfirmModal, LimitReachedDialog } from '@/components/ui';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Category } from '@/db/types';
import { isLimitError } from '@/services/LimitError';

// Limits enforced in the store; UI just shows the same Limit dialog.

const CATEGORY_ICONS = [
  'folder-outline',
  'receipt-outline',
  'shield-checkmark-outline',
  'card-outline',
  'document-text-outline',
  'briefcase-outline',
  'home-outline',
  'medical-outline',
  'car-outline',
  'school-outline',
];

export function CustomDrawerContent(_props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const footerPaddingBottom = Math.max(insets.bottom, 32);
  const {
    categories,
    tags,
    selectedCategoryId,
    selectedTagId,
    setSelectedCategoryId,
    setSelectedTagId,
    loadDocuments,
    loadDocumentsByTag,
    addCategory,
    editCategory,
    removeCategory,
    searchQuery,
    setSearchQuery,
    runSearch,
    setIsPro,
  } = useAppStore();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModal, setEditModal] = useState<{ visible: boolean; category: Category | null }>({
    visible: false,
    category: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; category: Category | null }>({
    visible: false,
    category: null,
  });
  const [limitVisible, setLimitVisible] = useState(false);
  const [limitKind, setLimitKind] = useState<'categories'>('categories');
  const [pendingCategoryName, setPendingCategoryName] = useState<string | null>(null);
  const categoriesListRef = React.useRef<FlatList<Category> | null>(null);
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearchQueryRef = React.useRef<string>('');

  const handleSelectCategory = (id: number | null) => {
    setSelectedCategoryId(id);
    loadDocuments(id);
    router.replace('/(drawer)');
  };

  const handleSelectTag = (tagId: number) => {
    setSelectedTagId(tagId);
    loadDocumentsByTag(tagId);
    router.replace('/(drawer)');
  };

  const handleSearch = (q: string) => {
    latestSearchQueryRef.current = q;
    setSearchQuery(q);
    const trimmed = q.trim();

    // Empty query should feel immediate (it restores the default category/tag view).
    if (!trimmed) {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      runSearch(q);
      return;
    }

    // Debounce expensive search execution while typing.
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      runSearch(q);
    }, 250);
  };

  React.useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

      // If the drawer unmounts with a pending search, flush the latest query once.
      const latest = latestSearchQueryRef.current.trim();
      if (latest) {
        runSearch(latest);
      }
    };
  }, []);

  const handleAddCategory = async (name: string) => {
    try {
      await addCategory(name);
      setAddModalVisible(false);
    } catch (e) {
      if (isLimitError(e)) {
        // Close the input modal so "Manage / Delete" doesn't return to a create flow.
        setAddModalVisible(false);
        setPendingCategoryName(name);
        setLimitKind('categories');
        setLimitVisible(true);
        return;
      }
      throw e;
    }
  };

  const handleEditCategory = async (name: string) => {
    if (editModal.category) {
      await editCategory(editModal.category.id, name);
    }
    setEditModal({ visible: false, category: null });
  };

  const handleDeleteCategory = async () => {
    if (deleteModal.category) {
      await removeCategory(deleteModal.category.id);
    }
    setDeleteModal({ visible: false, category: null });
  };

  const renderCategory = ({ item }: { item: Category }) => {
    const isSelected = selectedCategoryId === item.id;
    return (
      <TouchableOpacity
        style={[styles.categoryRow, isSelected && styles.categoryRowActive]}
        onPress={() => handleSelectCategory(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.categoryLeft}>
          <Ionicons
            name={item.icon_name as any}
            size={16}
            color={isSelected ? Colors.primary : Colors.textMuted}
          />
          <Text
            style={[styles.categoryLabel, isSelected && styles.categoryLabelActive]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </View>
        <View style={styles.categoryActions}>
          <TouchableOpacity
            onPress={() => setEditModal({ visible: true, category: item })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDeleteModal({ visible: true, category: item })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top']}
    >
      <View style={styles.topContent}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.brandName}>Vault</Text>
        </View>

        <View style={styles.header}>
          <SearchInput
            placeholder="Search documents..."
            value={searchQuery}
            onChangeText={handleSearch}
            containerStyle={styles.search}
          />
          <IconButton onPress={() => router.push('/capture')} size={40}>
            <Ionicons name="add" size={20} color={Colors.text} />
          </IconButton>
        </View>

        <View style={styles.newButtons}>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => router.push('/capture')}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.newButtonText}>Scan document</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => router.push({ pathname: '/capture', params: { tab: 'import' } })}
            activeOpacity={0.7}
          >
            <Ionicons name="document-attach-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.newButtonText}>Add file</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.newButton,
            ]}
            onPress={() => {
              setAddModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="folder-open-outline"
              size={16}
              color={Colors.textSecondary}
            />
            <Text
              style={[
                styles.newButtonText,
              ]}
            >
              New category
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[
            styles.allDocsRow,
            selectedCategoryId === null && selectedTagId === null && !searchQuery && styles.categoryRowActive,
          ]}
          onPress={() => handleSelectCategory(null)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="layers-outline"
            size={16}
            color={
              selectedCategoryId === null && selectedTagId === null && !searchQuery
                ? Colors.primary
                : Colors.textSecondary
            }
          />
          <Text
            style={[
              styles.allDocsText,
              selectedCategoryId === null && selectedTagId === null && !searchQuery && styles.categoryLabelActive,
            ]}
          >
            All Documents
          </Text>
        </TouchableOpacity>

        <FlatList
          ref={categoriesListRef}
          data={categories}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCategory}
          style={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No categories yet</Text>
          }
        />

        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>Tags</Text>
        {tags.length === 0 ? (
          <View style={styles.tagsEmptyWrap}>
            <Text style={styles.tagsEmptyText}>No tags yet</Text>
            <Text style={styles.tagsEmptySubtext}>
              Add tags from any document to make search and organization faster.
            </Text>
          </View>
        ) : (
          tags.map((tag) => (
              <TouchableOpacity
                key={tag.id}
                style={[styles.categoryRow, selectedTagId === tag.id && styles.categoryRowActive]}
                onPress={() => handleSelectTag(tag.id)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryLeft}>
                  <Ionicons
                    name="pricetag-outline"
                    size={16}
                    color={selectedTagId === tag.id ? Colors.primary : Colors.textMuted}
                  />
                  <Text
                    style={[styles.categoryLabel, selectedTagId === tag.id && styles.categoryLabelActive]}
                    numberOfLines={1}
                  >
                    {tag.name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
        )}
      </View>

      <View
        style={[styles.footer, { paddingBottom: footerPaddingBottom }]}
      >
        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => router.push('/settings' as never)}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.settingsText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => router.push('/ocr-extraction-info')}
          activeOpacity={0.7}
        >
          <Ionicons name="text-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.settingsText}>Text from photo</Text>
        </TouchableOpacity>
      </View>

      <InputModal
        visible={addModalVisible}
        title="New Category"
        placeholder="e.g. Insurance, Medical..."
        confirmLabel="Create"
        onConfirm={handleAddCategory}
        onCancel={() => setAddModalVisible(false)}
      />
      <InputModal
        visible={editModal.visible}
        title="Rename Category"
        placeholder="Category name"
        initialValue={editModal.category?.name ?? ''}
        confirmLabel="Save"
        onConfirm={handleEditCategory}
        onCancel={() => setEditModal({ visible: false, category: null })}
      />
      <ConfirmModal
        visible={deleteModal.visible}
        title="Delete Category"
        message={`Delete "${deleteModal.category?.name}"? Documents in this category will become uncategorized.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteModal({ visible: false, category: null })}
      />
      <LimitReachedDialog
        visible={limitVisible}
        kind={limitKind}
        onClose={() => setLimitVisible(false)}
        onUpgrade={async () => {
          await setIsPro(true);
          if (!pendingCategoryName) return;
          const retryName = pendingCategoryName;
          setPendingCategoryName(null);
          await handleAddCategory(retryName);
        }}
        onManage={() => {
          // Bring the Categories section into view (top of the drawer)
          setSelectedTagId(null);
          setSearchQuery('');
          categoriesListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  topContent: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  search: {
    flex: 1,
  },
  newButtons: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  newButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  newButtonDisabled: {
    opacity: 0.6,
  },
  newButtonTextDisabled: {
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.sm,
  },
  allDocsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base + Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  allDocsText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  list: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    marginBottom: 2,
  },
  categoryRowActive: {
    backgroundColor: Colors.surfaceHighlight,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    marginHorizontal: Spacing.base,
  },
  tagsEmptyText: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: 2,
  },
  tagsEmptyWrap: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  tagsEmptySubtext: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
  },
  categoryLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    flex: 1,
  },
  categoryLabelActive: {
    color: Colors.text,
    fontWeight: Typography.fontWeightMedium,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    opacity: 0.6,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  footer: {
    paddingTop: Spacing.xs,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  settingsText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeBase,
  },
});
