import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { seedDatabase } from './seed.ts';

const schema = `
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', parent_id TEXT REFERENCES domains(id)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, domain_id TEXT NOT NULL REFERENCES domains(id), topic TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('demo','nvidia','gemini','openai')), model TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed','interrupted')),
  prompt_version TEXT NOT NULL, prompt TEXT NOT NULL, use_rag INTEGER NOT NULL CHECK(use_rag IN (0,1)),
  started_at TEXT NOT NULL, finished_at TEXT, duration_ms INTEGER, error TEXT, card_id TEXT REFERENCES cards(id)
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, content TEXT NOT NULL,
  abstract TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('ARTICLE','FLASHCARD','EXPLAINER','THREAD')),
  domain_id TEXT NOT NULL REFERENCES domains(id), provider TEXT NOT NULL CHECK(provider IN ('demo','nvidia','gemini','openai')),
  model TEXT NOT NULL, prompt_version TEXT NOT NULL, is_demo INTEGER NOT NULL CHECK(is_demo IN (0,1)),
  created_at TEXT NOT NULL, bookmarked INTEGER NOT NULL DEFAULT 0 CHECK(bookmarked IN (0,1)),
  sources TEXT NOT NULL DEFAULT '[]', hashtags TEXT NOT NULL DEFAULT '[]', run_id TEXT REFERENCES runs(id)
);
CREATE TABLE IF NOT EXISTS evaluations (
  card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK(rating IN ('good','bad')), reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), provider TEXT NOT NULL,
  model TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('completed','failed')),
  duration_ms INTEGER NOT NULL, input_tokens INTEGER, output_tokens INTEGER, error TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cards_feed ON cards(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS cards_domain_feed ON cards(domain_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS attempts_run ON attempts(run_id,created_at);
CREATE INDEX IF NOT EXISTS runs_recent ON runs(started_at DESC);
`;

const databaseState = globalThis as typeof globalThis & { bishamonConnections?: Map<string, DatabaseSync> };
const connections = databaseState.bishamonConnections ??= new Map<string, DatabaseSync>();

export function getDatabase(): DatabaseSync {
  const path = process.env.BISHAMON_DB_PATH === ':memory:' ? ':memory:' : resolve(process.env.BISHAMON_DB_PATH || 'data/bishamon.sqlite');
  const existing = connections.get(path);
  if (existing) return existing;
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    const version = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
    if (version > 1) throw new Error('Versi database lebih baru dari aplikasi.');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(schema);
      seedDatabase(db);
      db.exec('PRAGMA user_version = 1; COMMIT;');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    connections.set(path, db);
    return db;
  } catch (error) { db.close(); throw error; }
}

/** Call once before starting the single server process, never when opening a connection. */
export function recoverInterruptedRuns(): number {
  return Number(getDatabase().prepare("UPDATE runs SET status='interrupted', finished_at=?, error=? WHERE status='running'")
    .run(new Date().toISOString(), 'Proses aplikasi berhenti sebelum generasi selesai.').changes);
}

/** Releases file handles for backup tooling and isolated tests. */
export function closeDatabases(): void {
  for (const db of connections.values()) db.close();
  connections.clear();
}
