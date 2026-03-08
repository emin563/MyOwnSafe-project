import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('docarchive.db');
  return db;
}

const DEFAULT_CATEGORIES = [
  { name: 'Receipts', icon_name: 'receipt-outline' },
  { name: 'Warranties', icon_name: 'shield-checkmark-outline' },
  { name: 'IDs & Passports', icon_name: 'card-outline' },
  { name: 'Contracts', icon_name: 'document-text-outline' },
];

export async function initDb(): Promise<void> {
  const database = await getDb();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon_name TEXT NOT NULL DEFAULT 'folder-outline',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      title TEXT NOT NULL,
      file_uri TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'image',
      purchase_price REAL,
      expiry_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
    );
  `);

  // Seed default categories only on first run
  const existing = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (existing[0]?.count === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await database.runAsync(
        'INSERT INTO categories (name, icon_name) VALUES (?, ?)',
        [cat.name, cat.icon_name]
      );
    }
  }
}
