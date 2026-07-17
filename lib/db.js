import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { CONFIG, ensureDirs } from "./config";

ensureDirs();

const db = new Database(CONFIG.DB_PATH);
db.pragma("journal_mode = WAL");

// ---- encryption for stored Outlook token ----
const ALGO = "aes-256-gcm";
function getKey() {
  const k = CONFIG.ENCRYPTION_KEY;
  if (!k || k.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64-char hex (32 bytes).");
  }
  return Buffer.from(k, "hex");
}
export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + enc.toString("hex");
}
export function decrypt(str) {
  const [iv, tag, enc] = str.split(":");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(enc, "hex")), decipher.final()]);
  return JSON.parse(dec.toString("utf8"));
}

// ---- schema ----
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    email_id TEXT UNIQUE,
    received_at TEXT,
    pdf_path TEXT,
    pdf_name TEXT,
    vendor TEXT,
    class TEXT,
    invoice_no TEXT,
    invoice_date TEXT,
    amount REAL,
    item TEXT,
    po_no TEXT,
    buyer_name TEXT,
    account_number TEXT,
    buyer_approval TEXT DEFAULT 'Pending',
    manager_approval TEXT DEFAULT 'Pending',
    qb_exported_at TEXT,
    qb_error TEXT,
    extraction_confidence REAL DEFAULT 0,
    needs_review INTEGER DEFAULT 0,
    stage TEXT DEFAULT 'INBOX',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY DEFAULT 1, data TEXT);
`);

export default db;

export function getSetting(key) {
  const row = db.prepare(`SELECT value FROM kv WHERE key = ?`).get(key);
  return row ? row.value : null;
}
export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO kv (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function saveTokens(tokens) {
  db.prepare(
    `INSERT INTO tokens (id, data) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`
  ).run(encrypt(tokens));
}
export function loadTokens() {
  const row = db.prepare(`SELECT data FROM tokens WHERE id = 1`).get();
  if (!row) return null;
  try {
    return decrypt(row.data);
  } catch {
    return null;
  }
}

export function savePdf(name, buffer) {
  const safe = name.replace(/[^\w.\-]/g, "_");
  const full = path.join(CONFIG.INVOICE_DIR, safe);
  fs.writeFileSync(full, buffer);
  return full;
}
