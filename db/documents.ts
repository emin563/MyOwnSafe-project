import { getDb } from './schema';
import type { Document } from './types';

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
  fileType: 'image' | 'pdf',
  categoryId: number | null,
  purchasePrice?: number | null,
  expiryDate?: string | null,
  notes?: string | null
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO documents (title, file_uri, file_type, category_id, purchase_price, expiry_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, fileUri, fileType, categoryId, purchasePrice ?? null, expiryDate ?? null, notes ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateDocument(
  id: number,
  title: string,
  fileUri: string,
  fileType: 'image' | 'pdf',
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

export async function searchDocuments(query: string): Promise<Document[]> {
  const db = await getDb();
  const like = `%${query}%`;
  return db.getAllAsync<Document>(
    `SELECT * FROM documents
     WHERE title LIKE ? OR notes LIKE ?
     ORDER BY updated_at DESC`,
    [like, like]
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
