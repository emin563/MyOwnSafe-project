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
  biometricEnabled: boolean;

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
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
};

export const useAppStore = create<AppStore>((set, get) => ({
  categories: [],
  documents: [],
  selectedCategoryId: null,
  searchQuery: '',
  isDbReady: false,
  isUnlocked: false,
  biometricEnabled: false,

  setDbReady: (ready) => set({ isDbReady: ready }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),

  loadSettings: async () => {
    const biometric = await getSetting('biometricEnabled');
    const biometricEnabled = biometric === 'true';
    // If biometrics is disabled, unlock immediately
    set({ biometricEnabled, isUnlocked: !biometricEnabled });
  },

  setBiometricEnabled: async (enabled) => {
    await setSetting('biometricEnabled', String(enabled));
    set({ biometricEnabled: enabled });
    // When disabling, unlock immediately; when enabling, let LockScreen handle it
    if (!enabled) {
      set({ isUnlocked: true });
    }
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
