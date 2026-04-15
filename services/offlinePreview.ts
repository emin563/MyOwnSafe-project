import * as LegacyFS from 'expo-file-system/legacy';
import JSZip from 'jszip';
import type { FileType } from '@/db/types';

const MAX_TEXT_BYTES = 1_500_000;
const MAX_PREVIEW_CHARS = 400_000;
const MAX_OFFICE_FILE_BYTES = 20 * 1024 * 1024; // 20 MiB
const MAX_OFFICE_ARCHIVE_ENTRIES = 4_000;
const MAX_OFFICE_UNCOMPRESSED_BYTES = 80 * 1024 * 1024; // 80 MiB
const MAX_OFFICE_XML_PART_BYTES = 8 * 1024 * 1024; // 8 MiB per XML part
const MAX_OFFICE_XML_PART_CHARS = 4_000_000;

function decodeBasicXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
}

/** Rough plain-text extraction from WordprocessingML (good enough for offline preview). */
export function docxXmlToPlainText(xml: string): string {
  let s = xml
    .replace(/<w:tab[^>]*\/>/gi, '\t')
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeBasicXmlEntities(s);
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Remove table subtrees so body text does not duplicate table cell content (tables rendered separately). */
function stripDocxTables(xml: string): string {
  return xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/gi, '\n');
}

/**
 * Extract each table as tab-separated rows (like CSV in Excel preview).
 * Mirrors the spreadsheet preview style: monospace-friendly columns.
 */
function docxTablesToPlainSections(xml: string): string[] {
  const sections: string[] = [];
  const tblRegex = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/gi;
  let m: RegExpExecArray | null;
  let tableIndex = 0;
  while ((m = tblRegex.exec(xml)) !== null) {
    tableIndex += 1;
    const tblInner = m[1];
    const rowMatches = tblInner.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/gi) ?? [];
    const lines: string[] = [];
    for (const rowXml of rowMatches) {
      const cellMatches = rowXml.match(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi) ?? [];
      const cells = cellMatches.map((cellXml) => {
        const inner = cellXml
          .replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/gi, ' ')
          .replace(/<[^>]+>/g, ' ');
        let t = decodeBasicXmlEntities(inner);
        t = t.replace(/\s+/g, ' ').trim();
        return t;
      });
      if (cells.length) lines.push(cells.join('\t'));
    }
    if (lines.length) {
      sections.push(`— Table ${tableIndex} —\n${lines.join('\n')}`);
    }
  }
  return sections;
}

/** Build Word preview body in the same visual language as Excel (section headers + monospace-friendly text). */
function buildWordPreviewBody(xml: string): string {
  const tableSections = docxTablesToPlainSections(xml);
  const withoutTables = stripDocxTables(xml);
  let bodyText = docxXmlToPlainText(withoutTables);
  if (!bodyText) bodyText = '';

  const parts: string[] = [];
  parts.push('— Document —');
  parts.push(bodyText || '(No body text outside tables)');

  for (const block of tableSections) {
    parts.push('');
    parts.push(block);
  }

  let out = parts.join('\n\n').trim();
  if (!out) out = '(No readable text in this document)';
  return out;
}

export type OfflinePreviewResult =
  | { ok: true; body: string; footer?: string }
  | { ok: false; message: string };

function clampPreview(text: string): string {
  if (text.length <= MAX_PREVIEW_CHARS) return text;
  return `${text.slice(0, MAX_PREVIEW_CHARS)}\n\n… (preview truncated)`;
}

function parseXmlAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}="([^"]*)"`, 'i');
  const m = tag.match(re);
  return m ? m[1] : null;
}

function assertSafeOfficeZip(zip: JSZip): void {
  const entries = Object.values(zip.files);
  if (entries.length > MAX_OFFICE_ARCHIVE_ENTRIES) {
    throw new Error('Office file has too many archive entries to preview safely.');
  }
  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const size = (entry as any)?._data?.uncompressedSize;
    if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
      totalUncompressed += size;
      if (totalUncompressed > MAX_OFFICE_UNCOMPRESSED_BYTES) {
        throw new Error('Office file is too large to preview safely.');
      }
    }
  }
}

