import {
    createCategory,
    deleteCategory,
    getCategories,
    getTotalCategoryCount,
    updateCategory,
} from '@/db/categories';
import {
    createDocument,
    deleteDocument,
    getDocumentById,
    getDocuments,
    getTotalFileCount,
    searchDocuments,
    updateDocument,
    updateDocumentNotificationId,
    updateDocumentOcrText,
} from '@/db/documents';
import { getSetting, getSettings, setSetting } from '@/db/settings';
import {
    addTagsToDocument,
    addTagToDocument,
    addTagToDocuments,
    createTag,
    deleteTag,
    getAllTags,
    getDocumentsByTag,
    getOrCreateTagByName,
    getTagIdByName,
    getTagsForDocument,
    getTotalTagCount,
    removeTagFromDocument,
    updateTag,
} from '@/db/tags';
import type { Category, Document, FileType, Tag } from '@/db/types';
import { maybeUploadVaultDocumentToGoogleDrive } from '@/services/GoogleDriveSync';
import { LimitError } from '@/services/LimitError';
import { getFreeLimit, getOcrReadTrialsRemaining, SEEDED_DEFAULT_CATEGORIES } from '@/services/limits';
import type { MlKitScannerMode } from '@/services/mlKitScannerMode';
import { normalizeMlKitScannerMode } from '@/services/mlKitScannerMode';
import {
    cancelNotification,
    scheduleExpiryNotification,
} from '@/services/NotificationService';
import { extractTextFromImageIfAvailable } from '@/services/ocrExtract';
import type { OcrLanguageCode } from '@/services/ocrLanguages';
import { normalizeOcrLanguageCode } from '@/services/ocrLanguages';
import {
    purchasePro as rcPurchasePro,
    restorePurchases as rcRestorePurchases,
    syncProEntitlementFromRevenueCat,
} from '@/services/PurchaseService';
import { clearQuizWhyProData } from '@/services/quizWhyProStorage';
import { copyFileInArchive } from '@/services/StorageService';
import { create } from 'zustand';

/** Dev-only override; `null` means use RevenueCat / Play entitlement. */
export type DevProPreview = null | 'force_free' | 'force_pro';

const SETTING_PRO_BILLING = 'proBillingEntitled';
const SETTING_DEV_PRO_PREVIEW = 'devProPreview';
const SETTING_PRIVACY_ONBOARDING = 'privacyOnboardingCompleted';

export function computeEffectivePro(
  billingProEntitled: boolean,
  devProPreview: DevProPreview
): boolean {
  if (devProPreview !== null) {
    return devProPreview === 'force_pro';
  }
  return billingProEntitled;
}

function parseDevProPreviewRaw(raw: string | null): DevProPreview {
  if (raw === 'force_free' || raw === 'force_pro') return raw;
  return null;
}

async function loadBillingEntitledFromSettings(): Promise<boolean> {
  let v = await getSetting(SETTING_PRO_BILLING);
  if (v == null) {
    const legacy = await getSetting('isPro');
    v = legacy === 'true' ? 'true' : 'false';
    await setSetting(SETTING_PRO_BILLING, v);
  }
  return v === 'true';
}

