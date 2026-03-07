import { create } from 'zustand';
import type { Category } from '@/db/types';
import type { Prompt } from '@/db/types';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/db/categories';
import {
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  searchPrompts,
} from '@/db/prompts';

type AppStore = {
  categories: Category[];
  prompts: Prompt[];
  selectedCategoryId: number | null;
  searchQuery: string;
  isDbReady: boolean;

  setDbReady: (ready: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (id: number | null) => void;

  loadCategories: () => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  editCategory: (id: number, name: string) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;

  loadPrompts: (categoryId?: number | null) => Promise<void>;
  addPrompt: (title: string, content: string, categoryId: number | null) => Promise<number>;
  editPrompt: (id: number, title: string, content: string, categoryId: number | null) => Promise<void>;
  removePrompt: (id: number) => Promise<void>;
  runSearch: (query: string) => Promise<void>;
};

export const useAppStore = create<AppStore>((set, get) => ({
  categories: [],
  prompts: [],
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

  addCategory: async (name) => {
    await createCategory(name);
    await get().loadCategories();
  },

  editCategory: async (id, name) => {
    await updateCategory(id, name);
    await get().loadCategories();
  },

  removeCategory: async (id) => {
    await deleteCategory(id);
    const { selectedCategoryId } = get();
    if (selectedCategoryId === id) {
      set({ selectedCategoryId: null });
    }
    await get().loadCategories();
    await get().loadPrompts(get().selectedCategoryId);
  },

  loadPrompts: async (categoryId) => {
    const id = categoryId !== undefined ? categoryId : get().selectedCategoryId;
    const prompts = await getPrompts(id);
    set({ prompts });
  },

  addPrompt: async (title, content, categoryId) => {
    const id = await createPrompt(title, content, categoryId);
    await get().loadPrompts();
    return id;
  },

  editPrompt: async (id, title, content, categoryId) => {
    await updatePrompt(id, title, content, categoryId);
    await get().loadPrompts();
  },

  removePrompt: async (id) => {
    await deletePrompt(id);
    await get().loadPrompts();
  },

  runSearch: async (query) => {
    if (!query.trim()) {
      await get().loadPrompts();
      return;
    }
    const prompts = await searchPrompts(query);
    set({ prompts });
  },
}));
