export const FREE_LIMITS = {
  documents: 25,
  categories: 5,
  tags: 10,
} as const;

/** Free OCR base allowance at first launch. */
export const FREE_OCR_BASE_READS = 15;
/** Additional free OCR reads granted per full week after first launch. */
export const FREE_OCR_WEEKLY_BONUS = 2;
/** Kept for backwards compatibility in existing imports/copy. */
export const FREE_OCR_READ_TRIALS = FREE_OCR_BASE_READS;

export function getFreeOcrReadAllowance(firstLaunchAt: number | null, nowMs: number = Date.now()): number {
  if (!Number.isFinite(firstLaunchAt as number) || firstLaunchAt == null) {
    return FREE_OCR_BASE_READS;
  }
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const elapsed = Math.max(0, nowMs - firstLaunchAt);
  const fullWeeks = Math.floor(elapsed / WEEK_MS);
  return FREE_OCR_BASE_READS + fullWeeks * FREE_OCR_WEEKLY_BONUS;
}

export function getOcrReadTrialsRemaining(used: number, firstLaunchAt: number | null = null): number {
  const allowance = getFreeOcrReadAllowance(firstLaunchAt);
  return Math.max(0, allowance - used);
}

export type LimitKind = keyof typeof FREE_LIMITS;

export function getFreeLimit(kind: LimitKind): number {
  return FREE_LIMITS[kind];
}

/** Seeded default categories on first launch — not counted toward Free “custom category” limit (see store addCategory). */
export const SEEDED_DEFAULT_CATEGORIES = 4;

/**
 * Human-readable Free tier rules (keep in sync with enforcement in app-store and UI).
 * Use in Settings, paywall, and anywhere users need transparency.
 */
export const FREE_TIER_RULES: readonly { title: string; detail: string }[] = [
  {
    title: 'Documents (files)',
    detail: `Up to ${FREE_LIMITS.documents} files in your vault (photos, PDFs, Office files, etc.). Each file counts as one document.`,
  },
  {
    title: 'Custom categories',
    detail: `Up to ${FREE_LIMITS.categories} folders you create yourself. The ${SEEDED_DEFAULT_CATEGORIES} starter folders that ship with the app do not count toward this limit.`,
  },
  {
    title: 'Tags',
    detail: `Up to ${FREE_LIMITS.tags} different tags total across the vault.`,
  },
  {
    title: 'Text from photos (read & copy)',
    detail: `Opt-in on Add → Camera or Import (“Text from photo”). On-device extraction; Free starts with ${FREE_OCR_BASE_READS} reads and gets +${FREE_OCR_WEEKLY_BONUS} reads every week. Duplicating a document reuses stored text without spending another read. Once text is stored, vault search can match it. Pro removes this cap.`,
  },
];

/** Short lines for paywall / headers (full detail in FREE_TIER_RULES). */
export const FREE_TIER_ONE_LINERS: readonly string[] = [
  `Up to ${FREE_LIMITS.documents} files in your vault`,
  `Up to ${FREE_LIMITS.categories} folders you create (${SEEDED_DEFAULT_CATEGORIES} starter folders don’t count)`,
  `Up to ${FREE_LIMITS.tags} different tags`,
  `${FREE_OCR_BASE_READS} free “Text from photo” reads to start, plus +${FREE_OCR_WEEKLY_BONUS} each week; vault search matches extracted text`,
];

/** Features that are Pro-only (not numeric limits). */
export const PRO_ONLY_FEATURES: readonly string[] = [
  'Backup vault to a .zip file and restore from it',
  'Long-press to select multiple documents; bulk delete, move, tag, or zip-share',
  'Duplicate a document in one tap',
  'Multi-page camera scan (several photos combined into one PDF)',
  'Full library of AI prompt templates (Free includes one template per category)',
];

export function getLimitReachedCopy(kind: LimitKind): {
  title: string;
  body: string;
  footnote: string;
} {
  const n = FREE_LIMITS[kind];
  switch (kind) {
    case 'documents':
      return {
        title: 'Document limit reached',
        body: `The Free plan includes up to ${n} files in your vault. To add more, free a slot by deleting or merging documents, or unlock Pro for unlimited storage.`,
        footnote: 'Each file you save counts toward this limit.',
      };
    case 'categories':
      return {
        title: 'Custom category limit reached',
        body: `On Free you can create up to ${n} new folders of your own. Starter folders that came with the app don’t count. Delete a custom folder you no longer need, or unlock Pro for unlimited categories.`,
        footnote: `Starter folders (${SEEDED_DEFAULT_CATEGORIES}) are separate from this ${n}-folder allowance.`,
      };
    case 'tags':
      return {
        title: 'Tag limit reached',
        body: `On Free you can have up to ${n} different tags in your vault. Remove a tag you don’t use, or unlock Pro for unlimited tags.`,
        footnote: 'Tags are shared across all documents.',
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

