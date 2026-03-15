import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/app-store';
import { getDocumentById } from '@/db/documents';
import { getTagsForDocument } from '@/db/tags';
import { deleteFileFromArchive } from '@/services/StorageService';
import { exportDocumentAsPdf } from '@/services/PdfService';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Category, FileType, Tag } from '@/db/types';

export default function DocumentEditorScreen() {
  const { id, fileUri: paramFileUri, fileType: paramFileType } = useLocalSearchParams<{
    id: string;
    fileUri?: string;
    fileType?: string;
  }>();
  const isNew = id === 'new';

  const {
    categories,
    tags: allTags,
    loadTags,
    selectedCategoryId,
    addDocument,
    editDocument,
    removeDocument,
    duplicateDocument,
    tagDocument,
    untagDocument,
    getOrCreateTag,
  } = useAppStore();

  const [title, setTitle] = useState('');
  const [fileUri, setFileUri] = useState(paramFileUri ?? '');
  const [fileType, setFileType] = useState<FileType>(
    (paramFileType as FileType) ?? 'image'
  );
  const [categoryId, setCategoryId] = useState<number | null>(selectedCategoryId);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [documentTags, setDocumentTags] = useState<Tag[]>([]);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (!isNew) {
      loadDocument();
    }
  }, [id]);

  const loadDocument = async () => {
    const doc = await getDocumentById(Number(id));
    if (doc) {
      setTitle(doc.title);
      setFileUri(doc.file_uri);
      setFileType(doc.file_type);
      setCategoryId(doc.category_id);
      setPurchasePrice(doc.purchase_price != null ? String(doc.purchase_price) : '');
      setExpiryDate(doc.expiry_date ?? '');
      setNotes(doc.notes ?? '');
      const docTags = await getTagsForDocument(doc.id);
      setDocumentTags(docTags);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this document.');
      return;
    }
    if (!fileUri) {
      Alert.alert('No File', 'No file is attached to this document.');
      return;
    }

    const price = purchasePrice.trim() ? parseFloat(purchasePrice) : null;
    if (purchasePrice.trim() && isNaN(price!)) {
      Alert.alert('Invalid Price', 'Please enter a valid number for the purchase price.');
      return;
    }

    const expiry = expiryDate.trim() || null;
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      Alert.alert('Invalid Date', 'Please enter the expiry date in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await addDocument(title.trim(), fileUri, fileType, categoryId, price, expiry, notes.trim() || null);
      } else {
        await editDocument(Number(id), title.trim(), fileUri, fileType, categoryId, price, expiry, notes.trim() || null);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!fileUri) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Sharing.shareAsync(fileUri);
    } catch {
      // ignore
    }
  };

  const handleOpenIn = async () => {
    if (!fileUri) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Sharing.shareAsync(fileUri, { dialogTitle: 'Open with...' });
    } catch {
      // ignore
    }
  };

  const handleSaveToDevice = async () => {
    if (!fileUri) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Sharing.shareAsync(fileUri, { dialogTitle: 'Save to device' });
    } catch {
      // ignore
    }
  };

  const handleDelete = () => {
    if (isNew) return;
    Alert.alert(
      'Delete Document',
      'This document will be permanently removed from your vault.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFileFromArchive(fileUri);
              await removeDocument(Number(id));
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch {
              Alert.alert('Error', 'Could not delete the document.');
            }
          },
        },
      ]
    );
  };

  const handleDuplicate = async () => {
    if (isNew || duplicating) return;
    setDuplicating(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newId = await duplicateDocument(Number(id));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/document/${newId}`);
    } catch {
      Alert.alert('Error', 'Could not duplicate the document.');
    } finally {
      setDuplicating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!fileUri || isNew) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const doc = await getDocumentById(Number(id));
      if (!doc) return;
      const categoryName = categories.find((c) => c.id === doc.category_id)?.name;
      await exportDocumentAsPdf(doc, categoryName);
    } catch {
      Alert.alert('Export Failed', 'Could not generate the PDF. Please try again.');
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isNew ? 'New Document' : 'Edit Document'}</Text>
          <View style={styles.headerRight}>
            {!isNew && (
              <TouchableOpacity
                onPress={() => setCategoryPickerVisible(true)}
                style={styles.headerBtn}
                activeOpacity={0.7}
                accessibilityLabel="Move to category"
              >
                <Ionicons name="folder-open-outline" size={20} color={Colors.text} />
              </TouchableOpacity>
            )}
            {fileUri && !isNew ? (
              <TouchableOpacity onPress={handleExportPdf} style={styles.headerBtn} activeOpacity={0.7}>
                <Ionicons name="document-attach-outline" size={20} color={Colors.text} />
              </TouchableOpacity>
            ) : null}
            {fileUri ? (
              <>
                <TouchableOpacity onPress={handleOpenIn} style={styles.headerBtn} activeOpacity={0.7}>
                  <Ionicons name="open-outline" size={20} color={Colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveToDevice} style={styles.headerBtn} activeOpacity={0.7}>
                  <Ionicons name="download-outline" size={20} color={Colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} style={styles.headerBtn} activeOpacity={0.7}>
                  <Ionicons name="share-outline" size={20} color={Colors.text} />
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* File Preview */}
          {fileUri ? (
            <TouchableOpacity
              style={styles.previewContainer}
              onPress={() => fileType === 'image' && setPreviewVisible(true)}
              activeOpacity={fileType === 'image' ? 0.8 : 1}
            >
              {fileType === 'image' ? (
                <Image
                  source={{ uri: fileUri }}
                  style={styles.previewImage}
                  contentFit="contain"
                  transition={300}
                />
              ) : (
                <View style={styles.pdfPreview}>
                  <Ionicons
                    name={
                      fileType === 'word'
                        ? 'document-text-outline'
                        : fileType === 'excel'
                          ? 'grid-outline'
                          : 'document-outline'
                    }
                    size={48}
                    color={
                      fileType === 'word'
                        ? '#2b579a'
                        : fileType === 'excel'
                          ? '#217346'
                          : fileType === 'document'
                            ? Colors.textMuted
                            : Colors.danger
                    }
                  />
                  <Text style={styles.pdfPreviewText}>
                    {fileType === 'word'
                      ? 'Word Document'
                      : fileType === 'excel'
                        ? 'Excel Spreadsheet'
                        : fileType === 'document'
                          ? 'Document'
                          : 'PDF Document'}
                  </Text>
                  <Text style={styles.pdfPreviewHint}>Tap share or Open in to view</Text>
                </View>
              )}
              {fileType === 'image' && (
                <View style={styles.previewHintRow}>
                  <Ionicons name="expand-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.previewHint}>Tap to view full size</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Title Input */}
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Document title..."
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            autoFocus={isNew}
          />

          <View style={styles.divider} />

          {/* Category Picker */}
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => setCategoryPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="folder-open-outline" size={18} color={Colors.textSecondary} />
            <Text style={[styles.fieldText, selectedCategory && styles.fieldTextActive]}>
              {selectedCategory ? selectedCategory.name : 'Select category (optional)'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Tags */}
          <View style={styles.tagsSection}>
            <View style={styles.fieldRow}>
              <Ionicons name="pricetag-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.fieldText}>Tags</Text>
              {!isNew && (
                <TouchableOpacity
                  style={styles.addTagBtn}
                  onPress={() => {
                    setTagPickerVisible(true);
                    setNewTagName('');
                    loadTags();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={Colors.primary} />
                  <Text style={styles.addTagBtnText}>Add tag</Text>
                </TouchableOpacity>
              )}
            </View>
            {documentTags.length > 0 && (
              <View style={styles.tagChipsRow}>
                {documentTags.map((tag) => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagChipText} numberOfLines={1}>{tag.name}</Text>
                    {!isNew && (
                      <TouchableOpacity
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        onPress={async () => {
                          await untagDocument(Number(id), tag.id);
                          const updated = await getTagsForDocument(Number(id));
                          setDocumentTags(updated);
                        }}
                      >
                        <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Purchase Price */}
          <View style={styles.fieldRow}>
            <Ionicons name="pricetag-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inlineInput}
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              placeholder="Purchase price (optional)"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.divider} />

          {/* Expiry Date */}
          <View style={styles.fieldRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inlineInput}
              value={expiryDate}
              onChangeText={setExpiryDate}
              placeholder="Expiry date YYYY-MM-DD (optional)"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            {expiryDate.length > 0 && (
              <TouchableOpacity onPress={() => setExpiryDate('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {/* Notes */}
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes, serial number, vendor info..."
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />

          {!isNew && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.duplicateBtn}
                onPress={handleDuplicate}
                disabled={duplicating}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={20} color={Colors.primary} />
                <Text style={styles.duplicateBtnText}>{duplicating ? 'Duplicating…' : 'Duplicate document'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                <Text style={styles.deleteBtnText}>Delete document</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <CategoryPicker
        visible={categoryPickerVisible}
        categories={categories}
        selectedId={categoryId}
        onSelect={(cat) => {
          setCategoryId(cat?.id ?? null);
          setCategoryPickerVisible(false);
        }}
        onClose={() => setCategoryPickerVisible(false)}
      />

      <Modal visible={tagPickerVisible} transparent animationType="slide" onRequestClose={() => setTagPickerVisible(false)}>
        <TouchableOpacity
          style={pickerStyles.overlay}
          onPress={() => setTagPickerVisible(false)}
          activeOpacity={1}
        >
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.handle} />
            <Text style={pickerStyles.title}>Add tag</Text>
            <TextInput
              style={pickerStyles.input}
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="Create new tag..."
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              onSubmitEditing={async () => {
                const trimmed = newTagName.trim();
                if (!trimmed || isNew) return;
                try {
                  const tagId = await getOrCreateTag(trimmed);
                  await tagDocument(Number(id), tagId);
                  const updated = await getTagsForDocument(Number(id));
                  setDocumentTags(updated);
                  setTagPickerVisible(false);
                  setNewTagName('');
                  await loadTags();
                } catch {
                  // ignore
                }
              }}
            />
            <FlatList
              data={allTags.filter((t) => !documentTags.some((dt) => dt.id === t.id))}
              keyExtractor={(item) => String(item.id)}
              style={pickerStyles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={pickerStyles.item}
                  onPress={async () => {
                    if (isNew) return;
                    await tagDocument(Number(id), item.id);
                    const updated = await getTagsForDocument(Number(id));
                    setDocumentTags(updated);
                    setTagPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pricetag-outline" size={18} color={Colors.textSecondary} />
                  <Text style={pickerStyles.itemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={pickerStyles.emptyText}>
                  {newTagName.trim() ? 'Press Enter to create tag' : 'No other tags. Create one above.'}
                </Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-screen image preview modal */}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.fullPreviewOverlay}>
          <TouchableOpacity
            style={styles.fullPreviewClose}
            onPress={() => setPreviewVisible(false)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Image
            source={{ uri: fileUri }}
            style={styles.fullPreviewImage}
            contentFit="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type CategoryPickerProps = {
  visible: boolean;
  categories: Category[];
  selectedId: number | null;
  onSelect: (category: Category | null) => void;
  onClose: () => void;
};

function CategoryPicker({ visible, categories, selectedId, onSelect, onClose }: CategoryPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={pickerStyles.sheet}>
          <TouchableOpacity activeOpacity={1}>
            <View style={pickerStyles.handle} />
            <Text style={pickerStyles.title}>Select Category</Text>
            <TouchableOpacity
              style={[pickerStyles.item, selectedId === null && pickerStyles.itemActive]}
              onPress={() => onSelect(null)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="layers-outline"
                size={18}
                color={selectedId === null ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[pickerStyles.itemText, selectedId === null && pickerStyles.itemTextActive]}>
                No category
              </Text>
              {selectedId === null && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
            </TouchableOpacity>
            <View style={pickerStyles.divider} />
            <FlatList
              data={categories}
              keyExtractor={(item) => String(item.id)}
              style={pickerStyles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[pickerStyles.item, selectedId === item.id && pickerStyles.itemActive]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon_name as any}
                    size={18}
                    color={selectedId === item.id ? Colors.primary : Colors.textSecondary}
                  />
                  <Text
                    style={[pickerStyles.itemText, selectedId === item.id && pickerStyles.itemTextActive]}
                  >
                    {item.name}
                  </Text>
                  {selectedId === item.id && (
                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={pickerStyles.emptyText}>No categories. Create one from the sidebar.</Text>
              }
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
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
  headerBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.md,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginLeft: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  previewContainer: {
    margin: Spacing.base,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewImage: {
    width: '100%',
    height: 240,
  },
  previewHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  previewHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
  pdfPreview: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  pdfPreviewText: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  pdfPreviewHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
  },
  titleInput: {
    color: Colors.text,
    fontSize: Typography.fontSizeXl,
    fontWeight: Typography.fontWeightSemibold,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    minHeight: 60,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 52,
  },
  fieldText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  fieldTextActive: {
    color: Colors.text,
  },
  inlineInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    paddingVertical: 0,
  },
  notesInput: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.base,
    minHeight: 140,
  },
  tagsSection: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  addTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
  },
  addTagBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.sm,
    paddingVertical: 4,
    paddingRight: 4,
  },
  tagChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    maxWidth: 120,
  },
  duplicateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  duplicateBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: 'transparent',
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  fullPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPreviewClose: {
    position: 'absolute',
    top: 56,
    right: Spacing.base,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullPreviewImage: {
    width: '100%',
    height: '80%',
  },
});

const pickerStyles = StyleSheet.create({
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
    maxHeight: '60%',
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
  input: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
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
  itemActive: {
    backgroundColor: Colors.surfaceHighlight,
  },
  itemText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  itemTextActive: {
    color: Colors.text,
    fontWeight: Typography.fontWeightMedium,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  list: {
    maxHeight: 300,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