async function loadOfficeZipFromBase64(b64: string): Promise<JSZip> {
  const zip = await JSZip.loadAsync(b64, { base64: true });
  assertSafeOfficeZip(zip);
  return zip;
}

async function safeZipText(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path);
  if (!f) return null;
  const size = (f as any)?._data?.uncompressedSize;
  if (typeof size === 'number' && Number.isFinite(size) && size > MAX_OFFICE_XML_PART_BYTES) {
    return null;
  }
  try {
    const text = await f.async('string');
    if (text.length > MAX_OFFICE_XML_PART_CHARS) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

async function readBase64WithLimit(uri: string, maxBytes: number): Promise<string> {
  const info = await LegacyFS.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('File not found.');
  }
  if (info.isDirectory) {
    throw new Error('Not a file.');
  }
  if (info.size > maxBytes) {
    throw new Error('File is too large for in-app preview. Open in another app to view it.');
  }
  return LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType.Base64 });
}

async function loadXlsxPreviewFromBase64(b64: string): Promise<OfflinePreviewResult> {
  // XLSX is a ZIP of XML parts.
  const zip = await loadOfficeZipFromBase64(b64);

  const workbookXml =
    (await safeZipText(zip, 'xl/workbook.xml')) ??
    (await safeZipText(zip, 'xl/Workbook.xml'));
  if (!workbookXml) {
    return { ok: false, message: 'Could not read workbook.xml from this Excel file.' };
  }

  const relsXml =
    (await safeZipText(zip, 'xl/_rels/workbook.xml.rels')) ??
    (await safeZipText(zip, 'xl/_rels/Workbook.xml.rels'));

  const ridToTarget = new Map<string, string>();
  if (relsXml) {
    const relRe = /<Relationship\b[^>]*\/>/gi;
    const rels = relsXml.match(relRe) ?? [];
    for (const relTag of rels) {
      const id = parseXmlAttr(relTag, 'Id');
      const target = parseXmlAttr(relTag, 'Target');
      if (!id || !target) continue;
      ridToTarget.set(id, target.replace(/^\/?/, ''));
    }
  }

  // Shared strings (optional)
  const sharedStringsXml = await safeZipText(zip, 'xl/sharedStrings.xml');
  const sharedStrings: string[] = [];
  if (sharedStringsXml) {
    const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
    let m: RegExpExecArray | null;
    while ((m = siRe.exec(sharedStringsXml)) !== null) {
      const siInner = m[1];
      const tRuns = [...siInner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((x) =>
        decodeBasicXmlEntities(x[1].replace(/<[^>]+>/g, ''))
      );
      const t = tRuns.join('');
      sharedStrings.push(t);
    }
  }

  // Sheets list
  const sheetTags = workbookXml.match(/<sheet\b[^>]*\/>/gi) ?? [];
  if (!sheetTags.length) {
    return { ok: true, body: '(Empty workbook)', footer: 'Spreadsheet preview · offline' };
  }

  const outBlocks: string[] = [];

  for (const tag of sheetTags) {
    const name = parseXmlAttr(tag, 'name') ?? 'Sheet';
    const rid =
      parseXmlAttr(tag, 'r:id') ??
      parseXmlAttr(tag, 'id') ??
      '';

    let target = rid ? ridToTarget.get(rid) ?? '' : '';
    if (target && !target.startsWith('xl/')) target = `xl/${target}`;

    // Fallback: try common sheet paths by order if rels are missing.
    const sheetIndex = outBlocks.length + 1;
    const candidates = [
      target,
      `xl/worksheets/sheet${sheetIndex}.xml`,
      `xl/worksheets/Sheet${sheetIndex}.xml`,
    ].filter(Boolean);

    let sheetXml: string | null = null;
    for (const c of candidates) {
      sheetXml = await safeZipText(zip, c);
      if (sheetXml) break;
    }
    if (!sheetXml) continue;

    const rows: string[] = [];
    const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(sheetXml)) !== null) {
      const rowInner = rm[1];
      const cellRe = /<c\b[^>]*>([\s\S]*?)<\/c>/gi;
      const cells: string[] = [];
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rowInner)) !== null) {
        const cTagStart = cm[0].match(/<c\b[^>]*>/i)?.[0] ?? '<c>';
        const cellInner = cm[1];
        const t = parseXmlAttr(cTagStart, 't') ?? '';
        const v = cellInner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? '';
        const isStr = t.toLowerCase() === 's';
        const isInline = t.toLowerCase() === 'inlineStr';
        let value = '';
        if (isStr) {
          const idx = Number.parseInt(v, 10);
          value = Number.isFinite(idx) ? sharedStrings[idx] ?? '' : '';
        } else if (isInline) {
          const tRun = cellInner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/i)?.[1] ?? '';
          value = decodeBasicXmlEntities(tRun);
        } else if (t.toLowerCase() === 'b') {
          value = v === '1' ? 'TRUE' : v === '0' ? 'FALSE' : v;
        } else {
          value = decodeBasicXmlEntities(v);
        }
        value = value.replace(/\s+/g, ' ').trim();
        cells.push(value);
      }
      // Emit row only if it contains something
      if (cells.some((c) => c !== '')) rows.push(cells.join(','));
    }

    outBlocks.push(`— ${name} —\n${rows.join('\n')}`.trim());
  }

  const body = clampPreview(outBlocks.join('\n\n') || '(Empty workbook)');
  return { ok: true, body, footer: 'Spreadsheet preview · offline (sheets as CSV)' };
}

