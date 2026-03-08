import React, { useEffect, useRef, useState } from 'react';
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
import { SearchInput, IconButton, InputModal, ConfirmModal } from '@/components/ui';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Category } from '@/db/types';

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

// #region agent log
function sendDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {}
) {
  fetch('http://127.0.0.1:7480/ingest/66512b4c-ea2c-44b0-a600-fed3b773abbf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '8dfdc1',
    },
    body: JSON.stringify({
      sessionId: '8dfdc1',
      runId: 'drawer-warning-pre-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

export function CustomDrawerContent(_props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const footerPaddingBottom = Math.max(insets.bottom, 32);
  const {
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    addCategory,
    editCategory,
    removeCategory,
    loadDocuments,
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
  const renderCount = useRef(0);
  renderCount.current += 1;

  useEffect(() => {
    if (renderCount.current <= 8) {
      // #region agent log
      sendDebugLog(
        'H3',
        'components/layout/CustomDrawerContent.tsx:74',
        'drawer-render',
        {
          renderCount: renderCount.current,
          categoriesCount: categories.length,
          selectedCategoryId,
          searchQueryLength: searchQuery.length,
          addModalVisible,
          editModalVisible: editModal.visible,
          deleteModalVisible: deleteModal.visible,
          bottomInset: insets.bottom,
          footerPaddingBottom,
        }
      );
      // #endregion
    }
  }, [
    addModalVisible,
    categories.length,
    deleteModal.visible,
    footerPaddingBottom,
    editModal.visible,
    insets.bottom,
    searchQuery.length,
    selectedCategoryId,
  ]);

  const handleSelectCategory = (id: number | null) => {
    setSelectedCategoryId(id);
    loadDocuments(id);
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
        onPressIn={() => {
          // #region agent log
          sendDebugLog(
            'H2',
            'components/layout/CustomDrawerContent.tsx:126',
            'category-row-press-in',
            {
              itemId: item.id,
              isSelected,
              renderCount: renderCount.current,
            }
          );
          // #endregion
        }}
        onPress={() => {
          // #region agent log
          sendDebugLog(
            'H2',
            'components/layout/CustomDrawerContent.tsx:138',
            'category-row-press',
            {
              itemId: item.id,
              isSelected,
              renderCount: renderCount.current,
            }
          );
          // #endregion
          handleSelectCategory(item.id);
        }}
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
            onPressIn={() => {
              // #region agent log
              sendDebugLog(
                'H2',
                'components/layout/CustomDrawerContent.tsx:164',
                'category-edit-press-in',
                {
                  itemId: item.id,
                  renderCount: renderCount.current,
                }
              );
              // #endregion
            }}
            onPress={() => {
              // #region agent log
              sendDebugLog(
                'H2',
                'components/layout/CustomDrawerContent.tsx:176',
                'category-edit-press',
                {
                  itemId: item.id,
                  renderCount: renderCount.current,
                }
              );
              // #endregion
              setEditModal({ visible: true, category: item });
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPressIn={() => {
              // #region agent log
              sendDebugLog(
                'H2',
                'components/layout/CustomDrawerContent.tsx:192',
                'category-delete-press-in',
                {
                  itemId: item.id,
                  renderCount: renderCount.current,
                }
              );
              // #endregion
            }}
            onPress={() => {
              // #region agent log
              sendDebugLog(
                'H2',
                'components/layout/CustomDrawerContent.tsx:204',
                'category-delete-press',
                {
                  itemId: item.id,
                  renderCount: renderCount.current,
                }
              );
              // #endregion
              setDeleteModal({ visible: true, category: item });
            }}
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
      onLayout={(event) => {
        // #region agent log
        sendDebugLog(
          'H1',
          'components/layout/CustomDrawerContent.tsx:228',
          'drawer-layout',
          {
            height: event.nativeEvent.layout.height,
            bottomInset: insets.bottom,
            footerPaddingBottom,
          }
        );
        // #endregion
      }}
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
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="folder-open-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.newButtonText}>New category</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[
            styles.allDocsRow,
            selectedCategoryId === null && !searchQuery && styles.categoryRowActive,
          ]}
          onPress={() => handleSelectCategory(null)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="layers-outline"
            size={16}
            color={
              selectedCategoryId === null && !searchQuery
                ? Colors.primary
                : Colors.textSecondary
            }
          />
          <Text
            style={[
              styles.allDocsText,
              selectedCategoryId === null && !searchQuery && styles.categoryLabelActive,
            ]}
          >
            All Documents
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
      </View>

      <View
        style={[styles.footer, { paddingBottom: footerPaddingBottom }]}
        onLayout={(event) => {
          // #region agent log
          sendDebugLog(
            'H1',
            'components/layout/CustomDrawerContent.tsx:320',
            'footer-layout',
            {
              height: event.nativeEvent.layout.height,
              bottomInset: insets.bottom,
              footerPaddingBottom,
            }
          );
          // #endregion
        }}
      >
        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.settingsRow}
          onLayout={(event) => {
            // #region agent log
            sendDebugLog(
              'H1',
              'components/layout/CustomDrawerContent.tsx:338',
              'settings-layout',
              {
                y: event.nativeEvent.layout.y,
                height: event.nativeEvent.layout.height,
                bottomInset: insets.bottom,
                footerPaddingBottom,
              }
            );
            // #endregion
          }}
          onPressIn={() => {
            // #region agent log
            sendDebugLog(
              'H1',
              'components/layout/CustomDrawerContent.tsx:351',
              'settings-press-in',
              {
                bottomInset: insets.bottom,
                footerPaddingBottom,
                renderCount: renderCount.current,
              }
            );
            // #endregion
          }}
          onPress={() => {
            // #region agent log
            sendDebugLog(
              'H1',
              'components/layout/CustomDrawerContent.tsx:365',
              'settings-press',
              {
                bottomInset: insets.bottom,
                footerPaddingBottom,
                renderCount: renderCount.current,
              }
            );
            // #endregion
            router.push('/settings' as never);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.settingsText}>Settings</Text>
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
