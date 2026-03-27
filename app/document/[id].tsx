import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/app-store';
import { getDocumentById } from '@/db/documents';
import { getTagsForDocument } from '@/db/tags';
import { deleteFileFromArchive } from '@/services/StorageService';
import { exportDocumentAsPdf } from '@/services/PdfService';
import { UseAiWorkflowSheet } from '@/components/ui';
import { LimitReachedDialog, PaywallModal } from '@/components/ui';
import { isLimitError } from '@/services/LimitError';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import { getOcrReadTrialsRemaining } from '@/services/limits';
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
    showToast,
    tagDocument,
    untagDocument,
    getOrCreateTag,
    ocrExtractOnCapture,
    isPro,
    ocrReadTrialsUsed,
    firstLaunchAt,
    pendingOcrText,
    clearPendingOcrText,
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
  /** Recognized text from image (OCR); null = not loaded or not yet captured */
  const [ocrText, setOcrText] = useState<string | null>(null);
  /** True while we poll DB for OCR after save (async OCR may finish seconds later) */
  const [ocrAwaiting, setOcrAwaiting] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [documentTags, setDocumentTags] = useState<Tag[]>([]);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [limitVisible, setLimitVisible] = useState(false);
  const [pendingNewTagName, setPendingNewTagName] = useState<string | null>(null);
  const [ocrPaywallVisible, setOcrPaywallVisible] = useState(false);
  const [busyText, setBusyText] = useState<string | null>(null);
  const [showBusyOverlay, setShowBusyOverlay] = useState(false);
  const [ocrCurrentPageIdx, setOcrCurrentPageIdx] = useState(0);
  const [ocrZoom, setOcrZoom] = useState(1);
  const [ocrSearchQuery, setOcrSearchQuery] = useState('');

  const ocrReadsRemaining = getOcrReadTrialsRemaining(ocrReadTrialsUsed, firstLaunchAt);
  const ocrQuotaBlocked = !isPro && ocrReadsRemaining <= 0;

  const ocrPages = useMemo(() => {
    const raw = ocrText?.trim();
    if (!raw) return [];

    const markerRe = /^=== Page (\d+) ===$/m;
    if (!markerRe.test(raw)) {
      return [{ pageNumber: 1, content: raw }];
    }

    const lines = raw.split(/\r?\n/);
    const pages: { pageNumber: number; content: string }[] = [];
    let currentPageNumber = 1;
    let current: string[] = [];

    const flush = () => {
      const content = current.join('\n').trim();
      if (content) pages.push({ pageNumber: currentPageNumber, content });
      current = [];
    };

    for (const line of lines) {
      const m = line.match(/^=== Page (\d+) ===$/);
      if (m) {
        flush();
        currentPageNumber = Number.parseInt(m[1], 10) || currentPageNumber;
      } else {
        current.push(line);
      }
    }
    flush();

    return pages.length ? pages : [{ pageNumber: 1, content: raw }];
  }, [ocrText]);

  const getOcrPageQuality = (content: string): 'good' | 'weak' => {
    const text = content.trim();
    if (text.length < 40) return 'weak';
    const letterCount = (text.match(/[A-Za-z\u00C0-\u024F\u0100-\u017F\u0180-\u024F]/g) ?? []).length;
    const ratio = letterCount / Math.max(1, text.length);
    return ratio < 0.35 ? 'weak' : 'good';
  };

  useEffect(() => {
    if (!busyText) {
      setShowBusyOverlay(false);
      return;
    }
    const timeoutId = setTimeout(() => setShowBusyOverlay(true), 1000);
    return () => clearTimeout(timeoutId);
  }, [busyText]);

  useEffect(() => {
    setOcrCurrentPageIdx(0);
    setOcrZoom(1);
    setOcrSearchQuery('');
  }, [ocrText]);

  const loadDocument = useCallback(async () => {
    const doc = await getDocumentById(Number(id));
    if (doc) {
      setTitle(doc.title);
      setFileUri(doc.file_uri);
      setFileType(doc.file_type);
      setCategoryId(doc.category_id);
      setPurchasePrice(doc.purchase_price != null ? String(doc.purchase_price) : '');
      setExpiryDate(doc.expiry_date ?? '');
      setNotes(doc.notes ?? '');
      setOcrText(doc.ocr_text ?? null);
      const docTags = await getTagsForDocument(doc.id);
      setDocumentTags(docTags);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!isNew) {
      loadDocument();
    }
  }, [id, isNew, loadDocument]);

  // Multi-scan flow: the OCR text is pre-extracted before creating the PDF and stored as a
  // temporary "pending" draft so the editor can show/copy it immediately.
  useEffect(() => {
    if (!isNew || !pendingOcrText) return;
    if (pendingOcrText.fileUri === fileUri && pendingOcrText.fileType === fileType) {
      setOcrText(pendingOcrText.ocrText);
    }
    // Only set from the matching draft; do not clear here (we clear on save / unmount).
  }, [isNew, pendingOcrText, fileUri, fileType]);

  useEffect(() => {
    if (!isNew) return;
    return () => {
      clearPendingOcrText();
    };
  }, [isNew, clearPendingOcrText]);

  useFocusEffect(
    useCallback(() => {
      if (!isNew) {
        loadDocument();
      }
    }, [isNew, loadDocument])
  );

  /** Poll for OCR result after async extraction completes (typically 1–5s after save) */
  useEffect(() => {
    if (isNew || fileType !== 'image' || loading) return;
    if (!ocrExtractOnCapture) {
      setOcrAwaiting(false);
      return;
    }
    if (ocrQuotaBlocked) {
      setOcrAwaiting(false);
      return;
    }
    const docId = Number(id);
    if (Number.isNaN(docId)) return;
    if (ocrText !== null && ocrText.trim().length > 0) {
      setOcrAwaiting(false);
      return;
    }

    let attempts = 0;
    setOcrAwaiting(true);
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const getDelayMs = (attempt: number): number => {
      // Adaptive backoff: quick first checks, then relax to reduce DB/battery load.
      if (attempt <= 2) return 1000;
      if (attempt <= 6) return 2000;
      return 3000;
    };

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      const doc = await getDocumentById(docId);
      if (cancelled) return;

      const t = doc?.ocr_text;
      if (t != null && t.trim().length > 0) {
        setOcrText(t);
        setOcrAwaiting(false);
        return;
      }

      if (attempts >= 15) {
        setOcrAwaiting(false);
        return;
      }

      timeoutId = setTimeout(poll, getDelayMs(attempts));
    };

    // First check quickly so users see OCR result sooner when extraction is fast.
    timeoutId = setTimeout(poll, 1000);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, isNew, fileType, ocrExtractOnCapture, loading, ocrText, ocrQuotaBlocked]);

  const handleCopyOcr = async () => {
    if (!ocrText?.trim()) return;
    try {
      await Clipboard.setStringAsync(ocrText);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Could not copy', 'danger');
    }
  };

  const handleCopyOcrPage = async (content: string) => {
    const text = content.trim();
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Page copied to clipboard', 'success');
    } catch {
      showToast('Could not copy page', 'danger');
    }
  };

  const ocrMatchPageIndexes = useMemo(() => {
    const q = ocrSearchQuery.trim().toLocaleLowerCase();
    if (!q) return [];
    const matches: number[] = [];
    for (let i = 0; i < ocrPages.length; i += 1) {
      if (ocrPages[i]?.content?.toLocaleLowerCase().includes(q)) {
        matches.push(i);
      }
    }
    return matches;
  }, [ocrSearchQuery, ocrPages]);

  const ocrCurrentPageHasMatch = useMemo(() => {
    if (!ocrSearchQuery.trim()) return false;
    return ocrMatchPageIndexes.includes(ocrCurrentPageIdx);
  }, [ocrSearchQuery, ocrMatchPageIndexes, ocrCurrentPageIdx]);

  const jumpToNearestMatch = useCallback(
    (direction: 'next' | 'prev') => {
      if (ocrMatchPageIndexes.length === 0) return;
      if (direction === 'next') {
        const next = ocrMatchPageIndexes.find((i) => i > ocrCurrentPageIdx);
        setOcrCurrentPageIdx(next ?? ocrMatchPageIndexes[0]);
        return;
      }
      const prev = [...ocrMatchPageIndexes].reverse().find((i) => i < ocrCurrentPageIdx);
      setOcrCurrentPageIdx(prev ?? ocrMatchPageIndexes[ocrMatchPageIndexes.length - 1]);
    },
    [ocrCurrentPageIdx, ocrMatchPageIndexes]
  );

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
    setBusyText('Saving document...');
    try {
      if (isNew) {
        const preOcrText =
          pendingOcrText?.fileUri === fileUri && pendingOcrText.fileType === fileType
            ? pendingOcrText.ocrText
            : undefined;
        const newId = await addDocument(
          title.trim(),
          fileUri,
          fileType,
          categoryId,
          price,
          expiry,
          notes.trim() || null,
          preOcrText ? { preOcrText } : undefined
        );
        // If tags were selected before saving, attach them now.
        if (documentTags.length > 0) {
          for (const tag of documentTags) {
            await tagDocument(newId, tag.id);
          }
        }
        if (preOcrText) {
          clearPendingOcrText();
        }
      } else {
        await editDocument(Number(id), title.trim(), fileUri, fileType, categoryId, price, expiry, notes.trim() || null);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
      setBusyText(null);
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

  const handleShareToAi = async () => {
    if (!fileUri) return;
    setAiSheetVisible(true);
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
              showToast('Document deleted', 'success');
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
    setBusyText('Duplicating document...');
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newId = await duplicateDocument(Number(id));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Document duplicated', 'success');
      router.replace(`/document/${newId}`);
    } catch {
      Alert.alert('Error', 'Could not duplicate the document.');
    } finally {
      setDuplicating(false);
      setBusyText(null);
    }
  };

  const handleExportPdf = async () => {
    if (!fileUri || isNew) return;
    setBusyText('Exporting PDF...');
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const doc = await getDocumentById(Number(id));
      if (!doc) return;
      const categoryName = categories.find((c) => c.id === doc.category_id)?.name;
      await exportDocumentAsPdf(doc, categoryName);
    } catch {
      Alert.alert('Export Failed', 'Could not generate the PDF. Please try again.');
    } finally {
      setBusyText(null);
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
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {isNew ? 'New Document' : 'Edit Document'}
          </Text>
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
                <TouchableOpacity onPress={handleShareToAi} style={styles.headerBtn} activeOpacity={0.7}>
                  <Ionicons name="sparkles-outline" size={20} color={Colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  style={styles.headerBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Share file"
                >
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
              onPress={() => {
                if (fileType === 'image') setPreviewVisible(true);
                if (fileType === 'pdf' && fileUri) {
                  router.push({ pathname: '/pdf-viewer', params: { uri: fileUri, title } });
                }
              }}
              activeOpacity={fileType === 'image' || fileType === 'pdf' ? 0.8 : 1}
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
                  <Text style={styles.pdfPreviewHint}>
                    {fileType === 'pdf'
                      ? 'Tap to view'
                      : 'Use Open with… in the toolbar to view in another app'}
                  </Text>
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
            </View>
            {documentTags.length > 0 && (
              <View style={styles.tagChipsRow}>
                {documentTags.map((tag) => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagChipText} numberOfLines={1}>{tag.name}</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      onPress={async () => {
                        if (isNew) {
                          setDocumentTags((prev) => prev.filter((t) => t.id !== tag.id));
                          return;
                        }
                        await untagDocument(Number(id), tag.id);
                        const updated = await getTagsForDocument(Number(id));
                        setDocumentTags(updated);
                      }}
                    >
                      <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
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

          {(fileType === 'image' || fileType === 'pdf') && (
            <>
              <View style={styles.divider} />
              <View style={styles.ocrSection}>
                <View style={styles.ocrHeaderRow}>
                  <Text style={styles.ocrSectionTitle}>Text from photo</Text>
                </View>
                <Text style={styles.ocrHint}>
                  {isPro
                    ? 'Copy text from the image as many times as you like.'
                    : `${ocrReadsRemaining} free photo text read${ocrReadsRemaining === 1 ? '' : 's'} left for new documents (Pro: unlimited).`}
                </Text>
                {isNew && (!ocrText || !ocrText.trim()) && (
                  <Text style={styles.ocrPlaceholder}>
                    {isPro
                      ? 'After you save, text can appear here if “Text from photo” is on (Add → Camera or Import).'
                      : ocrReadsRemaining === 0
                        ? 'After you save, text from new photos won’t be extracted—you’re out of free OCR reads for now. Free adds +2 reads weekly, or upgrade to Pro for unlimited.'
                        : `Turn on “Text from photo” on Add → Camera or Import before capturing to read and copy text (${ocrReadsRemaining} free read${ocrReadsRemaining === 1 ? '' : 's'} left).`}
                  </Text>
                )}
                {!isNew &&
                  ocrExtractOnCapture === false &&
                  (ocrText == null || !ocrText.trim()) &&
                  !ocrAwaiting && (
                    <Text style={styles.ocrPlaceholder}>
                      Text wasn’t extracted for this photo (opt-in was off). Enable &quot;Text from photo&quot; on Add →
                      Camera before capturing new photos, or import again with extraction on.
                    </Text>
                  )}
                {!isNew && ocrExtractOnCapture && ocrQuotaBlocked && (ocrText == null || !ocrText.trim()) && !ocrAwaiting && (
                  <View>
                    <Text style={styles.ocrPlaceholder}>
                      You’re out of free photo text reads right now. Free adds +2 reads weekly, or upgrade to Pro for
                      unlimited reads.
                    </Text>
                    <TouchableOpacity
                      style={styles.ocrUpgradeBtn}
                      onPress={() => setOcrPaywallVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.ocrUpgradeBtnText}>Unlock Pro</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!isNew && ocrExtractOnCapture && ocrAwaiting && !(ocrText != null && ocrText.trim().length > 0) && (
                  <Text style={styles.ocrPendingText}>Reading text from photo…</Text>
                )}
                {!isNew &&
                  ocrExtractOnCapture &&
                  !ocrQuotaBlocked &&
                  !ocrAwaiting &&
                  (ocrText == null || !ocrText.trim()) && (
                    <Text style={styles.ocrPlaceholder}>
                      No readable text was detected in this image. Try a clearer photo or better lighting.
                    </Text>
                  )}
                {ocrText != null && ocrText.trim().length > 0 && (
                  <>
                    {ocrPages.length > 1 && (
                      <View style={styles.ocrToolbar}>
                        <TouchableOpacity
                          style={styles.ocrCopyAllBtn}
                          onPress={handleCopyOcr}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Copy all OCR pages"
                        >
                          <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                          <Text style={styles.ocrCopyAllBtnText}>Copy all pages</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.ocrToolBtn}
                          onPress={() => setOcrZoom((z) => Math.max(0.85, Number((z - 0.1).toFixed(2))))}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove-outline" size={14} color={Colors.text} />
                          <Text style={styles.ocrToolBtnText}>A-</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.ocrToolBtn}
                          onPress={() => setOcrZoom((z) => Math.min(1.7, Number((z + 0.1).toFixed(2))))}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add-outline" size={14} color={Colors.text} />
                          <Text style={styles.ocrToolBtnText}>A+</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.ocrSearchRow}>
                      <View style={styles.ocrSearchInputWrap}>
                        <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
                        <TextInput
                          value={ocrSearchQuery}
                          onChangeText={setOcrSearchQuery}
                          placeholder="Search in OCR text..."
                          placeholderTextColor={Colors.textMuted}
                          selectionColor={Colors.primary}
                          style={styles.ocrSearchInput}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.ocrToolBtn, !ocrSearchQuery.trim() && styles.ocrBookNavBtnDisabled]}
                        onPress={() => jumpToNearestMatch('prev')}
                        disabled={!ocrSearchQuery.trim()}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="chevron-back" size={14} color={Colors.text} />
                        <Text style={styles.ocrToolBtnText}>Prev</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ocrToolBtn, !ocrSearchQuery.trim() && styles.ocrBookNavBtnDisabled]}
                        onPress={() => jumpToNearestMatch('next')}
                        disabled={!ocrSearchQuery.trim()}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.ocrToolBtnText}>Next</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.text} />
                      </TouchableOpacity>
                    </View>
                    {ocrSearchQuery.trim().length > 0 && (
                      <Text style={styles.ocrSearchHint}>
                        {ocrMatchPageIndexes.length === 0
                          ? 'No matches found in OCR pages.'
                          : ocrCurrentPageHasMatch
                            ? `Match found on this page (${ocrMatchPageIndexes.length} page${ocrMatchPageIndexes.length === 1 ? '' : 's'} total).`
                            : `This page has no match. ${ocrMatchPageIndexes.length} matching page${ocrMatchPageIndexes.length === 1 ? '' : 's'} total.`}
                      </Text>
                    )}

                    {ocrPages.length > 1 ? (
                      <View style={styles.ocrBookWrap}>
                        <View style={styles.ocrBookNavRow}>
                          <TouchableOpacity
                            style={[styles.ocrBookNavBtn, ocrCurrentPageIdx === 0 && styles.ocrBookNavBtnDisabled]}
                            onPress={() => setOcrCurrentPageIdx((p) => Math.max(0, p - 1))}
                            disabled={ocrCurrentPageIdx === 0}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="chevron-back" size={16} color={Colors.text} />
                            <Text style={styles.ocrBookNavText}>Prev</Text>
                          </TouchableOpacity>
                          <Text style={styles.ocrBookCounter}>
                            {Math.min(ocrCurrentPageIdx + 1, ocrPages.length)} / {ocrPages.length}
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.ocrBookNavBtn,
                              ocrCurrentPageIdx >= ocrPages.length - 1 && styles.ocrBookNavBtnDisabled,
                            ]}
                            onPress={() => setOcrCurrentPageIdx((p) => Math.min(ocrPages.length - 1, p + 1))}
                            disabled={ocrCurrentPageIdx >= ocrPages.length - 1}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.ocrBookNavText}>Next</Text>
                            <Ionicons name="chevron-forward" size={16} color={Colors.text} />
                          </TouchableOpacity>
                        </View>
                        <View
                          style={[
                            styles.ocrPageCard,
                            { minHeight: 280 },
                            ocrCurrentPageHasMatch && styles.ocrPageCardMatch,
                          ]}
                        >
                          <View style={styles.ocrPageHeader}>
                            <Text style={styles.ocrPageTitle}>Page {ocrPages[ocrCurrentPageIdx]?.pageNumber ?? 1}</Text>
                            <View style={styles.ocrPageHeaderRight}>
                              <View
                                style={[
                                  styles.ocrQualityBadge,
                                  getOcrPageQuality(ocrPages[ocrCurrentPageIdx]?.content ?? '') === 'good'
                                    ? styles.ocrQualityBadgeGood
                                    : styles.ocrQualityBadgeWeak,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.ocrQualityBadgeText,
                                    getOcrPageQuality(ocrPages[ocrCurrentPageIdx]?.content ?? '') === 'good'
                                      ? styles.ocrQualityBadgeTextGood
                                      : styles.ocrQualityBadgeTextWeak,
                                  ]}
                                >
                                  {getOcrPageQuality(ocrPages[ocrCurrentPageIdx]?.content ?? '') === 'good' ? 'Good' : 'Weak'}
                                </Text>
                              </View>
                            <TouchableOpacity
                              style={styles.ocrPageCopyBtn}
                              onPress={() => handleCopyOcrPage(ocrPages[ocrCurrentPageIdx]?.content ?? '')}
                              activeOpacity={0.7}
                              accessibilityRole="button"
                              accessibilityLabel="Copy current OCR page"
                            >
                              <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                              <Text style={styles.ocrPageCopyBtnText}>Copy</Text>
                            </TouchableOpacity>
                            </View>
                          </View>
                          <ScrollView style={styles.ocrPageScroll} contentContainerStyle={styles.ocrPageScrollContent}>
                            <Text
                              style={[
                                styles.ocrPageBody,
                                {
                                  fontSize: Math.round(Typography.fontSizeBase * ocrZoom),
                                  lineHeight: Math.round((Typography.lineHeightBase + 2) * ocrZoom),
                                },
                              ]}
                              selectable
                            >
                              {ocrPages[ocrCurrentPageIdx]?.content ?? ''}
                            </Text>
                          </ScrollView>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.ocrPageCard}>
                        <View style={styles.ocrPageHeader}>
                          <Text style={styles.ocrPageTitle}>Page {ocrPages[0]?.pageNumber ?? 1}</Text>
                          <View style={styles.ocrPageHeaderRight}>
                            <View
                              style={[
                                styles.ocrQualityBadge,
                                getOcrPageQuality(ocrPages[0]?.content ?? '') === 'good'
                                  ? styles.ocrQualityBadgeGood
                                  : styles.ocrQualityBadgeWeak,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.ocrQualityBadgeText,
                                  getOcrPageQuality(ocrPages[0]?.content ?? '') === 'good'
                                    ? styles.ocrQualityBadgeTextGood
                                    : styles.ocrQualityBadgeTextWeak,
                                ]}
                              >
                                {getOcrPageQuality(ocrPages[0]?.content ?? '') === 'good' ? 'Good' : 'Weak'}
                              </Text>
                            </View>
                          <TouchableOpacity
                            style={styles.ocrPageCopyBtn}
                            onPress={() => handleCopyOcrPage(ocrPages[0]?.content ?? '')}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Copy OCR page"
                          >
                            <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                            <Text style={styles.ocrPageCopyBtnText}>Copy</Text>
                          </TouchableOpacity>
                          </View>
                        </View>
                        <ScrollView style={styles.ocrPageScroll} contentContainerStyle={styles.ocrPageScrollContent}>
                          <Text
                            style={[
                              styles.ocrPageBody,
                              {
                                fontSize: Math.round(Typography.fontSizeBase * ocrZoom),
                                lineHeight: Math.round((Typography.lineHeightBase + 2) * ocrZoom),
                              },
                            ]}
                            selectable
                          >
                            {ocrPages[0]?.content ?? ''}
                          </Text>
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}

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
                if (!trimmed) return;
                try {
                  const tagId = await getOrCreateTag(trimmed);
                  if (isNew) {
                    setDocumentTags((prev) => {
                      if (prev.some((t) => t.id === tagId)) return prev;
                      return [...prev, { id: tagId, name: trimmed, created_at: new Date().toISOString() } as any];
                    });
                  } else {
                    await tagDocument(Number(id), tagId);
                    const updated = await getTagsForDocument(Number(id));
                    setDocumentTags(updated);
                  }
                  setTagPickerVisible(false);
                  setNewTagName('');
                  await loadTags();
                } catch (e) {
                  if (isLimitError(e)) {
                    setPendingNewTagName(trimmed);
                    setLimitVisible(true);
                    return;
                  }
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
                    if (isNew) {
                      setDocumentTags((prev) => (prev.some((t) => t.id === item.id) ? prev : [...prev, item]));
                      setTagPickerVisible(false);
                      return;
                    }
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

      <UseAiWorkflowSheet
        visible={aiSheetVisible}
        onClose={() => setAiSheetVisible(false)}
        document={{
          id: isNew ? -1 : Number(id),
          title: title.trim() ? title.trim() : isNew ? 'Untitled' : title,
          fileType,
          categoryName: selectedCategory?.name ?? null,
        }}
        fileUri={fileUri}
      />

      <LimitReachedDialog
        visible={limitVisible}
        kind="tags"
        onClose={() => setLimitVisible(false)}
        onUpgrade={async () => {
          await useAppStore.getState().setIsPro(true);
          if (!pendingNewTagName) return;
          const retryName = pendingNewTagName;
          setPendingNewTagName(null);

          try {
            const tagId = await getOrCreateTag(retryName);
            if (isNew) {
              setDocumentTags((prev) => {
                if (prev.some((t) => t.id === tagId)) return prev;
                return [
                  ...prev,
                  { id: tagId, name: retryName, created_at: new Date().toISOString() } as any,
                ];
              });
            } else {
              await tagDocument(Number(id), tagId);
              const updated = await getTagsForDocument(Number(id));
              setDocumentTags(updated);
            }
            setTagPickerVisible(false);
            setNewTagName('');
            await loadTags();
          } catch {
            // ignore
          }
        }}
        onManage={() => router.replace('/(drawer)')}
      />

      <PaywallModal
        visible={ocrPaywallVisible}
        onClose={() => setOcrPaywallVisible(false)}
        onUpgrade={() => {
          void useAppStore.getState().setIsPro(true);
          setOcrPaywallVisible(false);
        }}
        onRestore={() => {
          void useAppStore.getState().setIsPro(true);
          setOcrPaywallVisible(false);
        }}
      />
      <Modal visible={showBusyOverlay} transparent animationType="fade">
        <View style={styles.busyOverlay}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.busyBody}>Loading, this may take a few minutes</Text>
          </View>
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
  ocrSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.base,
    gap: Spacing.sm,
  },
  ocrHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ocrSectionTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  ocrCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  ocrCopyBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
  },
  ocrToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  ocrPageCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.xs,
  },
  ocrPageCardMatch: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.08)',
  },
  ocrPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ocrPageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ocrPageTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
  },
  ocrPageCounter: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
  ocrPageBody: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase + 2,
  },
  ocrPageScroll: {
    flex: 1,
  },
  ocrPageScrollContent: {
    paddingBottom: Spacing.sm,
  },
  ocrSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  ocrSearchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    minHeight: 34,
  },
  ocrSearchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    paddingVertical: 0,
  },
  ocrSearchHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
  ocrCopyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
  },
  ocrCopyAllBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
  },
  ocrToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  ocrToolBtnText: {
    color: Colors.text,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
  },
  ocrBookWrap: {
    gap: Spacing.xs,
  },
  ocrBookNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  ocrBookNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  ocrBookNavBtnDisabled: {
    opacity: 0.4,
  },
  ocrBookNavText: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  ocrBookCounter: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
  },
  ocrPageCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  ocrPageCopyBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
  },
  ocrQualityBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
  },
  ocrQualityBadgeGood: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
  },
  ocrQualityBadgeWeak: {
    borderColor: Colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  ocrQualityBadgeText: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
  },
  ocrQualityBadgeTextGood: {
    color: Colors.primary,
  },
  ocrQualityBadgeTextWeak: {
    color: Colors.danger,
  },
  ocrHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    marginBottom: Spacing.xs,
  },
  ocrPlaceholder: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
  },
  ocrPendingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    fontStyle: 'italic',
  },
  ocrBody: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
    marginTop: Spacing.xs,
  },
  ocrUpgradeBtn: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
  },
  ocrUpgradeBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
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
  busyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  busyCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  busyBody: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
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
