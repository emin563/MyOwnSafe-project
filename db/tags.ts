import { DOCUMENT_LIST_SELECT_D } from './documents';
import { getDb } from './schema';
import type { Document, Tag } from './types';

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb();
  return db.getAllAsync<Tag>('SELECT * FROM tags ORDER BY name ASC');
}

export async function getTotalTagCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM tags');
  return row?.count ?? 0;
}

export async function getTagIdByName(name: string): Promise<number | null> {
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM tags WHERE name = ?', [
    trimmed,
  ]);
  return existing?.id ?? null;
}

export async function createTag(name: string): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync('INSERT INTO tags (name) VALUES (?)', [name.trim()]);
  return result.lastInsertRowId;
}

export async function updateTag(id: number, name: string): Promise<void> {
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name cannot be empty');
  const conflict = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM tags WHERE name = ? AND id != ?',
    [trimmed, id]
  );
  if (conflict) {
    throw new Error('DUPLICATE_TAG_NAME');
  }
  await db.runAsync('UPDATE tags SET name = ? WHERE id = ?', [trimmed, id]);
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM tags WHERE id = ?', [id]);
}

export async function getTagsForDocument(documentId: number): Promise<Tag[]> {
  const db = await getDb();
  return db.getAllAsync<Tag>(
    `SELECT t.* FROM tags t
     INNER JOIN document_tags dt ON dt.tag_id = t.id
     WHERE dt.document_id = ?
     ORDER BY t.name ASC`,
    [documentId]
  );
}

export async function addTagToDocument(documentId: number, tagId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)',
    [documentId, tagId]
  );
}

export async function addTagsToDocument(documentId: number, tagIds: number[]): Promise<void> {
  const uniqueTagIds = Array.from(new Set(tagIds.filter((id) => Number.isFinite(id))));
  if (uniqueTagIds.length === 0) return;

  const db = await getDb();
  const placeholders = uniqueTagIds.map(() => '(?, ?)').join(', ');
  const params = uniqueTagIds.flatMap((tagId) => [documentId, tagId]);
  await db.runAsync(
    `INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES ${placeholders}`,
    params
  );
}

/** One INSERT for many documents sharing the same tag (bulk toolbar “Tag”). */
export async function addTagToDocuments(documentIds: number[], tagId: number): Promise<void> {
  const ids = Array.from(new Set(documentIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (ids.length === 0) return;

  const db = await getDb();
  const placeholders = ids.map(() => '(?, ?)').join(', ');
  const params = ids.flatMap((documentId) => [documentId, tagId]);
  await db.runAsync(
    `INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES ${placeholders}`,
    params
  );
}

export async function removeTagFromDocument(documentId: number, tagId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?', [
    documentId,
    tagId,
  ]);
}

export async function getDocumentsByTag(tagId: number): Promise<Document[]> {
  const db = await getDb();
  return db.getAllAsync<Document>(
    `SELECT ${DOCUMENT_LIST_SELECT_D} FROM documents d
     INNER JOIN document_tags dt ON dt.document_id = d.id
     WHERE dt.tag_id = ?
     ORDER BY d.updated_at DESC`,
    [tagId]
  );
}

export async function getOrCreateTagByName(name: string): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name cannot be empty');
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM tags WHERE name = ?', [
    trimmed,
  ]);
  if (existing) return existing.id;
  const result = await db.runAsync('INSERT INTO tags (name) VALUES (?)', [trimmed]);
  return result.lastInsertRowId;
}

export async function getTagsForDocuments(documentIds: number[]): Promise<Record<number, Tag[]>> {
  if (documentIds.length === 0) return {};
  const db = await getDb();
  const placeholders = documentIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ document_id: number; id: number; name: string; created_at: string }>(
    `SELECT dt.document_id, t.id, t.name, t.created_at
     FROM document_tags dt
     INNER JOIN tags t ON t.id = dt.tag_id
     WHERE dt.document_id IN (${placeholders})
     ORDER BY t.name ASC`,
    documentIds
  );
  const map: Record<number, Tag[]> = {};
  for (const id of documentIds) map[id] = [];
  for (const row of rows) {
    const tag: Tag = { id: row.id, name: row.name, created_at: row.created_at };
    map[row.document_id].push(tag);
  }
  return map;
}
