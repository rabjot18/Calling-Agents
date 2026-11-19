import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Local SQLite store. Swap for Postgres (same tables) before deploying to a serverless host.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_json TEXT NOT NULL,
  onboarding_step TEXT NOT NULL DEFAULT 'find',
  llm_id TEXT,
  agent_id TEXT,
  published_version INTEGER,
  phone_number TEXT,
  calcom_app_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  duration_ms INTEGER,
  call_type TEXT,
  from_number TEXT,
  caller_name TEXT,
  reason TEXT,
  summary TEXT,
  outcome TEXT NOT NULL DEFAULT 'Message',
  urgency TEXT NOT NULL DEFAULT 'normal',
  after_hours INTEGER NOT NULL DEFAULT 0,
  follow_up INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  appointment_time TEXT,
  service TEXT,
  transcript_json TEXT,
  recording_url TEXT,
  analysis_json TEXT,
  status TEXT
);
CREATE INDEX IF NOT EXISTS calls_business_time ON calls(business_id, started_at DESC);
CREATE TABLE IF NOT EXISTS connections (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account TEXT,
  secret_enc TEXT NOT NULL,
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, provider)
);
`;

// Column additions for databases created before the column existed. Each runs once; "duplicate column" means done.
function migrate(db: Database.Database) {
  // Which voice platform the business's agent_id belongs to, and the platform's id for its phone number.
  const bcols = (db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[]).map((c) => c.name);
  if (!bcols.includes("platform")) db.exec("ALTER TABLE businesses ADD COLUMN platform TEXT NOT NULL DEFAULT 'retell'");
  if (!bcols.includes("phone_id")) db.exec("ALTER TABLE businesses ADD COLUMN phone_id TEXT");
  const cols = (db.prepare("PRAGMA table_info(calls)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("notified_at")) {
    db.exec("ALTER TABLE calls ADD COLUMN notified_at INTEGER");
    // Calls that existed before email summaries were switched on count as already sent: no backlog flood.
    db.exec("UPDATE calls SET notified_at = 0 WHERE notified_at IS NULL");
  }
  if (!cols.includes("wa_notified_at")) {
    db.exec("ALTER TABLE calls ADD COLUMN wa_notified_at INTEGER");
    db.exec("UPDATE calls SET wa_notified_at = 0 WHERE wa_notified_at IS NULL"); // no WhatsApp backlog either
  }
}

function open() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "app.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

const g = globalThis as unknown as { __pickupDb?: Database.Database };
export const db: Database.Database = g.__pickupDb ?? (g.__pickupDb = open());

export const now = () => Date.now();
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