type AppStore = {
  categories: Category[];
  documents: Document[];
  tags: Tag[];
  selectedCategoryId: number | null;
  selectedTagId: number | null;
  searchQuery: string;
  searchResultCapped: boolean;
  sortBy: 'newest' | 'oldest' | 'expiring' | 'name';

  // Bulk selection (transient)
  selectionMode: boolean;
  selectedIds: number[];
  setSelectionMode: (on: boolean) => void;
  toggleSelected: (id: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isDbReady: boolean;

  // Pro — isPro is effective (billing + optional dev preview); billingProEntitled is from RevenueCat
  isPro: boolean;
  /** Last known Play / RevenueCat entitlement (ignores dev preview). */
  billingProEntitled: boolean;
  /** __DEV__ only: simulate Free or Pro without overwriting billing sync. */
  devProPreview: DevProPreview;
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
  /** Consume up to `count` Free OCR trials in one write; returns number actually consumed. */
  consumeOcrReadTrials: (count: number) => Promise<number>;
  /** Dev only: reset free OCR trials counter for testing. */
  resetOcrReadTrialsForDev: () => Promise<void>;
  /** User dismissed multi-page tested-limit disclaimer. */
  multiPageLimitDisclaimerDismissed: boolean;
  setMultiPageLimitDisclaimerDismissed: (dismissed: boolean) => Promise<void>;
  /** User dismissed Google multi-page scanner 100-page warning. */
  mlKitMultiPageWarningDismissed: boolean;
  setMlKitMultiPageWarningDismissed: (dismissed: boolean) => Promise<void>;
  /** User dismissed Add flow tip about flat surface + lighting for ML Kit auto-scan. */
  autoScanSurfaceTipDismissed: boolean;
  setAutoScanSurfaceTipDismissed: (dismissed: boolean) => Promise<void>;
  /** User dismissed Settings one-shot notice about Google scanner / Drive and privacy. */
  googleExtensionsPrivacyTipDismissed: boolean;
  setGoogleExtensionsPrivacyTipDismissed: (dismissed: boolean) => Promise<void>;
  /** True after first `loadSettings()` completes (for onboarding gate). */
  settingsHydrated: boolean;
  /** First-run privacy & permissions introduction; migrated to done for existing vaults. */
  privacyOnboardingCompleted: boolean;
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

  loadCategories: () => Promise<void>;
  addCategory: (name: string, iconName?: string) => Promise<void>;
  editCategory: (id: number, name: string, iconName?: string) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;

  /**
   * Increments when document↔tag links change (add/remove/bulk/global delete/rename).
   * Home list uses this to refresh per-document tag chips without relying only on document ID sets.
   */
  documentTagLinksVersion: number;

  loadTags: () => Promise<void>;
  addTag: (name: string) => Promise<number>;
  editTag: (id: number, name: string) => Promise<void>;
  removeTag: (id: number) => Promise<void>;
  tagDocument: (documentId: number, tagId: number) => Promise<void>;
  /** Apply one tag to many documents in a single batched INSERT (bulk toolbar). */
  tagDocuments: (documentIds: number[], tagId: number) => Promise<void>;
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
    options?: { copyOcrFromSource?: string; preOcrText?: string; skipReload?: boolean }
  ) => Promise<number>;
  editDocument: (
    id: number,
    title: string,
    fileUri: string,
    fileType: FileType,
    categoryId: number | null,
    purchasePrice?: number | null,
    expiryDate?: string | null,
    notes?: string | null,
    options?: { skipReload?: boolean }
  ) => Promise<void>;
  removeDocument: (id: number, options?: { skipReload?: boolean }) => Promise<void>;
  duplicateDocument: (id: number) => Promise<number>;
  runSearch: (query: string) => Promise<void>;

  // Settings
  loadSettings: () => Promise<void>;
  completePrivacyOnboarding: () => Promise<void>;
  /** __DEV__ only: set Free/Pro simulation; pass null to follow store entitlement. */
  setDevProPreview: (preview: DevProPreview) => Promise<void>;
  /** Trigger a real RevenueCat purchase and update Pro state on success. */
  purchasePro: () => Promise<{ success: boolean; cancelled?: boolean; message?: string }>;
  /** Restore a previous purchase via RevenueCat. */
  restorePro: () => Promise<{ success: boolean; message?: string }>;
  /** Check RevenueCat entitlements and sync local Pro state. */
  syncProStatus: () => Promise<void>;

  setPendingBulkImports: (items: { fileUri: string; fileType: FileType; name?: string }[]) => void;
  clearPendingBulkImports: () => void;
};

let _ocrTrialLock = false;

