import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('docarchive.db');
  return db;
}

const DEFAULT_CATEGORIES = [
  { name: 'Receipts', icon_name: 'receipt-outline' },
  /** Ribbon reads as certificate/guarantee — distinct from app branding (shield). */
  { name: 'Warranties', icon_name: 'ribbon-outline' },
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
      ocr_text TEXT,
      purchase_price REAL,
      expiry_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS document_tags (
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, tag_id)
    );

    -- Optimization indexes for hot paths (search + ordering + joins)
    CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
    CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
    CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
  `);

  // FTS5 full-text search index (external-content backed by documents table)
  await database.execAsync(`
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      title,
      notes,
      ocr_text,
      content='documents',
      content_rowid='id'
    );
  `);

  // Triggers keep the FTS index in sync with the documents table.
  // DROP + CREATE avoids "already exists" errors on re-runs while letting us
  // update trigger bodies in future migrations.
  await database.execAsync(`
    DROP TRIGGER IF EXISTS documents_fts_ai;
    CREATE TRIGGER documents_fts_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, title, notes, ocr_text)
      VALUES (new.id, new.title, new.notes, new.ocr_text);
    END;

    DROP TRIGGER IF EXISTS documents_fts_ad;
    CREATE TRIGGER documents_fts_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, notes, ocr_text)
      VALUES ('delete', old.id, old.title, old.notes, old.ocr_text);
    END;

    DROP TRIGGER IF EXISTS documents_fts_au;
    CREATE TRIGGER documents_fts_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, notes, ocr_text)
      VALUES ('delete', old.id, old.title, old.notes, old.ocr_text);
      INSERT INTO documents_fts(rowid, title, notes, ocr_text)
      VALUES (new.id, new.title, new.notes, new.ocr_text);
    END;
  `);

  // Rebuild FTS only when out of sync (e.g. first run after FTS migration). Triggers keep
  // the index current afterward — a full rebuild every launch was O(n) and slowed cold start.
  try {
    const docCount = await database.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM documents');
    const ftsCount = await database.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM documents_fts'
    );
    const dc = docCount?.c ?? 0;
    const fc = ftsCount?.c ?? 0;
    if (dc !== fc) {
      await database.execAsync(`INSERT INTO documents_fts(documents_fts) VALUES('rebuild');`);
    }
  } catch {
    // If FTS metadata is unavailable, skip — search falls back to LIKE
  }

  // Safe migration: add notification_id column if it does not exist yet
  try {
    await database.execAsync('ALTER TABLE documents ADD COLUMN notification_id TEXT;');
  } catch {
    // Column already exists from a previous run — silently skip
  }

  // Safe migration: add OCR text column if it does not exist yet
  try {
    await database.execAsync('ALTER TABLE documents ADD COLUMN ocr_text TEXT;');
  } catch {
    // Column already exists from a previous run — silently skip
  }

  try {
    await database.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON documents(expiry_date);'
    );
  } catch {
    /* ignore */
  }

  // Seed default categories only on first run
  const existing = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (existing[0]?.count === 0) {
    await database.withTransactionAsync(async () => {
      for (const cat of DEFAULT_CATEGORIES) {
        await database.runAsync('INSERT INTO categories (name, icon_name) VALUES (?, ?)', [
          cat.name,
          cat.icon_name,
        ]);
      }
    });
  }

  // One-time style fix: Warranties used the same shield icon as app branding; migrate default only.
  try {
    await database.runAsync(
      `UPDATE categories SET icon_name = ? WHERE name = 'Warranties' AND icon_name = 'shield-checkmark-outline'`,
      ['ribbon-outline']
    );
  } catch {
    /* ignore */
  }
}
