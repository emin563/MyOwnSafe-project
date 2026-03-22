import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { deleteFileFromArchive } from '@/services/StorageService';
import { LimitReachedDialog } from '@/components/ui';
import { isLimitError } from '@/services/LimitError';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { FileType } from '@/db/types';

export default function ImportReviewScreen() {
  const {
    pendingBulkImports,
    clearPendingBulkImports,
    categories,
    loadCategories,
    loadDocuments,
    addDocument,
    setSelectedCategoryId,
  } = useAppStore();

  const [importCategoryId, setImportCategoryId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [limitVisible, setLimitVisible] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!pendingBulkImports?.length) {
      router.replace('/(drawer)');
      return;
    }
  }, [pendingBulkImports]);

  const handleAddAll = async () => {
    if (!pendingBulkImports?.length || adding) return;
    setAdding(true);
    try {
      for (let i = 0; i < pendingBulkImports.length; i++) {
        const { fileUri, fileType, name } = pendingBulkImports[i];
        await addDocument(
          name?.trim() ? name.trim() : `Document ${i + 1}`,
          fileUri,
          fileType,
          importCategoryId,
          null,
          null,
          null
        );
      }
      clearPendingBulkImports();
      setSelectedCategoryId(importCategoryId);
      await loadDocuments(importCategoryId);
      router.replace('/(drawer)');
    } catch (e) {
      if (isLimitError(e)) {
        setLimitVisible(true);
        return;
      }
      Alert.alert('Error', 'Could not add some documents. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleCancel = () => {
    if (!pendingBulkImports?.length) {
      router.replace('/(drawer)');
      return;
    }
    Alert.alert(
      'Discard imports?',
      `${pendingBulkImports.length} file(s) will be removed and not added to your vault.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            for (const { fileUri } of pendingBulkImports) {
              await deleteFileFromArchive(fileUri);
            }
            clearPendingBulkImports();
            router.replace('/(drawer)');
          },
        },
      ]
    );
  };

  if (!pendingBulkImports?.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const count = pendingBulkImports.length;

  const getTypeLabel = (t: FileType) =>
    t === 'image' ? 'Image' : t === 'pdf' ? 'PDF' : t === 'word' ? 'Word' : t === 'excel' ? 'Excel' : 'Document';

  const getTypeIcon = (t: FileType) =>
    t === 'image'
      ? 'image-outline'
      : t === 'pdf'
        ? 'document-outline'
        : t === 'word'
          ? 'document-text-outline'
          : t === 'excel'
            ? 'grid-outline'
            : 'document-attach-outline';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add to vault</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summary}>
          <Ionicons name="documents-outline" size={40} color={Colors.primary} />
          <Text style={styles.summaryTitle}>{count} file{count !== 1 ? 's' : ''} selected</Text>
          <Text style={styles.summarySubtitle}>Choose a category, then add all to your vault.</Text>
        </View>

        <Text style={styles.sectionLabel}>Selected files</Text>
        <View style={styles.filesCard}>
          {pendingBulkImports.map((item, idx) => (
            <View key={`${item.fileUri}-${idx}`} style={styles.fileRow}>
              <View style={styles.fileIcon}>
                <Ionicons name={getTypeIcon(item.fileType) as any} size={18} color={Colors.textSecondary} />
              </View>
              <View style={styles.fileText}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {item.name?.trim() ? item.name.trim() : `File ${idx + 1}`}
                </Text>
                <Text style={styles.fileMeta}>
                  {getTypeLabel(item.fileType)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.categoryList}>
          <TouchableOpacity
            style={[styles.categoryRow, importCategoryId === null && styles.categoryRowSelected]}
            onPress={() => setImportCategoryId(null)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="folder-open-outline"
              size={20}
              color={importCategoryId === null ? Colors.primary : Colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryRowText,
                importCategoryId === null && styles.categoryRowTextSelected,
              ]}
            >
              No category
            </Text>
            {importCategoryId === null && (
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            )}
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryRow, importCategoryId === cat.id && styles.categoryRowSelected]}
              onPress={() => setImportCategoryId(cat.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cat.icon_name as any}
                size={20}
                color={importCategoryId === cat.id ? Colors.primary : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.categoryRowText,
              importCategoryId === cat.id && styles.categoryRowTextSelected,
            ]}
          >
            {cat.name}
          </Text>
          {importCategoryId === cat.id && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.addAllBtn, adding && styles.addAllBtnDisabled]}
          onPress={handleAddAll}
          activeOpacity={0.8}
          disabled={adding}
        >
          {adding ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={22} color={Colors.white} />
              <Text style={styles.addAllBtnText}>Add all to vault</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <LimitReachedDialog
        visible={limitVisible}
        kind="documents"
        onClose={() => setLimitVisible(false)}
        onUpgrade={async () => {
          await useAppStore.getState().setIsPro(true);
          await handleAddAll();
        }}
        onManage={() => router.replace('/(drawer)')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
  },
  summary: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    marginTop: Spacing.md,
  },
  summarySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
    marginBottom: Spacing.sm,
  },
  filesCard: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileText: {
    flex: 1,
  },
  fileName: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  fileMeta: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    marginTop: 2,
  },
  categoryList: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  categoryRowSelected: {
    backgroundColor: 'rgba(16, 163, 127, 0.1)',
  },
  categoryRowText: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
  },
  categoryRowTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.fontWeightSemibold,
  },
  addAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.base + 4,
    borderRadius: Radius.lg,
  },
  addAllBtnDisabled: {
    opacity: 0.7,
  },
  addAllBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
  },
});
