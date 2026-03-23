import { getDb } from './schema';
import type { Document, FileType } from './types';

export async function getDocuments(categoryId?: number | null): Promise<Document[]> {
  const db = await getDb();
  if (categoryId !== null && categoryId !== undefined) {
    return db.getAllAsync<Document>(
      'SELECT * FROM documents WHERE category_id = ? ORDER BY updated_at DESC',
      [categoryId]
    );
  }
  return db.getAllAsync<Document>('SELECT * FROM documents ORDER BY updated_at DESC');
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
  const result = await db.runAsync(
    `INSERT INTO documents (title, file_uri, file_type, category_id, purchase_price, expiry_date, notes, ocr_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, fileUri, fileType, categoryId, purchasePrice ?? null, expiryDate ?? null, notes ?? null, null]
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
  await db.runAsync(
    `UPDATE documents
     SET title = ?, file_uri = ?, file_type = ?, category_id = ?,
         purchase_price = ?, expiry_date = ?, notes = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [title, fileUri, fileType, categoryId, purchasePrice ?? null, expiryDate ?? null, notes ?? null, id]
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

export async function searchDocuments(query: string, includeOcr: boolean = true): Promise<Document[]> {
  const db = await getDb();
  const like = `%${query}%`;
  const ocrClause = includeOcr ? ' OR d.ocr_text LIKE ?' : '';
  return db.getAllAsync<Document>(
    `SELECT d.* FROM documents d
     WHERE d.title LIKE ? OR d.notes LIKE ?
       OR EXISTS (
         SELECT 1
         FROM document_tags dt
         JOIN tags t ON t.id = dt.tag_id
         WHERE dt.document_id = d.id AND t.name LIKE ?
       )${ocrClause}
     ORDER BY d.updated_at DESC`,
    includeOcr ? [like, like, like, like] : [like, like, like]
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
    `SELECT * FROM documents
     WHERE expiry_date IS NOT NULL
       AND expiry_date <= date('now', '+' || ? || ' days')
       AND expiry_date >= date('now')
     ORDER BY expiry_date ASC`,
    [daysAhead]
  );
}
