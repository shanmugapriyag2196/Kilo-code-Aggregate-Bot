// shared/api.js
import fs from "fs";
import os from "os";
import path from "path";
import https from "https";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, "..", ".env.local"), override: true });
loadEnv({ path: path.resolve(__dirname, "..", ".env") });
var DEFAULT_SOURCE_DIR = "C:\\RPA\\SavedAttachments";
function cfg() {
  return {
    sourceDir: process.env.RPA_ATTACHMENTS_DIR || DEFAULT_SOURCE_DIR,
    baseDir: process.env.SYNC_DIR || path.join(os.tmpdir(), "invoice-bot"),
    apiKey: process.env.AIRTABLE_API_KEY || "",
    baseId: process.env.AIRTABLE_BASE_ID || "",
    tableId: process.env.AIRTABLE_TABLE_ID || "",
    uploadToken: process.env.UPLOAD_TOKEN || ""
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
function listSourceFiles() {
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
      } catch {
      }
    }
    out.files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch (e) {
    out.error = e.message;
  }
  return out;
}
function getSourceFileCount() {
  const dir = cfg().sourceDir;
  try {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((n) => {
      try {
        return fs.statSync(path.join(dir, n)).isFile();
      } catch {
        return false;
      }
    }).length;
  } catch {
    return 0;
  }
}
async function syncAirtable() {
  const c = cfg();
  if (!c.apiKey || !c.baseId || !c.tableId) {
    return { ok: false, error: "Airtable not configured (set AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID).", added: [], total: 0, sourceCount: 0 };
  }
  const sources = [];
  if (process.env.VERCEL) {
    const up = loadUploaded();
    up.files.forEach((f) => sources.push({ name: f.name, buf: fs.readFileSync(path.join(uploadsDir(), f.name)) }));
  } else {
    const local = listSourceFiles();
    if (local.exists) {
      for (const f of local.files) {
        try {
          sources.push({ name: f.name, buf: fs.readFileSync(f.path) });
        } catch {
        }
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
    manifest.records.push({ name: src.name, recordId: rec, syncedAt: (/* @__PURE__ */ new Date()).toISOString() });
    added.push({ fileName: src.name, recordId: rec });
  }
  saveUploaded(manifest);
  return { ok: true, added, total: (manifest.records || []).length, sourceCount: sources.length, sourceDir: process.env.VERCEL ? "uploaded files" : c.sourceDir };
}
function airtableCreate(name, buf) {
  return new Promise((resolve, reject) => {
    const c = cfg();
    const body = { records: [{ fields: { "File Name": name, Date: (/* @__PURE__ */ new Date()).toISOString() } }] };
    const data = Buffer.from(JSON.stringify(body), "utf8");
    const req = https.request(
      {
        hostname: "api.airtable.com",
        port: 443,
        path: `/v0/${c.baseId}/${encodeURIComponent(c.tableId)}`,
        method: "POST",
        headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json", "Content-Length": data.length }
      },
      (res) => {
        const chunks = [];
        res.on("data", (x) => chunks.push(x));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const j = JSON.parse(text);
              resolve(j.records?.[0]?.id || "ok");
            } catch {
              resolve("ok");
            }
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

// api/airtable/sync.mjs
var config = { runtime: "nodejs18.x" };
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  try {
    const r = await syncAirtable();
    res.status(200).json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, added: [], total: 0, sourceCount: getSourceFileCount() });
  }
}
export {
  config,
  handler as default
};
