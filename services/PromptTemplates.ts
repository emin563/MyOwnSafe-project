import type { FileType } from '@/db/types';
import { PROMPT_TEMPLATES_100, type PromptCategory, type PromptTemplateAsset } from '@/data/promptTemplates';

export type PromptTemplate = PromptTemplateAsset;

export const PROMPT_CATEGORIES: PromptCategory[] = [
  'General',
  'Receipts & Expenses',
  'Warranties & Returns',
  'Contracts & Legal',
  'IDs & Personal Docs',
  'Business & Invoices',
  'Education',
  'Medical',
  'Vehicles & Insurance',
  'Real Estate & Home',
];

// One Free prompt per category: the first template for that category in the registry.
const FREE_PROMPT_IDS = (() => {
  const firstByCategory = new Map<PromptCategory, string>();
  for (const t of PROMPT_TEMPLATES_100) {
    if (!firstByCategory.has(t.category)) {
      firstByCategory.set(t.category, t.id);
    }
  }
  return new Set<string>(Array.from(firstByCategory.values()));
})();

export function isFreePromptTemplate(id: string): boolean {
  return FREE_PROMPT_IDS.has(id);
}

export function normalizeVaultCategoryToPromptCategory(categoryName?: string | null): PromptCategory {
  const s = String(categoryName ?? '').trim().toLowerCase();
  if (!s) return 'General';
  if (s.includes('receipt') || s.includes('expense')) return 'Receipts & Expenses';
  if (s.includes('warrant') || s.includes('return')) return 'Warranties & Returns';
  if (s.includes('contract') || s.includes('legal')) return 'Contracts & Legal';
  if (s.includes('id') || s.includes('passport') || s.includes('personal')) return 'IDs & Personal Docs';
  if (s.includes('invoice') || s.includes('business')) return 'Business & Invoices';
  if (s.includes('school') || s.includes('education') || s.includes('course')) return 'Education';
  if (s.includes('medical') || s.includes('health')) return 'Medical';
  if (s.includes('vehicle') || s.includes('car') || s.includes('insurance')) return 'Vehicles & Insurance';
  if (s.includes('home') || s.includes('real estate') || s.includes('lease')) return 'Real Estate & Home';
  return 'General';
}

export function getAllPromptTemplates(): PromptTemplate[] {
  return PROMPT_TEMPLATES_100;
}

export function getRelevantPromptTemplates(args: {
  fileType: FileType;
  vaultCategoryName?: string | null;
}): PromptTemplate[] {
  const cat = normalizeVaultCategoryToPromptCategory(args.vaultCategoryName);
  // “Browse all” should still be possible even if current doc type/category is different.
  // We sort “relevant” to the top, but we don’t hide other categories/types.
  const list = PROMPT_TEMPLATES_100;
  const relevant = list.filter((t) => t.category === cat && t.supportedTypes.includes(args.fileType));
  const general = list.filter((t) => t.category === 'General' && t.supportedTypes.includes(args.fileType));
  const map = new Map<string, PromptTemplate>();
  for (const t of [...relevant, ...general, ...list]) map.set(t.id, t);
  return Array.from(map.values());
}

export function filterPromptTemplates(args: {
  fileType: FileType;
  vaultCategoryName?: string | null;
  category?: PromptCategory | 'All';
  query?: string;
}): PromptTemplate[] {
  const base = getRelevantPromptTemplates({
    fileType: args.fileType,
    vaultCategoryName: args.vaultCategoryName ?? null,
  });

  const byCat =
    args.category && args.category !== 'All'
      ? base.filter((t) => t.category === args.category)
      : base;

  const q = (args.query ?? '').trim().toLowerCase();
  const out = !q ? byCat : byCat.filter((t) => (t.title + ' ' + t.description).toLowerCase().includes(q));
  return out;
}

export function renderPrompt(
  template: PromptTemplate,
  vars: { docTitle: string; docType: string; categoryName: string }
): string {
  return template.prompt
    .replaceAll('{docTitle}', vars.docTitle)
    .replaceAll('{docType}', vars.docType)
    .replaceAll('{categoryName}', vars.categoryName);
}

