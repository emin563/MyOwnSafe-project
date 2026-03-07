import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { SearchInput, IconButton, InputModal, ConfirmModal } from '@/components/ui';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Category } from '@/db/types';

export function CustomDrawerContent(_props: DrawerContentComponentProps) {
  const {
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    addCategory,
    editCategory,
    removeCategory,
    loadPrompts,
    searchQuery,
    setSearchQuery,
    runSearch,
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

  const handleSelectCategory = (id: number | null) => {
    setSelectedCategoryId(id);
    loadPrompts(id);
    router.replace('/(drawer)');
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    runSearch(q);
    router.replace('/(drawer)');
  };

  const handleAddCategory = async (name: string) => {
    await addCategory(name);
    setAddModalVisible(false);
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
          <View style={[styles.categoryDot, isSelected && styles.categoryDotActive]} />
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <SearchInput
          placeholder="Search prompts..."
          value={searchQuery}
          onChangeText={handleSearch}
          containerStyle={styles.search}
        />
        <IconButton onPress={() => router.push('/prompt/new')} size={40}>
          <Ionicons name="create-outline" size={18} color={Colors.text} />
        </IconButton>
      </View>

      <View style={styles.newButtons}>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/prompt/new')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={Colors.textSecondary} />
          <Text style={styles.newButtonText}>New prompt</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="folder-open-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.newButtonText}>New category</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.allPromptsRow, selectedCategoryId === null && !searchQuery && styles.categoryRowActive]}
        onPress={() => handleSelectCategory(null)}
        activeOpacity={0.7}
      >
        <Ionicons name="layers-outline" size={16} color={selectedCategoryId === null && !searchQuery ? Colors.primary : Colors.textSecondary} />
        <Text style={[styles.allPromptsText, selectedCategoryId === null && !searchQuery && styles.categoryLabelActive]}>
          All Prompts
        </Text>
      </TouchableOpacity>

      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCategory}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No categories yet</Text>
        }
      />

      <InputModal
        visible={addModalVisible}
        title="New Category"
        placeholder="Category name"
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
        message={`Are you sure you want to delete "${deleteModal.category?.name}"? Prompts in this category will become uncategorized.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteModal({ visible: false, category: null })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
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
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.sm,
  },
  allPromptsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base + Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  allPromptsText: {
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
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
  categoryDotActive: {
    backgroundColor: Colors.primary,
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
});
