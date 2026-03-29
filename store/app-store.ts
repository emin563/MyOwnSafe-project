import { create } from 'zustand';
import type { Category, Document, FileType, Tag } from '@/db/types';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getTotalCategoryCount,
} from '@/db/categories';
import {
  getAllTags,
  createTag,
  deleteTag,
  getTagsForDocument,
  addTagToDocument,
  removeTagFromDocument,
  getDocumentsByTag,
  getOrCreateTagByName,
  getTagIdByName,
  getTotalTagCount,
} from '@/db/tags';
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  searchDocuments,
  updateDocumentNotificationId,
  updateDocumentOcrText,
  getTotalFileCount,
} from '@/db/documents';
import { getSetting, setSetting } from '@/db/settings';
import type { OcrLanguageCode } from '@/services/ocrLanguages';
import { normalizeOcrLanguageCode } from '@/services/ocrLanguages';
import type { MlKitScannerMode } from '@/services/mlKitScannerMode';
import { normalizeMlKitScannerMode } from '@/services/mlKitScannerMode';
import {
  scheduleExpiryNotification,
  cancelNotification,
} from '@/services/NotificationService';
import { copyFileInArchive } from '@/services/StorageService';
import { maybeUploadVaultDocumentToGoogleDrive } from '@/services/GoogleDriveSync';
import { extractTextFromImageIfAvailable } from '@/services/ocrExtract';
import { getFreeLimit, getOcrReadTrialsRemaining, SEEDED_DEFAULT_CATEGORIES } from '@/services/limits';
import { LimitError } from '@/services/LimitError';
import { authFlags } from '@/store/auth-flags';
type AppStore = {
  categories: Category[];
  documents: Document[];
  tags: Tag[];
  selectedCategoryId: number | null;
  selectedTagId: number | null;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'expiring' | 'name';

  // Bulk selection (transient)
  selectionMode: boolean;
  selectedIds: number[];
  setSelectionMode: (on: boolean) => void;
  toggleSelected: (id: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isDbReady: boolean;

  // Security
  isUnlocked: boolean;
  pinEnabled: boolean;
  pinHash: string | null;

  // Pro
  isPro: boolean;
  /** Timestamp (ms) of the very first app launch, for intro pricing eligibility. */
  firstLaunchAt: number | null;
  /** True when user is within the first 7 days after firstLaunchAt. */
  isIntroEligible: boolean;
  /** User-facing vault name for light personalization. */
  vaultName: string;
  /** One-time onboarding prompt visibility for naming the vault (optional). */
  vaultNamePromptVisible: boolean;
  setVaultName: (name: string) => Promise<void>;
  dismissVaultNamePrompt: () => Promise<void>;

  // OCR: on-device text extraction (opt-in on Add → Camera / Import)
  /** When true, new images may run on-device text extraction (subject to Pro/trials). Off by default — privacy. */
  ocrExtractOnCapture: boolean;
  setOcrExtractOnCapture: (enabled: boolean) => Promise<void>;
  /** Non‑Pro photo text extractions already used (counter increases over time; free allowance also grows weekly). */
  ocrReadTrialsUsed: number;
  /**
   * Temporary OCR draft used for multi-scan (multi-page camera mode) where we extract from the
   * original images, then save the result into the final PDF document.
   */
  pendingOcrText: { fileUri: string; fileType: FileType; ocrText: string } | null;
  setPendingOcrText: (draft: { fileUri: string; fileType: FileType; ocrText: string } | null) => void;
  clearPendingOcrText: () => void;
  /**
   * Consumes one Free OCR read trial when a recognized text result is produced.
   * Returns `true` if a trial was consumed (or user is Pro).
   */
  consumeOcrReadTrial: () => Promise<boolean>;
  /** Dev only: reset free OCR trials counter for testing. */
  resetOcrReadTrialsForDev: () => Promise<void>;
  /** User dismissed multi-page tested-limit disclaimer. */
  multiPageLimitDisclaimerDismissed: boolean;
  setMultiPageLimitDisclaimerDismissed: (dismissed: boolean) => Promise<void>;
  /** User dismissed Google multi-page scanner 100-page warning. */
  mlKitMultiPageWarningDismissed: boolean;
  setMlKitMultiPageWarningDismissed: (dismissed: boolean) => Promise<void>;
  /** User dismissed Settings one-shot notice about Google scanner / Drive and privacy. */
  googleExtensionsPrivacyTipDismissed: boolean;
  setGoogleExtensionsPrivacyTipDismissed: (dismissed: boolean) => Promise<void>;
  ocrProcessingMode: 'auto' | 'document' | 'receipt' | 'handwritten';
  setOcrProcessingMode: (mode: 'auto' | 'document' | 'receipt' | 'handwritten') => Promise<void>;
  ocrLanguage: OcrLanguageCode;
  setOcrLanguage: (lang: OcrLanguageCode) => Promise<void>;
  /** Android Google document scanner UI depth (crop-only vs filters vs full). */
  mlKitScannerMode: MlKitScannerMode;
  setMlKitScannerMode: (mode: MlKitScannerMode) => Promise<void>;

  // Toast (lightweight UX feedback)
  toast: { message: string; type?: 'success' | 'danger' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'danger' | 'info') => void;
  clearToast: () => void;

  // Bulk import (multi-file pick → review screen)
  pendingBulkImports: { fileUri: string; fileType: FileType; name?: string }[];

  setDbReady: (ready: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (id: number | null) => void;
  setSelectedTagId: (id: number | null) => void;
  setSortBy: (sort: 'newest' | 'oldest' | 'expiring' | 'name') => void;

  setUnlocked: (unlocked: boolean) => void;

  loadCategories: () => Promise<void>;
  addCategory: (name: string, iconName?: string) => Promise<void>;
  editCategory: (id: number, name: string, iconName?: string) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;

  loadTags: () => Promise<void>;
  addTag: (name: string) => Promise<number>;
  removeTag: (id: number) => Promise<void>;
  tagDocument: (documentId: number, tagId: number) => Promise<void>;
  untagDocument: (documentId: number, tagId: number) => Promise<void>;
  getOrCreateTag: (name: string) => Promise<number>;

  loadDocuments: (categoryId?: number | null) => Promise<void>;
  loadDocumentsByTag: (tagId: number) => Promise<void>;
  addDocument: (
    title: string,
    fileUri: string,
    fileType: FileType,
    categoryId: number | null,
    purchasePrice?: number | null,
    expiryDate?: string | null,
    notes?: string | null,
    options?: { copyOcrFromSource?: string; preOcrText?: string }
  ) => Promise<number>;
  editDocument: (
    id: number,
    title: string,
    fileUri: string,
    fileType: FileType,
    categoryId: number | null,
    purchasePrice?: number | null,
    expiryDate?: string | null,
    notes?: string | null
  ) => Promise<void>;
  removeDocument: (id: number) => Promise<void>;
  duplicateDocument: (id: number) => Promise<number>;
  runSearch: (query: string) => Promise<void>;

  // Settings
  loadSettings: () => Promise<void>;
  setPinEnabled: (enabled: boolean, pin?: string) => Promise<void>;
  verifyPin: (input: string) => boolean;
  setIsPro: (value: boolean) => Promise<void>;

  setPendingBulkImports: (items: { fileUri: string; fileType: FileType; name?: string }[]) => void;
  clearPendingBulkImports: () => void;
};

export const useAppStore = create<AppStore>((set, get) => ({
  categories: [],
  documents: [],
  tags: [],
  selectedCategoryId: null,
  selectedTagId: null,
  searchQuery: '',
  sortBy: 'newest',
  selectionMode: false,
  selectedIds: [],

  isDbReady: false,
  isUnlocked: false,
  pinEnabled: false,
  pinHash: null,
  isPro: false,
  firstLaunchAt: null,
  isIntroEligible: false,
  vaultName: 'My Vault',
  vaultNamePromptVisible: false,
  ocrExtractOnCapture: false,
  ocrReadTrialsUsed: 0,
  multiPageLimitDisclaimerDismissed: false,
  mlKitMultiPageWarningDismissed: false,
  googleExtensionsPrivacyTipDismissed: false,
  ocrProcessingMode: 'auto',
  ocrLanguage: 'auto',
  mlKitScannerMode: 'base',
  pendingOcrText: null,
  toast: null,
  pendingBulkImports: [],

  setDbReady: (ready) => set({ isDbReady: ready }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id, selectedTagId: null }),
  setSelectedTagId: (id) => set({ selectedTagId: id, selectedCategoryId: null }),
  setSortBy: (sortBy) => {
    set({ sortBy });
    const { documents } = get();
    set({ documents: sortDocumentsBy(documents, sortBy) });
  },

  setSelectionMode: (on) => set({ selectionMode: on, selectedIds: on ? [] : [] }),
  toggleSelected: (id) => {
    const { selectedIds } = get();
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    set({ selectedIds: next });
  },
  selectAll: () => {
    const { documents } = get();
    set({ selectedIds: documents.map((d) => d.id) });
  },
  clearSelection: () => set({ selectionMode: false, selectedIds: [] }),

  setUnlocked: (unlocked) => {
    if (unlocked) {
      authFlags.beginVaultPostInteractionGrace();
    }
    set({ isUnlocked: unlocked });
  },

  loadSettings: async () => {
    const pinEnabledVal = await getSetting('pinEnabled');
    const pinHash = await getSetting('pinHash');
    const proVal = await getSetting('isPro');
    const firstLaunchAtVal = await getSetting('firstLaunchAt');
    const vaultNameVal = await getSetting('vaultName');
    const vaultNamePromptSeenVal = await getSetting('vaultNamePromptSeen');
    const ocrExtractVal = await getSetting('ocrExtractOnCapture');
    const ocrReadTrialsUsedVal = await getSetting('ocrReadTrialsUsed');
    const multiPageLimitDisclaimerDismissedVal = await getSetting('multiPageLimitDisclaimerDismissed');
    const mlKitMultiPageWarningDismissedVal = await getSetting('mlKitMultiPageWarningDismissed');
    const googleExtensionsPrivacyTipDismissedVal = await getSetting('googleExtensionsPrivacyTipDismissed');
    const ocrProcessingModeVal = await getSetting('ocrProcessingMode');
    const ocrLanguageVal = await getSetting('ocrLanguage');
    const mlKitScannerModeVal = await getSetting('mlKitScannerMode');
    const pinEnabled = pinEnabledVal === 'true';
    const isPro = proVal === 'true';
    const savedVaultName = (vaultNameVal ?? '').trim();
    const vaultName = savedVaultName || 'My Vault';
    const vaultNamePromptSeen = vaultNamePromptSeenVal === 'true';
    const ocrExtractOnCapture = ocrExtractVal === 'true';
    const multiPageLimitDisclaimerDismissed = multiPageLimitDisclaimerDismissedVal === 'true';
    const mlKitMultiPageWarningDismissed = mlKitMultiPageWarningDismissedVal === 'true';
    const googleExtensionsPrivacyTipDismissed = googleExtensionsPrivacyTipDismissedVal === 'true';
    const ocrProcessingMode =
      ocrProcessingModeVal === 'document' ||
      ocrProcessingModeVal === 'receipt' ||
      ocrProcessingModeVal === 'handwritten'
        ? ocrProcessingModeVal
        : 'auto';
    const ocrLanguage = normalizeOcrLanguageCode(ocrLanguageVal ?? undefined);
    const mlKitScannerMode = normalizeMlKitScannerMode(mlKitScannerModeVal ?? undefined);
    let ocrReadTrialsUsed = ocrReadTrialsUsedVal != null ? Number.parseInt(ocrReadTrialsUsedVal, 10) : 0;
    if (!Number.isFinite(ocrReadTrialsUsed) || ocrReadTrialsUsed < 0) {
      ocrReadTrialsUsed = 0;
    }
    const now = Date.now();
    let firstLaunchAt = firstLaunchAtVal ? Number(firstLaunchAtVal) : NaN;
    if (!Number.isFinite(firstLaunchAt)) {
      firstLaunchAt = now;
      await setSetting('firstLaunchAt', String(firstLaunchAt));
    }
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isIntroEligible = now - firstLaunchAt < SEVEN_DAYS_MS;
    const lockActive = pinEnabled;
    if (!savedVaultName) {
      await setSetting('vaultName', vaultName);
    }
    if (!lockActive) {
      authFlags.beginVaultPostInteractionGrace();
    }
    set({
      pinEnabled,
      pinHash,
      isPro,
      firstLaunchAt,
      isIntroEligible,
      vaultName,
      vaultNamePromptVisible: !vaultNamePromptSeen,
      ocrExtractOnCapture,
      multiPageLimitDisclaimerDismissed,
      mlKitMultiPageWarningDismissed,
      googleExtensionsPrivacyTipDismissed,
      ocrProcessingMode,
      ocrLanguage,
      mlKitScannerMode,
      ocrReadTrialsUsed,
      isUnlocked: !lockActive,
    });
  },

  setVaultName: async (name) => {
    const next = name.trim() || 'My Vault';
    await setSetting('vaultName', next);
    await setSetting('vaultNamePromptSeen', 'true');
    set({ vaultName: next, vaultNamePromptVisible: false });
  },

  dismissVaultNamePrompt: async () => {
    await setSetting('vaultNamePromptSeen', 'true');
    set({ vaultNamePromptVisible: false });
  },

  setPinEnabled: async (enabled, pin) => {
    if (enabled && pin) {
      await setSetting('pinHash', pin);
      await setSetting('pinEnabled', 'true');
      set({ pinEnabled: true, pinHash: pin, isUnlocked: true });
      authFlags.beginVaultPostInteractionGrace();
    } else {
      await setSetting('pinEnabled', 'false');
      await setSetting('pinHash', '');
      set({ pinEnabled: false, pinHash: null, isUnlocked: true });
      authFlags.beginVaultPostInteractionGrace();
    }
  },

  verifyPin: (input) => {
    const { pinHash } = get();
    return pinHash !== null && input === pinHash;
  },

  setIsPro: async (value) => {
    await setSetting('isPro', String(value));
    set({ isPro: value });
  },

  setOcrExtractOnCapture: async (enabled) => {
    await setSetting('ocrExtractOnCapture', String(enabled));
    set({ ocrExtractOnCapture: enabled });
  },

  setPendingOcrText: (draft) => set({ pendingOcrText: draft }),
  clearPendingOcrText: () => set({ pendingOcrText: null }),

  consumeOcrReadTrial: async () => {
    // Pro does not cap OCR reads.
    if (get().isPro) return true;
    const usedBefore = get().ocrReadTrialsUsed;
    const remaining = getOcrReadTrialsRemaining(usedBefore, get().firstLaunchAt);
    if (remaining <= 0) return false;
    const next = usedBefore + 1;
    await setSetting('ocrReadTrialsUsed', String(next));
    set({ ocrReadTrialsUsed: next });
    return true;
  },

  resetOcrReadTrialsForDev: async () => {
    await setSetting('ocrReadTrialsUsed', '0');
    set({ ocrReadTrialsUsed: 0 });
    get().showToast('OCR free trials reset (dev)', 'success');
  },

  setMultiPageLimitDisclaimerDismissed: async (dismissed) => {
    await setSetting('multiPageLimitDisclaimerDismissed', String(dismissed));
    set({ multiPageLimitDisclaimerDismissed: dismissed });
  },

  setMlKitMultiPageWarningDismissed: async (dismissed) => {
    await setSetting('mlKitMultiPageWarningDismissed', String(dismissed));
    set({ mlKitMultiPageWarningDismissed: dismissed });
  },

  setGoogleExtensionsPrivacyTipDismissed: async (dismissed) => {
    await setSetting('googleExtensionsPrivacyTipDismissed', String(dismissed));
    set({ googleExtensionsPrivacyTipDismissed: dismissed });
  },

  setOcrProcessingMode: async (mode) => {
    await setSetting('ocrProcessingMode', mode);
    set({ ocrProcessingMode: mode });
  },
  setOcrLanguage: async (lang) => {
    const normalized = normalizeOcrLanguageCode(lang);
    await setSetting('ocrLanguage', normalized);
    set({ ocrLanguage: normalized });
  },
  setMlKitScannerMode: async (mode) => {
    const normalized = normalizeMlKitScannerMode(mode);
    await setSetting('mlKitScannerMode', normalized);
    set({ mlKitScannerMode: normalized });
  },

  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
  },
  clearToast: () => set({ toast: null }),

  setPendingBulkImports: (items) => set({ pendingBulkImports: items }),
  clearPendingBulkImports: () => set({ pendingBulkImports: [] }),

  loadCategories: async () => {
    const categories = await getCategories();
    set({ categories });
  },

  addCategory: async (name, iconName) => {
    if (!get().isPro) {
      const count = await getTotalCategoryCount();
      // The DB seeds default categories on first run. Free allows N *additional* categories.
      const userCreated = Math.max(0, count - SEEDED_DEFAULT_CATEGORIES);
      if (userCreated >= getFreeLimit('categories')) {
        throw new LimitError('categories', getFreeLimit('categories'));
      }
    }
    await createCategory(name, iconName);
    await get().loadCategories();
  },

  editCategory: async (id, name, iconName) => {
    await updateCategory(id, name, iconName);
    await get().loadCategories();
  },

  removeCategory: async (id) => {
    await deleteCategory(id);
    const { selectedCategoryId } = get();
    if (selectedCategoryId === id) {
      set({ selectedCategoryId: null });
    }
    await get().loadCategories();
    await get().loadDocuments(get().selectedCategoryId);
  },

  loadDocuments: async (categoryId) => {
    const id = categoryId !== undefined ? categoryId : get().selectedCategoryId;
    const list = await getDocuments(id);
    const sorted = sortDocumentsBy(list, get().sortBy);
    set({ documents: sorted });
  },

  loadDocumentsByTag: async (tagId) => {
    const list = await getDocumentsByTag(tagId);
    const sorted = sortDocumentsBy(list, get().sortBy);
    set({ documents: sorted });
  },

  loadTags: async () => {
    const tags = await getAllTags();
    set({ tags });
  },

  addTag: async (name) => {
    if (!get().isPro) {
      const count = await getTotalTagCount();
      if (count >= getFreeLimit('tags')) {
        throw new LimitError('tags', getFreeLimit('tags'));
      }
    }
    const id = await createTag(name);
    await get().loadTags();
    return id;
  },

  removeTag: async (id) => {
    await deleteTag(id);
    await get().loadTags();
  },

  tagDocument: async (documentId, tagId) => {
    await addTagToDocument(documentId, tagId);
  },

  untagDocument: async (documentId, tagId) => {
    await removeTagFromDocument(documentId, tagId);
  },

  getOrCreateTag: async (name) => {
    const existingId = await getTagIdByName(name);
    if (existingId) return existingId;

    if (!get().isPro) {
      const count = await getTotalTagCount();
      if (count >= getFreeLimit('tags')) {
        throw new LimitError('tags', getFreeLimit('tags'));
      }
    }
    return getOrCreateTagByName(name);
  },

  addDocument: async (title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes, options) => {
    if (!get().isPro) {
      const count = await getTotalFileCount();
      if (count >= getFreeLimit('documents')) {
        throw new LimitError('documents', getFreeLimit('documents'));
      }
    }
    const docId = await createDocument(title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes);

    const copyOcr = options?.copyOcrFromSource?.trim();
    const preOcrText = options?.preOcrText?.trim();

    const estimateOcrPageCount = (text: string): number => {
      // Multi-scan capture format is:
      // === Page 1 ===\n<text>\n\n=== Page 2 ===\n<text>...
      const matches = text.match(/^=== Page \d+ ===$/gm);
      const pageCount = matches ? matches.length : 1;
      return Math.max(1, Math.min(50, pageCount));
    };

    if (fileType === 'pdf') {
      // Multi-scan: OCR is performed on the original images before generating the PDF.
      // Store just persists the pre-extracted text here (no new on-device OCR and no trial consumption).
      if (preOcrText) {
        // Trust boundary: only accept pre-extracted OCR without consuming Free trials when it
        // matches the internal `pendingOcrText` draft. Otherwise, treat it as untrusted input
        // and enforce quota to prevent bypass-by-injection.
        const pending = get().pendingOcrText;
        const isTrustedPendingDraft =
          !!pending &&
          pending.fileUri === fileUri &&
          pending.fileType === fileType &&
          pending.ocrText.trim() === preOcrText;

        if (!get().isPro && !isTrustedPendingDraft) {
          const remaining = getOcrReadTrialsRemaining(get().ocrReadTrialsUsed, get().firstLaunchAt);
          if (remaining <= 0) {
            // Quota exhausted: do not persist OCR text.
          } else {
            const needed = Math.min(remaining, estimateOcrPageCount(preOcrText));
            let allConsumed = true;
            for (let i = 0; i < needed; i++) {
              const consumed = await get().consumeOcrReadTrial();
              if (!consumed) {
                allConsumed = false;
                break;
              }
            }
            if (!allConsumed) {
              // If quota behavior changed mid-loop, avoid persisting OCR without full accounting.
            } else {
              await updateDocumentOcrText(docId, preOcrText);
            }
          }
        } else {
          await updateDocumentOcrText(docId, preOcrText);
        }
      } else if (copyOcr) {
        // Duplication: copy already extracted OCR text.
        await updateDocumentOcrText(docId, copyOcr);
      }
    }

    // OCR: duplicate copies existing stored text — no new on-device read, so free trials are not consumed.
    if (fileType === 'image') {
      if (copyOcr) {
        await updateDocumentOcrText(docId, copyOcr);
      } else if (!get().ocrExtractOnCapture) {
        // Opt-in off: no new extraction (privacy).
      } else if (!get().isPro && getOcrReadTrialsRemaining(get().ocrReadTrialsUsed, get().firstLaunchAt) <= 0) {
        // Free tier exhausted: no new extraction (search still works for docs that already have text).
      } else {
        (async () => {
          const result = await extractTextFromImageIfAvailable(fileUri);
          if (!result.ok) {
            if (result.reason === 'expo-go') {
              try {
                await setSetting('ocrExtractOnCapture', 'false');
                set({ ocrExtractOnCapture: false });
                get().showToast(
                  'Text extraction from photos needs a development build. Turn it on from Add → Camera after installing one.',
                  'info'
                );
              } catch {
                // ignore
              }
              return;
            }
            if (result.reason === 'web') {
              return;
            }
            if (result.reason === 'unsupported') {
              get().showToast('Text recognition is not available on this device.', 'info');
              return;
            }
            if (result.reason === 'error') {
              if (__DEV__) {
                console.warn('[OCR]', result.message);
              }
              get().showToast('Could not read text from this image.', 'info');
            }
            return;
          }
          if (result.text) {
            await updateDocumentOcrText(docId, result.text);
          }
          if (result.text) {
            await get().consumeOcrReadTrial();
          }
        })();
      }
    }

    // Schedule expiry notification if date provided
    if (expiryDate) {
      try {
        const notificationId = await scheduleExpiryNotification({
          id: docId,
          title,
          expiry_date: expiryDate,
        });
        if (notificationId) {
          await updateDocumentNotificationId(docId, notificationId);
        }
      } catch {
        // Notification scheduling is non-critical — never block document save
      }
    }

    void maybeUploadVaultDocumentToGoogleDrive(fileUri, fileType, title, docId);

    await get().loadDocuments();
    return docId;
  },

  editDocument: async (id, title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes) => {
    // Find existing notification_id to cancel the old alert
    const existing = get().documents.find((d) => d.id === id);
    if (existing?.notification_id) {
      try {
        await cancelNotification(existing.notification_id);
      } catch {
        // ignore
      }
    }

    await updateDocument(id, title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes);

    // Schedule new notification
    let newNotificationId: string | null = null;
    if (expiryDate) {
      try {
        newNotificationId = await scheduleExpiryNotification({
          id,
          title,
          expiry_date: expiryDate,
        });
      } catch {
        // non-critical
      }
    }

    await updateDocumentNotificationId(id, newNotificationId);

    void maybeUploadVaultDocumentToGoogleDrive(fileUri, fileType, title, id);

    await get().loadDocuments();
  },

  removeDocument: async (id) => {
    const existing = get().documents.find((d) => d.id === id);
    if (existing?.notification_id) {
      try {
        await cancelNotification(existing.notification_id);
      } catch {
        // ignore
      }
    }
    await deleteDocument(id);
    await get().loadDocuments();
  },

  duplicateDocument: async (id) => {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc) throw new Error('Document not found');
    const newUri = await copyFileInArchive(doc.file_uri, doc.file_uri.split('.').pop());
    const newTitle = doc.title.trim().startsWith('(Copy)') ? doc.title : `(Copy) ${doc.title}`;
    const copyOcr = doc.ocr_text != null && doc.ocr_text.trim() !== '' ? { copyOcrFromSource: doc.ocr_text } : undefined;
    const newId = await get().addDocument(
      newTitle,
      newUri,
      doc.file_type,
      doc.category_id,
      doc.purchase_price ?? null,
      doc.expiry_date ?? null,
      doc.notes ?? null,
      copyOcr
    );
    const tags = await getTagsForDocument(id);
    for (const tag of tags) {
      await addTagToDocument(newId, tag.id);
    }
    await get().loadDocuments();
    return newId;
  },

  runSearch: async (query) => {
    if (!query.trim()) {
      await get().loadDocuments();
      return;
    }
    const list = await searchDocuments(query, true);
    const sortBy = get().sortBy;
    // searchDocuments already orders by updated_at DESC; avoid extra JS sort for "newest".
    if (sortBy === 'newest') {
      set({ documents: list });
      return;
    }
    const sorted = sortDocumentsBy(list, sortBy);
    set({ documents: sorted });
  },
}));

function sortDocumentsBy(
  docs: Document[],
  sortBy: 'newest' | 'oldest' | 'expiring' | 'name'
): Document[] {
  const copy = [...docs];
  switch (sortBy) {
    case 'newest':
      return copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    case 'oldest':
      return copy.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
    case 'name':
      return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    case 'expiring': {
      const now = new Date().toISOString().slice(0, 10);
      return copy.sort((a, b) => {
        const aExp = a.expiry_date ?? '9999-12-31';
        const bExp = b.expiry_date ?? '9999-12-31';
        return aExp.localeCompare(bExp);
      });
    }
    default:
      return copy;
  }
}
