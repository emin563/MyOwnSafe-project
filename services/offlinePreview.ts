import * as LegacyFS from 'expo-file-system/legacy';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { FileType } from '@/db/types';

const MAX_TEXT_BYTES = 1_500_000;
const MAX_PREVIEW_CHARS = 400_000;

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
      const b64 = await LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType.Base64 });
      const zip = await JSZip.loadAsync(b64, { base64: true });
      const docXml = zip.file('word/document.xml');
      if (!docXml) {
        return {
          ok: false,
          message:
            'Could not read this Word file. It may be an older .doc format — open in another app to view it.',
        };
      }
      const xml = await docXml.async('string');
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
      const b64 = await LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType.Base64 });
      const wb = XLSX.read(b64, { type: 'base64', cellDates: true });
      if (!wb.SheetNames.length) {
        return { ok: true, body: '(Empty workbook)', footer: 'Spreadsheet preview · offline' };
      }
      const lines: string[] = [];
      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        if (!sheet) continue;
        const csv = XLSX.utils.sheet_to_csv(sheet);
        lines.push(`— ${name} —\n${csv}`);
      }
      let body = lines.join('\n\n');
      if (body.length > MAX_PREVIEW_CHARS) {
        body = `${body.slice(0, MAX_PREVIEW_CHARS)}\n\n… (preview truncated)`;
      }
      return { ok: true, body: body || '(Empty sheet)', footer: 'Spreadsheet preview · offline (first sheets as CSV)' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not load preview.';
    return { ok: false, message: msg };
  }

  return { ok: false, message: 'Preview is not available for this file type here.' };
}