async function readUtf8WithLimit(uri: string): Promise<string> {
  const info = await LegacyFS.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('File not found.');
  }
  if (info.isDirectory) {
    throw new Error('Not a file.');
  }
  if (info.size > MAX_TEXT_BYTES) {
    throw new Error(
      `File is large (${Math.round(info.size / 1_000_000)} MB). Open in another app to view the full file.`
    );
  }
  return LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType.UTF8 });
}

export async function loadOfflinePreview(uri: string, fileType: FileType): Promise<OfflinePreviewResult> {
  if (!uri) {
    return { ok: false, message: 'No file path.' };
  }

  try {
    if (fileType === 'document') {
      const raw = await readUtf8WithLimit(uri);
      const body =
        raw.length > MAX_PREVIEW_CHARS ? `${raw.slice(0, MAX_PREVIEW_CHARS)}\n\n… (preview truncated)` : raw;
      return { ok: true, body: body || '(Empty file)', footer: 'Text preview · offline' };
    }

    if (fileType === 'word') {
      const b64 = await readBase64WithLimit(uri, MAX_OFFICE_FILE_BYTES);
      const zip = await loadOfficeZipFromBase64(b64);
      const xml = await safeZipText(zip, 'word/document.xml');
      if (!xml) {
        return {
          ok: false,
          message:
            'Could not read this Word file. It may be an older .doc format — open in another app to view it.',
        };
      }
      let text = buildWordPreviewBody(xml);
      if (text.length > MAX_PREVIEW_CHARS) {
        text = `${text.slice(0, MAX_PREVIEW_CHARS)}\n\n… (preview truncated)`;
      }
      return {
        ok: true,
        body: text,
        footer: 'Word preview · offline (like spreadsheet preview: sections + tables as tab-separated rows)',
      };
    }

    if (fileType === 'excel') {
      const b64 = await readBase64WithLimit(uri, MAX_OFFICE_FILE_BYTES);
      return loadXlsxPreviewFromBase64(b64);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not load preview.';
    return { ok: false, message: msg };
  }

  return { ok: false, message: 'Preview is not available for this file type here.' };
}
