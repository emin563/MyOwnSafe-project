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
} from '@/db/documents';

type AppStore = {
  categories: Category[];
  documents: Document[];
  selectedCategoryId: number | null;
  searchQuery: string;
  isDbReady: boolean;

  setDbReady: (ready: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (id: number | null) => void;

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
};

export const useAppStore = create<AppStore>((set, get) => ({
  categories: [],
  documents: [],
  selectedCategoryId: null,
  searchQuery: '',
  isDbReady: false,

  setDbReady: (ready) => set({ isDbReady: ready }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),

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
    const id = await createDocument(title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes);
    await get().loadDocuments();
    return id;
  },

  editDocument: async (id, title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes) => {
    await updateDocument(id, title, fileUri, fileType, categoryId, purchasePrice, expiryDate, notes);
    await get().loadDocuments();
  },

  removeDocument: async (id) => {
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
