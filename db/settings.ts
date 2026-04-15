import { getDb } from './schema';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  if (keys.length === 0) return result;

  const uniqueKeys = Array.from(new Set(keys));
  for (const key of uniqueKeys) {
    result[key] = null;
  }

  const db = await getDb();
  const placeholders = uniqueKeys.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    uniqueKeys
  );

  for (const row of rows) {
    result[row.key] = row.value;
  }

  return result;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
}
