import { ConfirmModal, IconButton, InputModal, LimitReachedDialog, SearchInput } from '@/components/ui';
import type { Category } from '@/db/types';
import { isLimitError } from '@/services/LimitError';
import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

// Limits enforced in the store; UI just shows the same Limit dialog.

const CATEGORY_ICONS = [
  'folder-outline',
  'receipt-outline',
  'ribbon-outline',
  'shield-checkmark-outline',
  'card-outline',
  'document-text-outline',
  'briefcase-outline',
  'home-outline',
  'medical-outline',
  'car-outline',
  'school-outline',
];

export function CustomDrawerContent(props: DrawerContentComponentProps) {
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
    addCategory,
    editCategory,
    removeCategory,
    searchQuery,
    setSearchQuery,
    runSearch,
    vaultName,
    setVaultName,
  } = useAppStore(
    useShallow((s) => ({
      categories: s.categories,
      tags: s.tags,
      selectedCategoryId: s.selectedCategoryId,
      selectedTagId: s.selectedTagId,
      setSelectedCategoryId: s.setSelectedCategoryId,
      setSelectedTagId: s.setSelectedTagId,
      loadDocuments: s.loadDocuments,
      addCategory: s.addCategory,
      editCategory: s.editCategory,
      removeCategory: s.removeCategory,
      searchQuery: s.searchQuery,
      setSearchQuery: s.setSearchQuery,
      runSearch: s.runSearch,
      vaultName: s.vaultName,
      setVaultName: s.setVaultName,
    }))
  );

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
  const [pendingCategoryName, setPendingCategoryName] = useState<string | null>(null);
  const [vaultNameModalVisible, setVaultNameModalVisible] = useState(false);
  const categoriesListRef = React.useRef<FlatList<Category> | null>(null);
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearchQueryRef = React.useRef<string>('');

  const handleSelectCategory = (id: number | null) => {
    setSelectedCategoryId(id);
    loadDocuments(id);
    router.replace('/(drawer)');
    props.navigation.closeDrawer();
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
  }, [runSearch]);

  const handleAddCategory = async (name: string) => {
    try {
      await addCategory(name);
      setAddModalVisible(false);
    } catch (e) {
      if (isLimitError(e)) {
        // Close the input modal so "Manage / Delete" doesn't return to a create flow.
        setAddModalVisible(false);
        setPendingCategoryName(name);
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

  const selectedTagName = useMemo(
    () => (selectedTagId != null ? tags.find((t) => t.id === selectedTagId)?.name ?? null : null),
    [tags, selectedTagId]
  );

  const tagsNavSubtitle = useMemo(() => {
    if (selectedTagName) return `Filtering: ${selectedTagName}`;
    if (tags.length === 0) return 'Create and manage tags';
    return `${tags.length} tag${tags.length === 1 ? '' : 's'} · tap to filter`;
  }, [selectedTagName, tags.length]);

  const openTagsScreen = useCallback(() => {
    router.push('/tags');
    props.navigation.closeDrawer();
  }, [props.navigation]);

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
          <Text style={styles.brandName} numberOfLines={1}>
            {vaultName}
          </Text>
          <TouchableOpacity
            style={styles.brandEditBtn}
            onPress={() => setVaultNameModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Edit vault name"
          >
            <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <SearchInput
            placeholder="Search documents..."
            value={searchQuery}
            onChangeText={handleSearch}
            containerStyle={styles.search}
          />
          <IconButton
            onPress={() => {
              router.push('/capture');
              props.navigation.closeDrawer();
            }}
            size={40}
          >
            <Ionicons name="add" size={20} color={Colors.text} />
          </IconButton>
        </View>

        <View style={styles.newButtons}>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => {
              router.push('/capture');
              props.navigation.closeDrawer();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.newButtonText}>Scan document</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => {
              router.push('/capture');
              props.navigation.closeDrawer();
            }}
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
        <TouchableOpacity
          style={styles.tagsNavRow}
          onPress={openTagsScreen}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open tags"
        >
          <Ionicons name="pricetag-outline" size={18} color={Colors.textSecondary} />
          <View style={styles.tagsNavTextWrap}>
            <Text style={styles.tagsNavTitle}>Tags</Text>
            <Text style={styles.tagsNavSubtitle} numberOfLines={1}>
              {tagsNavSubtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
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
      <InputModal
        visible={vaultNameModalVisible}
        title="Rename Vault"
        placeholder="e.g. My Vault"
        initialValue={vaultName}
        confirmLabel="Save"
        onConfirm={async (name) => {
          await setVaultName(name);
          setVaultNameModalVisible(false);
        }}
        onCancel={() => setVaultNameModalVisible(false)}
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
        kind="categories"
        onClose={() => setLimitVisible(false)}
        onUpgrade={async () => {
          if (!pendingCategoryName) return;
          const retryName = pendingCategoryName;
          setPendingCategoryName(null);
          await handleAddCategory(retryName);
        }}
        onManage={() => {
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
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
    letterSpacing: 0.5,
  },
  brandEditBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  tagsNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  tagsNavTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  tagsNavTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  tagsNavSubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    marginTop: 2,
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
