// Shared logic between Express (server/index.js) and Vercel serverless (api/*.js).
// Works in Node 18+.

import fs from "fs";
import os from "os";
import path from "path";
import https from "https";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";

// Load .env.local (highest priority), then .env. Use import.meta.url to locate
// the file regardless of where this module is imported from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, "..", ".env.local"), override: true });
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

const DEFAULT_SOURCE_DIR = "C:\\RPA\\SavedAttachments";

function cfg() {
  return {
    sourceDir: process.env.RPA_ATTACHMENTS_DIR || DEFAULT_SOURCE_DIR,
    baseDir: process.env.SYNC_DIR || path.join(os.tmpdir(), "invoice-bot"),
    apiKey: process.env.AIRTABLE_API_KEY || "",
    baseId: process.env.AIRTABLE_BASE_ID || "",
    tableId: process.env.AIRTABLE_TABLE_ID || "",
    uploadToken: process.env.UPLOAD_TOKEN || "",
  };
}

function uploadsDir() {
  if (process.env.VERCEL) return "/tmp/invoice-bot-uploads";
  return path.join(cfg().baseDir, "uploads");
}
function uploadedManifestPath() {
  return path.join(uploadsDir(), "uploaded.json");
}
function ensureUploadsDir() {
  const d = uploadsDir();
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
function loadUploaded() {
  ensureUploadsDir();
  try {
    return JSON.parse(fs.readFileSync(uploadedManifestPath(), "utf8"));
  } catch {
    return { files: [] };
  }
}
function saveUploaded(m) {
  fs.writeFileSync(uploadedManifestPath(), JSON.stringify(m, null, 2), "utf8");
}

export function getSourceDir() { return cfg().sourceDir; }

export function listSourceFiles() {
  const c = cfg();
  const out = { sourceDir: c.sourceDir, exists: false, files: [] };
  try {
    if (!fs.existsSync(c.sourceDir)) return out;
    out.exists = true;
    const entries = fs.readdirSync(c.sourceDir);
    for (const name of entries) {
      const p = path.join(c.sourceDir, name);
      try {
        const st = fs.statSync(p);
        if (!st.isFile()) continue;
        out.files.push({ name, path: p, size: st.size, modifiedAt: st.mtime.toISOString() });
      } catch {}
    }
    out.files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

export function getSourceFileCount() {
  const dir = cfg().sourceDir;
  try {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((n) => {
      try { return fs.statSync(path.join(dir, n)).isFile(); } catch { return false; }
    }).length;
  } catch { return 0; }
}

export function listUploadedFiles() {
  const m = loadUploaded();
  return { uploaded: true, files: m.files };
}

function airtableListAll() {
  return new Promise((resolve) => {
    const c = cfg();
    if (!c.apiKey || !c.baseId || !c.tableId) return resolve({ ok: false, error: "Airtable not configured" });
    const records = [];
    let settled = false;
    const finish = (v) => { if (settled) return; settled = true; resolve(v); };
    const timer = setTimeout(() => finish({ ok: false, error: "Airtable timeout (5s)" }), 5000);
    function fetchPage(offset) {
      const path = `/v0/${c.baseId}/${encodeURIComponent(c.tableId)}?pageSize=100${offset ? `&offset=${encodeURIComponent(offset)}` : ""}`;
      const req = https.request(
        { hostname: "api.airtable.com", port: 443, path, method: "GET", headers: { Authorization: `Bearer ${c.apiKey}` } },
        (res) => {
          const chunks = [];
          res.on("data", (x) => chunks.push(x));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode < 200 || res.statusCode >= 300) {
              clearTimeout(timer);
              return finish({ ok: false, error: `Airtable ${res.statusCode}: ${text}` });
            }
            let data;
            try { data = JSON.parse(text); } catch { clearTimeout(timer); return finish({ ok: false, error: "Bad Airtable JSON" }); }
            if (Array.isArray(data.records)) records.push(...data.records);
            if (data.offset) fetchPage(data.offset);
            else { clearTimeout(timer); finish({ ok: true, records }); }
          });
        }
      );
      req.on("error", (e) => { clearTimeout(timer); finish({ ok: false, error: e.message }); });
      req.end();
    }
    fetchPage();
  });
}

