import { getDb } from './schema';
import type { Document, FileType } from './types';

/** List/dashboard columns — omits heavy `ocr_text` (loaded on open in `getDocumentById`). */
export const DOCUMENT_LIST_COLUMNS =
  'id, category_id, title, file_uri, file_type, purchase_price, expiry_date, notes, notification_id, created_at, updated_at';

/** Same as `DOCUMENT_LIST_COLUMNS` but with table alias `d.` (for JOIN queries). */
export const DOCUMENT_LIST_SELECT_D = DOCUMENT_LIST_COLUMNS.split(', ')
  .map((c) => `d.${c.trim()}`)
  .join(', ');

export async function getDocuments(categoryId?: number | null): Promise<Document[]> {
  const db = await getDb();
  if (categoryId !== null && categoryId !== undefined) {
    return db.getAllAsync<Document>(
      `SELECT ${DOCUMENT_LIST_COLUMNS} FROM documents WHERE category_id = ? ORDER BY updated_at DESC`,
      [categoryId]
    );
  }
  return db.getAllAsync<Document>(
    `SELECT ${DOCUMENT_LIST_COLUMNS} FROM documents ORDER BY updated_at DESC`
  );
}

export async function getDocumentById(id: number): Promise<Document | null> {
  const db = await getDb();
  return db.getFirstAsync<Document>('SELECT * FROM documents WHERE id = ?', [id]);
}

export async function createDocument(
  title: string,
  fileUri: string,
  fileType: FileType,
  categoryId: number | null,
  purchasePrice?: number | null,
  expiryDate?: string | null,
  notes?: string | null
): Promise<number> {
  const db = await getDb();
  const safeTitle = title.slice(0, 500);
  const safeNotes = notes != null ? notes.slice(0, 50_000) : null;
  const safeExpiry = expiryDate != null && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ? expiryDate : null;
  const result = await db.runAsync(
    `INSERT INTO documents (title, file_uri, file_type, category_id, purchase_price, expiry_date, notes, ocr_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [safeTitle, fileUri, fileType, categoryId, purchasePrice ?? null, safeExpiry, safeNotes, null]
  );
  return result.lastInsertRowId;
}

export async function updateDocument(
  id: number,
  title: string,
  fileUri: string,
  fileType: FileType,
  categoryId: number | null,
  purchasePrice?: number | null,
  expiryDate?: string | null,
  notes?: string | null
): Promise<void> {
  const db = await getDb();
  const safeTitle = title.slice(0, 500);
  const safeNotes = notes != null ? notes.slice(0, 50_000) : null;
  const safeExpiry = expiryDate != null && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ? expiryDate : null;
  await db.runAsync(
    `UPDATE documents
     SET title = ?, file_uri = ?, file_type = ?, category_id = ?,
         purchase_price = ?, expiry_date = ?, notes = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [safeTitle, fileUri, fileType, categoryId, purchasePrice ?? null, safeExpiry, safeNotes, id]
  );
}

export async function updateDocumentOcrText(id: number, text: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE documents
     SET ocr_text = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [text, id]
  );
}

export async function updateDocumentNotificationId(
  id: number,
  notificationId: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE documents SET notification_id = ? WHERE id = ?',
    [notificationId, id]
  );
}

export async function deleteDocument(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
}

/**
 * Build an FTS5 MATCH expression from a user query string.
 * Tokens use prefix matches; multiple tokens are AND-ed (all must match somewhere).
 * When `includeOcr` is false, only `title` and `notes` columns are searched via FTS5 column filter.
 */
function buildFtsMatchExpr(query: string, includeOcr: boolean): string {
  const tokens = query
    .replace(/['"*(){}[\]^~!@#$%&|\\:;,.?/<>+=]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return '';
  const inner = tokens.map((t) => `"${t}"*`).join(' AND ');
  if (includeOcr) {
    return inner;
  }
  return `{title notes} : ${inner}`;
}

export async function searchDocuments(
  query: string,
  includeOcr: boolean = true,
  limit: number = 200
): Promise<Document[]> {
  const db = await getDb();
  const escaped = query.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const like = `%${escaped}%`;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 200;

  // Try FTS5 first (orders of magnitude faster than LIKE on large tables).
  const ftsExpr = buildFtsMatchExpr(query, includeOcr);
  if (ftsExpr) {
    try {
      return await db.getAllAsync<Document>(
        `SELECT ${DOCUMENT_LIST_SELECT_D} FROM documents d
         WHERE d.id IN (
           SELECT rowid FROM documents_fts WHERE documents_fts MATCH ?
         )
         OR EXISTS (
           SELECT 1
           FROM document_tags dt
           JOIN tags t ON t.id = dt.tag_id
           WHERE dt.document_id = d.id AND t.name LIKE ? ESCAPE '\\'
         )
         ORDER BY d.updated_at DESC
         LIMIT ?`,
        [ftsExpr, like, safeLimit]
      );
    } catch {
      // FTS5 table missing or query malformed — fall through to LIKE
    }
  }

  // Fallback: LIKE-based search (works on any SQLite build)
  const ocrClause = includeOcr ? ` OR d.ocr_text LIKE ? ESCAPE '\\'` : '';
  return db.getAllAsync<Document>(
    `SELECT ${DOCUMENT_LIST_SELECT_D} FROM documents d
     WHERE d.title LIKE ? ESCAPE '\\' OR d.notes LIKE ? ESCAPE '\\'
       OR EXISTS (
         SELECT 1
         FROM document_tags dt
         JOIN tags t ON t.id = dt.tag_id
         WHERE dt.document_id = d.id AND t.name LIKE ? ESCAPE '\\'
       )${ocrClause}
     ORDER BY d.updated_at DESC
     LIMIT ?`,
    includeOcr ? [like, like, like, like, safeLimit] : [like, like, like, safeLimit]
  );
}

export async function getTotalFileCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM documents'
  );
  return row?.count ?? 0;
}

export async function getDocumentsExpiringSoon(daysAhead: number = 30): Promise<Document[]> {
  const db = await getDb();
  return db.getAllAsync<Document>(
    `SELECT ${DOCUMENT_LIST_COLUMNS} FROM documents
     WHERE expiry_date IS NOT NULL
       AND expiry_date <= date('now', '+' || ? || ' days')
       AND expiry_date >= date('now')
     ORDER BY expiry_date ASC`,
    [daysAhead]
  );
}
