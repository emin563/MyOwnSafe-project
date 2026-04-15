import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/app-store';
import { useShallow } from 'zustand/react/shallow';
import { getTagsForDocuments } from '@/db/tags';
import { deleteFileFromArchive } from '@/services/StorageService';
import { shareSelectedDocuments, type BackupProgress } from '@/services/BackupService';
import { estimateBackupTotalSeconds } from '@/services/backupTimeEstimate';
import {
  resetBackupProgressThrottle,
  shouldEmitBackupProgress,
  type BackupProgressThrottleState,
} from '@/services/backupProgressThrottle';
import { DocumentCard } from '@/components/document/DocumentCard';
import { BackupProgressModal, ConfirmModal, PaywallModal, QuizWhyPro } from '@/components/ui';
import { getFreeLimit } from '@/services/limits';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Document, FileType, Tag } from '@/db/types';

export default function HomeScreen() {
  const navigation = useNavigation();
  const {
    documents,
    categories,
    tags,
    selectedCategoryId,
    selectedTagId,
    searchQuery,
    searchResultCapped,
    sortBy,
    documentTagLinksVersion,
    setSortBy,
    selectionMode,
    selectedIds,
    setSelectionMode,
    toggleSelected,
    selectAll,
    clearSelection,
    removeDocument,
    editDocument,
    tagDocuments,
    loadDocuments,
    loadDocumentsByTag,
    showToast,
    isPro,
  } = useAppStore(
    useShallow((s) => ({
      documents: s.documents,
      categories: s.categories,
      tags: s.tags,
      selectedCategoryId: s.selectedCategoryId,
      selectedTagId: s.selectedTagId,
      searchQuery: s.searchQuery,
      searchResultCapped: s.searchResultCapped,
      sortBy: s.sortBy,
      documentTagLinksVersion: s.documentTagLinksVersion,
      setSortBy: s.setSortBy,
      selectionMode: s.selectionMode,
      selectedIds: s.selectedIds,
      setSelectionMode: s.setSelectionMode,
      toggleSelected: s.toggleSelected,
      selectAll: s.selectAll,
      clearSelection: s.clearSelection,
      removeDocument: s.removeDocument,
      editDocument: s.editDocument,
      tagDocuments: s.tagDocuments,
      loadDocuments: s.loadDocuments,
      loadDocumentsByTag: s.loadDocumentsByTag,
      showToast: s.showToast,
      isPro: s.isPro,
    }))
  );
  const [documentTagsMap, setDocumentTagsMap] = useState<Record<number, Tag[]>>({});
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);
  const [bulkMoveVisible, setBulkMoveVisible] = useState(false);
  const [bulkTagVisible, setBulkTagVisible] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType | 'all'>('all');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [showWhyPro, setShowWhyPro] = useState(false);
  const [shareZipLoading, setShareZipLoading] = useState(false);
  const [shareZipProgress, setShareZipProgress] = useState<BackupProgress | null>(null);
  const [shareZipStartedAt, setShareZipStartedAt] = useState<number | null>(null);
  const [shareZipEstimatedSeconds, setShareZipEstimatedSeconds] = useState<number | null>(null);
  const shareZipProgressThrottleRef = useRef<BackupProgressThrottleState>({ lastPhase: '', lastAt: 0 });

  /** Stable key: sorted visible doc IDs — avoids refetching tags when only sort order changes. */
  const visibleDocIdsSignature = useMemo(() => {
    const filtered =
      fileTypeFilter === 'all' ? documents : documents.filter((d) => d.file_type === fileTypeFilter);
    if (filtered.length === 0) return '';
    return filtered
      .map((d) => d.id)
      .sort((a, b) => a - b)
      .join(',');
  }, [documents, fileTypeFilter]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!visibleDocIdsSignature) {
        if (!cancelled) setDocumentTagsMap({});
        return;
      }

      const ids = visibleDocIdsSignature
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length === 0) {
        if (!cancelled) setDocumentTagsMap({});
        return;
      }

      const map = await getTagsForDocuments(ids);
      if (!cancelled) setDocumentTagsMap(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [visibleDocIdsSignature, documentTagLinksVersion]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedTag = tags.find((t) => t.id === selectedTagId);

  const displayedDocuments = useMemo(
    () => (fileTypeFilter === 'all' ? documents : documents.filter((d) => d.file_type === fileTypeFilter)),
    [documents, fileTypeFilter]
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const categoriesById = useMemo(() => {
    const map = new Map<number, (typeof categories)[number]>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const headerTitle = searchQuery
    ? `Results for "${searchQuery}"`
    : selectedTag
    ? selectedTag.name
    : selectedCategory
    ? selectedCategory.name
    : 'All Documents';

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleCardLongPress = useCallback(
    (id: number) => {
      if (!isPro) {
        setPaywallVisible(true);
        return;
      }
      if (!selectionMode) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectionMode(true);
        toggleSelected(id);
      }
    },
    [isPro, selectionMode, setSelectionMode, toggleSelected]
  );

  const handleClearSelection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearSelection();
  };

  const handleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectAll();
  };

  const selectedDocuments = useMemo(
    () => documents.filter((d) => selectedIdSet.has(d.id)),
    [documents, selectedIdSet]
  );

  const handleBulkDelete = async () => {
    setBulkDeleteVisible(false);
    for (const doc of selectedDocuments) {
      await deleteFileFromArchive(doc.file_uri);
      await removeDocument(doc.id, { skipReload: true });
    }
    clearSelection();
    if (selectedTagId) await loadDocumentsByTag(selectedTagId);
    else await loadDocuments(selectedCategoryId);
    showToast('Documents deleted', 'success');
  };

  const handleBulkMove = async (categoryId: number | null) => {
    setBulkMoveVisible(false);
    for (const doc of selectedDocuments) {
      await editDocument(
        doc.id,
        doc.title,
        doc.file_uri,
        doc.file_type,
        categoryId,
        doc.purchase_price ?? null,
        doc.expiry_date ?? null,
        doc.notes ?? null,
        { skipReload: true }
      );
    }
    clearSelection();
    await loadDocuments(categoryId);
    showToast('Documents moved', 'success');
  };

  const handleBulkZip = async () => {
    if (!isPro) {
      setPaywallVisible(true);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetBackupProgressThrottle(shareZipProgressThrottleRef.current);
    setShareZipLoading(true);
    setShareZipProgress({ phase: 'preflight' });
    setShareZipStartedAt(Date.now());
    setShareZipEstimatedSeconds(null);
    try {
      await shareSelectedDocuments(selectedDocuments, categories, (p) => {
        if (shouldEmitBackupProgress(shareZipProgressThrottleRef.current, p, 120)) {
          setShareZipProgress(p);
          if (p.phase === 'preflight' && typeof p.totalBytes === 'number') {
            setShareZipEstimatedSeconds(estimateBackupTotalSeconds(p.totalBytes, p.fileCount ?? 0));
          }
        }
      });
      showToast('Zip ready to share', 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not create zip.';
      showToast(message, 'danger');
    } finally {
      setShareZipLoading(false);
      setShareZipProgress(null);
      setShareZipStartedAt(null);
      setShareZipEstimatedSeconds(null);
    }
  };

  const handleBulkTag = async (tagId: number) => {
    setBulkTagVisible(false);
    if (selectedDocuments.length === 0) return;
    await tagDocuments(
      selectedDocuments.map((d) => d.id),
      tagId
    );
    clearSelection();
    if (selectedTagId) await loadDocumentsByTag(selectedTagId);
    else await loadDocuments(selectedCategoryId);
  };

  const renderDocument = useCallback(
    ({ item }: { item: Document }) => (
      <DocumentCard
        document={item}
        category={item.category_id != null ? categoriesById.get(item.category_id) ?? null : null}
        tags={documentTagsMap[item.id] ?? []}
        selectionMode={selectionMode}
        isSelected={selectedIdSet.has(item.id)}
        onLongPress={() => handleCardLongPress(item.id)}
        onPressInSelectionMode={() => toggleSelected(item.id)}
      />
    ),
    [categoriesById, documentTagsMap, handleCardLongPress, selectionMode, selectedIdSet, toggleSelected]
  );
  const renderSeparator = useCallback(() => <View style={styles.separator} />, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackupProgressModal
        visible={shareZipLoading}
        title="Preparing zip"
        progress={shareZipProgress}
        startedAtMs={shareZipStartedAt}
        estimatedTotalSeconds={shareZipEstimatedSeconds}
      />
      {selectionMode ? (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity onPress={handleClearSelection} style={styles.toolbarBtn} activeOpacity={0.7}>
            <Text style={styles.toolbarCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.toolbarTitle}>
            {selectedIds.length} selected
          </Text>
          <TouchableOpacity onPress={handleSelectAll} style={styles.toolbarBtn} activeOpacity={0.7}>
            <Text style={styles.toolbarActionText}>Select all</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuButton} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            {selectedTag && (
              <Ionicons name="pricetag-outline" size={16} color={Colors.primary} style={styles.headerIcon} />
            )}
            {selectedCategory && !selectedTag && (
              <Ionicons name={selectedCategory.icon_name as any} size={16} color={Colors.primary} style={styles.headerIcon} />
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
          </View>
          {!isPro && (
            <Text style={styles.headerQuotaHint} numberOfLines={2}>
              {documents.length} / {getFreeLimit('documents')} documents ·{' '}
              <Text style={styles.headerQuotaLink} onPress={() => router.push('/settings')}>
                Free plan
              </Text>
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.push('/capture')}
          style={styles.addButton}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'image', label: 'Images' },
            { key: 'pdf', label: 'PDFs' },
            { key: 'word', label: 'Word' },
            { key: 'excel', label: 'Excel' },
            { key: 'document', label: 'Other' },
          ] as const
        ).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterChip, fileTypeFilter === key && styles.filterChipActive]}
            onPress={() => setFileTypeFilter(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, fileTypeFilter === key && styles.filterChipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sortRow}>
        {(['newest', 'oldest', 'expiring', 'name'] as const).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.sortChip, sortBy === key && styles.sortChipActive]}
            onPress={() => setSortBy(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortChipText, sortBy === key && styles.sortChipTextActive]}>
              {key === 'newest' ? 'Newest' : key === 'oldest' ? 'Oldest' : key === 'expiring' ? 'Expiring' : 'Name'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
        </>
      )}

      {selectionMode && selectedIds.length > 0 && (
        <View style={styles.bulkActions}>
          <TouchableOpacity
            style={styles.bulkActionBtn}
            onPress={() => setBulkDeleteVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            <Text style={styles.bulkActionText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkActionBtn}
            onPress={() => setBulkMoveVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="folder-open-outline" size={20} color={Colors.text} />
            <Text style={styles.bulkActionText}>Move</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkZip} activeOpacity={0.7}>
            <Ionicons name="archive-outline" size={20} color={Colors.text} />
            <Text style={styles.bulkActionText}>Zip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkActionBtn}
            onPress={() => setBulkTagVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pricetag-outline" size={20} color={Colors.text} />
            <Text style={styles.bulkActionText}>Tag</Text>
          </TouchableOpacity>
        </View>
      )}

      <ConfirmModal
        visible={bulkDeleteVisible}
        title="Delete documents"
        message={`Permanently delete ${selectedIds.length} document(s)? This cannot be undone.`}
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteVisible(false)}
      />

      <Modal
        visible={showWhyPro && !isPro}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWhyPro(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={{ width: '100%', maxWidth: 420, paddingHorizontal: Spacing.base }}>
            <QuizWhyPro
              onUpgrade={() => {
                setShowWhyPro(false);
                setPaywallVisible(true);
              }}
              onClose={() => setShowWhyPro(false)}
            />
          </View>
        </View>
      </Modal>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUpgrade={() => {
          setPaywallVisible(false);
        }}
        onRestore={() => {
          setPaywallVisible(false);
        }}
      />

      <Modal visible={bulkMoveVisible} transparent animationType="slide" onRequestClose={() => setBulkMoveVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setBulkMoveVisible(false)} activeOpacity={1}>
          <View style={styles.bulkModalSheet}>
            <Text style={styles.bulkModalTitle}>Move to category</Text>
            <TouchableOpacity
              style={styles.bulkModalItem}
              onPress={() => handleBulkMove(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="layers-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.bulkModalItemText}>No category</Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.bulkModalItem}
                onPress={() => handleBulkMove(cat.id)}
                activeOpacity={0.7}
              >
                <Ionicons name={cat.icon_name as any} size={20} color={Colors.textSecondary} />
                <Text style={styles.bulkModalItemText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={bulkTagVisible} transparent animationType="slide" onRequestClose={() => setBulkTagVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setBulkTagVisible(false)} activeOpacity={1}>
          <View style={styles.bulkModalSheet}>
            <Text style={styles.bulkModalTitle}>Add tag to selected</Text>
            {tags.length === 0 ? (
              <Text style={styles.bulkModalEmpty}>No tags yet. Add tags from a document.</Text>
            ) : (
              tags.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  style={styles.bulkModalItem}
                  onPress={() => handleBulkTag(tag.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pricetag-outline" size={20} color={Colors.textSecondary} />
                  <Text style={styles.bulkModalItemText}>{tag.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {searchResultCapped && searchQuery.trim().length > 0 && (
        <View style={styles.resultCapBanner}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.resultCapText}>
            Showing first {displayedDocuments.length} results. Refine your search for more.
          </Text>
        </View>
      )}

      <FlatList
        data={displayedDocuments}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderDocument}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={<EmptyState searchQuery={searchQuery} fileTypeFilter={fileTypeFilter} />}
      />
    </SafeAreaView>
  );
}

function EmptyState({ searchQuery, fileTypeFilter }: { searchQuery: string; fileTypeFilter: FileType | 'all' }) {
  if (searchQuery) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptySubtitle}>
          No documents matched &quot;{searchQuery}&quot;. Try a different search term.
        </Text>
      </View>
    );
  }

  if (fileTypeFilter !== 'all') {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="filter-outline" size={48} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No documents in this filter</Text>
        <Text style={styles.emptySubtitle}>
          Try switching the file type filter back to &quot;All&quot; or add a new document.
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/capture')}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
          <Text style={styles.emptyButtonText}>Add Document</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="shield-checkmark-outline" size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No documents yet</Text>
      <Text style={styles.emptySubtitle}>
        Scan a receipt, warranty, or ID to start building your secure archive.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/capture')}
        activeOpacity={0.7}
      >
        <Ionicons name="camera-outline" size={18} color={Colors.white} />
        <Text style={styles.emptyButtonText}>Scan Document</Text>
      </TouchableOpacity>
    </View>
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 2,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 0,
  },
  headerQuotaHint: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerQuotaLink: {
    color: Colors.primary,
    fontWeight: Typography.fontWeightSemibold,
    textDecorationLine: 'underline',
  },
  headerIcon: {
    marginRight: 2,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  addButton: {
    padding: Spacing.xs,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(16, 163, 127, 0.15)',
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightMedium,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  sortChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: {
    backgroundColor: 'rgba(16, 163, 127, 0.15)',
    borderColor: Colors.primary,
  },
  sortChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightMedium,
  },
  sortChipTextActive: {
    color: Colors.primary,
  },
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toolbarBtn: {
    padding: Spacing.xs,
  },
  toolbarCancelText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  toolbarTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  toolbarActionText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  bulkActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bulkActionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  bulkActionText: {
    color: Colors.text,
    fontSize: Typography.fontSizeXs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  bulkModalSheet: {
    backgroundColor: Colors.surfaceRaised,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
    maxHeight: '50%',
  },
  bulkModalTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.md,
  },
  bulkModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  bulkModalItemText: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
  },
  bulkModalEmpty: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    paddingVertical: Spacing.lg,
  },
  resultCapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(16, 163, 127, 0.08)',
  },
  resultCapText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeXs,
  },
  list: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  emptyButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
});