export async function listAirtableFiles() {
  const r = await airtableListAll();
  if (!r.ok) return { ok: false, error: r.error || "Airtable error", files: [] };
  const files = (r.records || []).map((rec) => {
    const f = rec.fields || {};
    return {
      name: f["File Name"] || rec.id,
      size: null,
      modifiedAt: f.Date || rec.createdTime || null,
      path: `airtable://${rec.id}`,
      source: "airtable",
      recordId: rec.id,
      attachments: Array.isArray(f.Attachments) ? f.Attachments.map((a) => ({ url: a.url, filename: a.filename })) : [],
    };
  });
  return { ok: true, files };
}

export async function getAllKnownFiles() {
  const local = listSourceFiles();
  const up = loadUploaded();
  const at = await listAirtableFiles();
  const uploadedAsLocal = up.files.map((f) => ({
    name: f.name, path: `uploaded://${f.name}`, size: f.size, modifiedAt: f.uploadedAt, source: "uploaded",
  }));
  const airtableAsLocal = (at.files || []).map((f) => ({
    name: f.name, path: f.path, size: f.size, modifiedAt: f.modifiedAt, source: "airtable",
    attachments: f.attachments, recordId: f.recordId,
  }));
  return { sourceDir: local.sourceDir, exists: local.exists, files: [...local.files, ...uploadedAsLocal, ...airtableAsLocal], airtable: at };
}

export function receiveUpload({ name, data, contentType }) {
  ensureUploadsDir();
  if (!name) throw new Error("Missing file name");
  const safe = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
  let dest = path.join(uploadsDir(), safe);
  let i = 1;
  while (fs.existsSync(dest)) {
    const ext = path.extname(safe);
    const stem = safe.slice(0, safe.length - ext.length);
    const n = `${stem}_${i}${ext}`;
    dest = path.join(uploadsDir(), n);
    i++;
  }
  const buf = Buffer.from(data, "base64");
  fs.writeFileSync(dest, buf);
  const stat = fs.statSync(dest);
  const m = loadUploaded();
  const rec = { name: path.basename(dest), size: stat.size, uploadedAt: new Date().toISOString(), contentType: contentType || "application/octet-stream" };
  m.files.push(rec);
  saveUploaded(m);
  return rec;
}

export function getAirtableStatus() {
  const c = cfg();
  const m = loadUploaded();
  return { configured: Boolean(c.apiKey && c.baseId && c.tableId), total: m.records?.length || 0 };
}

export async function syncAirtable() {
  const c = cfg();
  if (!c.apiKey || !c.baseId || !c.tableId) {
    return { ok: false, error: "Airtable not configured (set AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID).", added: [], total: 0, sourceCount: 0 };
  }
  // On Vercel we can only sync uploaded files (no local folder).
  // Locally we also scan the local folder.
  const sources = [];
  if (process.env.VERCEL) {
    const up = loadUploaded();
    up.files.forEach((f) => sources.push({ name: f.name, buf: fs.readFileSync(path.join(uploadsDir(), f.name)) }));
  } else {
    const local = listSourceFiles();
    if (local.exists) {
      for (const f of local.files) {
        try { sources.push({ name: f.name, buf: fs.readFileSync(f.path) }); } catch {}
      }
    }
  }
  const manifest = loadUploaded();
  const known = new Set((manifest.records || []).map((r) => r.name));
  const added = [];
  for (const src of sources) {
    if (known.has(src.name)) continue;
    const rec = await airtableCreate(src.name, src.buf);
    manifest.records = manifest.records || [];
    manifest.records.push({ name: src.name, recordId: rec, syncedAt: new Date().toISOString() });
    added.push({ fileName: src.name, recordId: rec });
  }
  saveUploaded(manifest);
  return { ok: true, added, total: (manifest.records || []).length, sourceCount: sources.length, sourceDir: process.env.VERCEL ? "uploaded files" : c.sourceDir };
}

function airtableCreate(name, buf) {
  return new Promise((resolve, reject) => {
    const c = cfg();
    const body = { records: [{ fields: { "File Name": name, Date: new Date().toISOString() } }] };
    const data = Buffer.from(JSON.stringify(body), "utf8");
    const req = https.request(
      {
        hostname: "api.airtable.com", port: 443,
        path: `/v0/${c.baseId}/${encodeURIComponent(c.tableId)}`,
        method: "POST",
        headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json", "Content-Length": data.length },
      },
      (res) => {
        const chunks = [];
        res.on("data", (x) => chunks.push(x));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { const j = JSON.parse(text); resolve(j.records?.[0]?.id || "ok"); } catch { resolve("ok"); }
          } else {
            reject(new Error(`Airtable ${res.statusCode}: ${text}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