export const useAppStore = create<AppStore>((set, get) => ({
  categories: [],
  documents: [],
  tags: [],
  documentTagLinksVersion: 0,
  selectedCategoryId: null,
  selectedTagId: null,
  searchQuery: '',
  searchResultCapped: false,
  sortBy: 'newest',
  selectionMode: false,
  selectedIds: [],

  isDbReady: false,
  isPro: false,
  billingProEntitled: false,
  devProPreview: null,
  firstLaunchAt: null,
  isIntroEligible: false,
  vaultName: 'My Vault',
  vaultNamePromptVisible: false,
  ocrExtractOnCapture: false,
  ocrReadTrialsUsed: 0,
  multiPageLimitDisclaimerDismissed: false,
  mlKitMultiPageWarningDismissed: false,
  autoScanSurfaceTipDismissed: false,
  googleExtensionsPrivacyTipDismissed: false,
  settingsHydrated: false,
  privacyOnboardingCompleted: false,
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

  completePrivacyOnboarding: async () => {
    await setSetting(SETTING_PRIVACY_ONBOARDING, '1');
    set({ privacyOnboardingCompleted: true });
  },

  loadSettings: async () => {
    const billingProEntitled = await loadBillingEntitledFromSettings();
    const settings = await getSettings([
      SETTING_DEV_PRO_PREVIEW,
      'firstLaunchAt',
      'vaultName',
      'vaultNamePromptSeen',
      'ocrExtractOnCapture',
      'ocrReadTrialsUsed',
      'multiPageLimitDisclaimerDismissed',
      'mlKitMultiPageWarningDismissed',
      'autoScanSurfaceTipDismissed',
      'googleExtensionsPrivacyTipDismissed',
      'ocrProcessingMode',
      'ocrLanguage',
      'mlKitScannerMode',
      SETTING_PRIVACY_ONBOARDING,
    ]);

    const devRaw = settings[SETTING_DEV_PRO_PREVIEW];
    const devProPreview = __DEV__ ? parseDevProPreviewRaw(devRaw) : null;
    const isPro = computeEffectivePro(billingProEntitled, devProPreview);
    const firstLaunchAtVal = settings.firstLaunchAt;
    const vaultNameVal = settings.vaultName;
    const vaultNamePromptSeenVal = settings.vaultNamePromptSeen;
    const ocrExtractVal = settings.ocrExtractOnCapture;
    const ocrReadTrialsUsedVal = settings.ocrReadTrialsUsed;
    const multiPageLimitDisclaimerDismissedVal = settings.multiPageLimitDisclaimerDismissed;
    const mlKitMultiPageWarningDismissedVal = settings.mlKitMultiPageWarningDismissed;
    const autoScanSurfaceTipDismissedVal = settings.autoScanSurfaceTipDismissed;
    const googleExtensionsPrivacyTipDismissedVal = settings.googleExtensionsPrivacyTipDismissed;
    const ocrProcessingModeVal = settings.ocrProcessingMode;
    const ocrLanguageVal = settings.ocrLanguage;
    const mlKitScannerModeVal = settings.mlKitScannerMode;
    const privacyOnboardingRaw = settings[SETTING_PRIVACY_ONBOARDING];
    let privacyOnboardingCompleted = false;
    if (privacyOnboardingRaw === '1') {
      privacyOnboardingCompleted = true;
    } else if (privacyOnboardingRaw == null) {
      const docCount = await getTotalFileCount();
      const vaultSeen = vaultNamePromptSeenVal === 'true';
      if (docCount > 0 || vaultSeen) {
        await setSetting(SETTING_PRIVACY_ONBOARDING, '1');
        privacyOnboardingCompleted = true;
      } else {
        privacyOnboardingCompleted = false;
      }
    } else {
      privacyOnboardingCompleted = true;
    }
    const savedVaultName = (vaultNameVal ?? '').trim();
    const vaultName = savedVaultName || 'My Vault';
    const vaultNamePromptSeen = vaultNamePromptSeenVal === 'true';
    const ocrExtractOnCapture = ocrExtractVal === 'true';
    const multiPageLimitDisclaimerDismissed = multiPageLimitDisclaimerDismissedVal === 'true';
    const mlKitMultiPageWarningDismissed = mlKitMultiPageWarningDismissedVal === 'true';
    const autoScanSurfaceTipDismissed = autoScanSurfaceTipDismissedVal === 'true';
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
    if (!savedVaultName) {
      await setSetting('vaultName', vaultName);
    }
    set({
      billingProEntitled,
      devProPreview,
      isPro,
      firstLaunchAt,
      isIntroEligible,
      vaultName,
      vaultNamePromptVisible: !vaultNamePromptSeen,
      ocrExtractOnCapture,
      multiPageLimitDisclaimerDismissed,
      mlKitMultiPageWarningDismissed,
      autoScanSurfaceTipDismissed,
      googleExtensionsPrivacyTipDismissed,
      privacyOnboardingCompleted,
      settingsHydrated: true,
      ocrProcessingMode,
      ocrLanguage,
      mlKitScannerMode,
      ocrReadTrialsUsed,
    });

    syncProEntitlementFromRevenueCat()
      .then(async (result) => {
        if (result === 'unknown') return;
        const entitled = result === 'entitled';
        const s = get();
        if (entitled) {
          await clearQuizWhyProData();
        }
        if (entitled === s.billingProEntitled) return;
        await setSetting(SETTING_PRO_BILLING, String(entitled));
        set({
          billingProEntitled: entitled,
          isPro: computeEffectivePro(entitled, s.devProPreview),
        });
      })
      .catch(() => {});
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

  setDevProPreview: async (preview) => {
    if (!__DEV__) return;
    await setSetting(SETTING_DEV_PRO_PREVIEW, preview === null ? '' : preview);
    const billing = get().billingProEntitled;
    set({ devProPreview: preview, isPro: computeEffectivePro(billing, preview) });
  },

  purchasePro: async () => {
    const result = await rcPurchasePro();
    if (result.success) {
      await setSetting(SETTING_PRO_BILLING, 'true');
      await clearQuizWhyProData();
      const s = get();
      set({
        billingProEntitled: true,
        isPro: computeEffectivePro(true, s.devProPreview),
      });
    }
    return result;
  },

  restorePro: async () => {
    const result = await rcRestorePurchases();
    if (result.success) {
      await setSetting(SETTING_PRO_BILLING, 'true');
      await clearQuizWhyProData();
      const s = get();
      set({
        billingProEntitled: true,
        isPro: computeEffectivePro(true, s.devProPreview),
      });
    }
    return result;
  },

  syncProStatus: async () => {
    const result = await syncProEntitlementFromRevenueCat();
    if (result === 'unknown') return;
    const entitled = result === 'entitled';
    await setSetting(SETTING_PRO_BILLING, String(entitled));
    if (entitled) {
      await clearQuizWhyProData();
    }
    const s = get();
    set({
      billingProEntitled: entitled,
      isPro: computeEffectivePro(entitled, s.devProPreview),
    });
  },

  setOcrExtractOnCapture: async (enabled) => {
    await setSetting('ocrExtractOnCapture', String(enabled));
    set({ ocrExtractOnCapture: enabled });
  },

  setPendingOcrText: (draft) => set({ pendingOcrText: draft }),
  clearPendingOcrText: () => set({ pendingOcrText: null }),

  consumeOcrReadTrials: async (count) => {
    const requested = Math.max(0, Math.floor(count));
    if (requested <= 0) return 0;
    if (get().isPro) return requested;
    if (_ocrTrialLock) return 0;

    _ocrTrialLock = true;
    try {
      const usedBefore = get().ocrReadTrialsUsed;
      const remaining = getOcrReadTrialsRemaining(usedBefore, get().firstLaunchAt);
      const toConsume = Math.min(requested, Math.max(0, remaining));
      if (toConsume <= 0) return 0;
      const next = usedBefore + toConsume;
      await setSetting('ocrReadTrialsUsed', String(next));
      set({ ocrReadTrialsUsed: next });
      return toConsume;
    } finally {
      _ocrTrialLock = false;
    }
  },

  consumeOcrReadTrial: async () => {
    if (get().isPro) return true;
    const consumed = await get().consumeOcrReadTrials(1);
    return consumed === 1;
  },

  resetOcrReadTrialsForDev: async () => {
    if (!__DEV__) return;
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

  setAutoScanSurfaceTipDismissed: async (dismissed) => {
    await setSetting('autoScanSurfaceTipDismissed', String(dismissed));
    set({ autoScanSurfaceTipDismissed: dismissed });
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

  editTag: async (id, name) => {
    await updateTag(id, name);
    await get().loadTags();
    set((s) => ({ documentTagLinksVersion: s.documentTagLinksVersion + 1 }));
    if (get().selectedTagId === id) {
      await get().loadDocumentsByTag(id);
    }
  },

  removeTag: async (id) => {
    await deleteTag(id);
    const { selectedTagId } = get();
    if (selectedTagId === id) {
      set({ selectedTagId: null });
      await get().loadDocuments(null);
    }
    await get().loadTags();
    set((s) => ({ documentTagLinksVersion: s.documentTagLinksVersion + 1 }));
  },

  tagDocument: async (documentId, tagId) => {
    await addTagToDocument(documentId, tagId);
    set((s) => ({ documentTagLinksVersion: s.documentTagLinksVersion + 1 }));
  },

  tagDocuments: async (documentIds, tagId) => {
    await addTagToDocuments(documentIds, tagId);
    set((s) => ({ documentTagLinksVersion: s.documentTagLinksVersion + 1 }));
  },

  untagDocument: async (documentId, tagId) => {
    await removeTagFromDocument(documentId, tagId);
    set((s) => ({ documentTagLinksVersion: s.documentTagLinksVersion + 1 }));
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
            const consumed = await get().consumeOcrReadTrials(needed);
            if (consumed !== needed) {
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

    if (!options?.skipReload) {
      await get().loadDocuments();
    }
    return docId;
  },

  editDocument: async (id, title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes, options) => {
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

    if (!options?.skipReload) {
      await get().loadDocuments();
    }
  },

  removeDocument: async (id, options) => {
    const existing = get().documents.find((d) => d.id === id);
    if (existing?.notification_id) {
      try {
        await cancelNotification(existing.notification_id);
      } catch {
        // ignore
      }
    }
    await deleteDocument(id);
    if (!options?.skipReload) {
      await get().loadDocuments();
    }
  },

  duplicateDocument: async (id) => {
    const doc = await getDocumentById(id);
    if (!doc) throw new Error('Document not found');
    const newUri = await copyFileInArchive(doc.file_uri, doc.file_uri.split('.').pop());
    const newTitle = doc.title.trim().startsWith('(Copy)') ? doc.title : `(Copy) ${doc.title}`;
    const copyOcr = doc.ocr_text != null && doc.ocr_text.trim() !== '' ? { copyOcrFromSource: doc.ocr_text } : undefined;
    const addOptions = copyOcr ? { ...copyOcr, skipReload: true } : { skipReload: true };
    const newId = await get().addDocument(
      newTitle,
      newUri,
      doc.file_type,
      doc.category_id,
      doc.purchase_price ?? null,
      doc.expiry_date ?? null,
      doc.notes ?? null,
      addOptions
    );
    const tags = await getTagsForDocument(id);
    await addTagsToDocument(newId, tags.map((tag) => tag.id));
    set((s) => ({ documentTagLinksVersion: s.documentTagLinksVersion + 1 }));
    await get().loadDocuments();
    return newId;
  },

  runSearch: async (query) => {
    if (!query.trim()) {
      set({ searchResultCapped: false });
      await get().loadDocuments();
      return;
    }
    const SEARCH_LIMIT = 200;
    const list = await searchDocuments(query, true, SEARCH_LIMIT);
    const capped = list.length >= SEARCH_LIMIT;
    const sortBy = get().sortBy;
    if (sortBy === 'newest') {
      set({ documents: list, searchResultCapped: capped });
      return;
    }
    const sorted = sortDocumentsBy(list, sortBy);
    set({ documents: sorted, searchResultCapped: capped });
  },
}));

function sortDocumentsBy(
  docs: Document[],
  sortBy: 'newest' | 'oldest' | 'expiring' | 'name'
): Document[] {
  if (docs.length <= 1) return [...docs];
  switch (sortBy) {
    case 'newest':
    case 'oldest': {
      const stamped = docs.map((d) => ({ d, ms: new Date(d.updated_at).getTime() }));
      stamped.sort((a, b) => (sortBy === 'newest' ? b.ms - a.ms : a.ms - b.ms));
      return stamped.map((s) => s.d);
    }
    case 'name':
      return [...docs].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    case 'expiring':
      return [...docs].sort((a, b) => {
        const aExp = a.expiry_date ?? '9999-12-31';
        const bExp = b.expiry_date ?? '9999-12-31';
        return aExp.localeCompare(bExp);
      });
    default:
      return [...docs];
  }
}
