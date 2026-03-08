import { getDb } from './schema';
import type { Category } from './types';

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY name ASC');
}

export async function createCategory(name: string, iconName: string = 'folder-outline'): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO categories (name, icon_name) VALUES (?, ?)',
    [name, iconName]
  );
  return result.lastInsertRowId;
}

export async function updateCategory(id: number, name: string, iconName?: string): Promise<void> {
  const db = await getDb();
  if (iconName !== undefined) {
    await db.runAsync(
      'UPDATE categories SET name = ?, icon_name = ? WHERE id = ?',
      [name, iconName, id]
    );
  } else {
    await db.runAsync('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
  }
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}
