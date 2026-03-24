import { getSetting, setSetting } from '@/db/settings';

const PDF_LAST_PAGE_KEY = 'pdfLastPageMapV1';
const MAX_TRACKED_PDFS = 120;

type PdfLastPageMap = Record<string, { page: number; updatedAt: number }>;

function safeParse(raw: string | null): PdfLastPageMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PdfLastPageMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function trimOldest(map: PdfLastPageMap): PdfLastPageMap {
  const entries = Object.entries(map);
  if (entries.length <= MAX_TRACKED_PDFS) return map;
  entries.sort((a, b) => (a[1]?.updatedAt ?? 0) - (b[1]?.updatedAt ?? 0));
  const keep = entries.slice(entries.length - MAX_TRACKED_PDFS);
  return Object.fromEntries(keep);
}

export async function getLastPdfPage(uri: string): Promise<number | null> {
  if (!uri) return null;
  const map = safeParse(await getSetting(PDF_LAST_PAGE_KEY));
  const entry = map[uri];
  if (!entry?.page || !Number.isFinite(entry.page)) return null;
  return Math.max(1, Math.floor(entry.page));
}

export async function setLastPdfPage(uri: string, page: number): Promise<void> {
  if (!uri || !Number.isFinite(page) || page < 1) return;
  const map = safeParse(await getSetting(PDF_LAST_PAGE_KEY));
  map[uri] = { page: Math.floor(page), updatedAt: Date.now() };
  await setSetting(PDF_LAST_PAGE_KEY, JSON.stringify(trimOldest(map)));
}
