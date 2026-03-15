import { create } from 'zustand';
import type { Category, Document, FileType, Tag } from '@/db/types';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
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
} from '@/db/tags';
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  searchDocuments,
  updateDocumentNotificationId,
} from '@/db/documents';
import { getSetting, setSetting } from '@/db/settings';
import {
  scheduleExpiryNotification,
  cancelNotification,
} from '@/services/NotificationService';
import { copyFileInArchive } from '@/services/StorageService';

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
  biometricEnabled: boolean;

  // Pro
  isPro: boolean;

  // Bulk import (multi-file pick → review screen)
  pendingBulkImports: { fileUri: string; fileType: FileType }[];

  setDbReady: (ready: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (id: number | null) => void;
  setSelectedTagId: (id: number | null) => void;
  setSortBy: (sort: 'newest' | 'oldest' | 'expiring' | 'name') => void;

  setSelectionMode: (on: boolean) => void;
  toggleSelected: (id: number) => void;
  selectAll: () => void;
  clearSelection: () => void;

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
    notes?: string | null
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
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setIsPro: (value: boolean) => Promise<void>;

  setPendingBulkImports: (items: { fileUri: string; fileType: FileType }[]) => void;
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
  biometricEnabled: false,
  isPro: false,
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

  setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),

  loadSettings: async () => {
    const pinEnabledVal = await getSetting('pinEnabled');
    const pinHash = await getSetting('pinHash');
    const biometricVal = await getSetting('biometricEnabled');
    const proVal = await getSetting('isPro');
    const pinEnabled = pinEnabledVal === 'true';
    const biometricEnabled = biometricVal === 'true';
    const isPro = proVal === 'true';
    const lockActive = pinEnabled || biometricEnabled;
    set({ pinEnabled, pinHash, biometricEnabled, isPro, isUnlocked: !lockActive });
  },

  setPinEnabled: async (enabled, pin) => {
    if (enabled && pin) {
      await setSetting('pinHash', pin);
      await setSetting('pinEnabled', 'true');
      set({ pinEnabled: true, pinHash: pin, isUnlocked: true });
    } else {
      await setSetting('pinEnabled', 'false');
      await setSetting('pinHash', '');
      set({ pinEnabled: false, pinHash: null, isUnlocked: true });
    }
  },

  verifyPin: (input) => {
    const { pinHash } = get();
    return pinHash !== null && input === pinHash;
  },

  setBiometricEnabled: async (enabled) => {
    await setSetting('biometricEnabled', String(enabled));
    set({ biometricEnabled: enabled });
    if (!enabled) {
      set({ isUnlocked: true });
    }
  },

  setIsPro: async (value) => {
    await setSetting('isPro', String(value));
    set({ isPro: value });
  },

  setPendingBulkImports: (items) => set({ pendingBulkImports: items }),
  clearPendingBulkImports: () => set({ pendingBulkImports: [] }),

  loadCategories: async () => {
    const categories = await getCategories();
    set({ categories });
  },

  addCategory: async (name, iconName) => {
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
    return getOrCreateTagByName(name);
  },

  addDocument: async (title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes) => {
    const docId = await createDocument(title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes);

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
    const newId = await get().addDocument(
      newTitle,
      newUri,
      doc.file_type,
      doc.category_id,
      doc.purchase_price ?? null,
      doc.expiry_date ?? null,
      doc.notes ?? null
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
    const list = await searchDocuments(query);
    const sorted = sortDocumentsBy(list, get().sortBy);
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
