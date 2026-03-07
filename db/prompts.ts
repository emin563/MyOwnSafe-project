import { getDb } from './schema';
import type { Prompt } from './types';

export async function getPrompts(categoryId?: number | null): Promise<Prompt[]> {
  const db = await getDb();
  if (categoryId !== undefined && categoryId !== null) {
    return db.getAllAsync<Prompt>(
      'SELECT * FROM prompts WHERE category_id = ? ORDER BY updated_at DESC',
      [categoryId]
    );
  }
  return db.getAllAsync<Prompt>('SELECT * FROM prompts ORDER BY updated_at DESC');
}

export async function getPromptById(id: number): Promise<Prompt | null> {
  const db = await getDb();
  return db.getFirstAsync<Prompt>('SELECT * FROM prompts WHERE id = ?', [id]);
}

export async function createPrompt(
  title: string,
  content: string,
  categoryId: number | null
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO prompts (title, content, category_id) VALUES (?, ?, ?)',
    [title, content, categoryId]
  );
  return result.lastInsertRowId;
}

export async function updatePrompt(
  id: number,
  title: string,
  content: string,
  categoryId: number | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE prompts SET title = ?, content = ?, category_id = ?, updated_at = datetime('now') WHERE id = ?",
    [title, content, categoryId, id]
  );
}

export async function deletePrompt(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM prompts WHERE id = ?', [id]);
}

export async function searchPrompts(query: string): Promise<Prompt[]> {
  const db = await getDb();
  const like = `%${query}%`;
  return db.getAllAsync<Prompt>(
    'SELECT * FROM prompts WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC',
    [like, like]
  );
}
