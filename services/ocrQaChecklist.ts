import { getSetting, setSetting } from '@/db/settings';

const OCR_QA_KEY = 'ocrQaChecklistV1';

export type OcrQaCaseId = 'clean_docs' | 'receipts' | 'low_light' | 'angled_pages' | 'glare_pages';
export type OcrQaStatus = 'pending' | 'pass' | 'fail';
export type OcrQaChecklist = Record<OcrQaCaseId, OcrQaStatus>;

export const OCR_QA_CASES: Array<{ id: OcrQaCaseId; label: string }> = [
  { id: 'clean_docs', label: 'Clean documents' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'low_light', label: 'Low light' },
  { id: 'angled_pages', label: 'Angled pages' },
  { id: 'glare_pages', label: 'Glare pages' },
];

const DEFAULT_QA: OcrQaChecklist = {
  clean_docs: 'pending',
  receipts: 'pending',
  low_light: 'pending',
  angled_pages: 'pending',
  glare_pages: 'pending',
};

function safeParse(raw: string | null): OcrQaChecklist {
  if (!raw) return { ...DEFAULT_QA };
  try {
    const parsed = JSON.parse(raw) as Partial<OcrQaChecklist>;
    const next = { ...DEFAULT_QA };
    for (const c of OCR_QA_CASES) {
      const v = parsed[c.id];
      next[c.id] = v === 'pass' || v === 'fail' ? v : 'pending';
    }
    return next;
  } catch {
    return { ...DEFAULT_QA };
  }
}

export async function getOcrQaChecklist(): Promise<OcrQaChecklist> {
  return safeParse(await getSetting(OCR_QA_KEY));
}

export async function setOcrQaCaseStatus(id: OcrQaCaseId, status: OcrQaStatus): Promise<OcrQaChecklist> {
  const current = await getOcrQaChecklist();
  const next: OcrQaChecklist = { ...current, [id]: status };
  await setSetting(OCR_QA_KEY, JSON.stringify(next));
  return next;
}

export async function resetOcrQaChecklist(): Promise<OcrQaChecklist> {
  await setSetting(OCR_QA_KEY, JSON.stringify(DEFAULT_QA));
  return { ...DEFAULT_QA };
}
