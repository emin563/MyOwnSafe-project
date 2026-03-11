import { create } from 'zustand';
import type { Category, Document } from '@/db/types';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/db/categories';
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

type AppStore = {
  categories: Category[];
  documents: Document[];
  selectedCategoryId: number | null;
  searchQuery: string;
  isDbReady: boolean;

  // Security
  isUnlocked: boolean;
  pinEnabled: boolean;
  pinHash: string | null;
  biometricEnabled: boolean;

  // Pro
  isPro: boolean;

  setDbReady: (ready: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (id: number | null) => void;
  setUnlocked: (unlocked: boolean) => void;

  loadCategories: () => Promise<void>;
  addCategory: (name: string, iconName?: string) => Promise<void>;
  editCategory: (id: number, name: string, iconName?: string) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;

  loadDocuments: (categoryId?: number | null) => Promise<void>;
  addDocument: (
    title: string,
    fileUri: string,
    fileType: 'image' | 'pdf',
    categoryId: number | null,
    purchasePrice?: number | null,
    expiryDate?: string | null,
    notes?: string | null
  ) => Promise<number>;
  editDocument: (
    id: number,
    title: string,
    fileUri: string,
    fileType: 'image' | 'pdf',
    categoryId: number | null,
    purchasePrice?: number | null,
    expiryDate?: string | null,
    notes?: string | null
  ) => Promise<void>;
  removeDocument: (id: number) => Promise<void>;
  runSearch: (query: string) => Promise<void>;

  // Settings
  loadSettings: () => Promise<void>;
  setPinEnabled: (enabled: boolean, pin?: string) => Promise<void>;
  verifyPin: (input: string) => boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setIsPro: (value: boolean) => Promise<void>;
};

export const useAppStore = create<AppStore>((set, get) => ({
  categories: [],
  documents: [],
  selectedCategoryId: null,
  searchQuery: '',
  isDbReady: false,
  isUnlocked: false,
  pinEnabled: false,
  pinHash: null,
  biometricEnabled: false,
  isPro: false,

  setDbReady: (ready) => set({ isDbReady: ready }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
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
    const documents = await getDocuments(id);
    set({ documents });
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

  runSearch: async (query) => {
    if (!query.trim()) {
      await get().loadDocuments();
      return;
    }
    const documents = await searchDocuments(query);
    set({ documents });
  },
}));
