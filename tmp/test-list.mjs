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
function airtableListAll() {
  return new Promise((resolve) => {
    const c = cfg();
    if (!c.apiKey || !c.baseId || !c.tableId) return resolve({ ok: false, error: "Airtable not configured" });
    const records = [];
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => finish({ ok: false, error: "Airtable timeout (5s)" }), 5e3);
    function fetchPage(offset) {
      const path2 = `/v0/${c.baseId}/${encodeURIComponent(c.tableId)}?pageSize=100${offset ? `&offset=${encodeURIComponent(offset)}` : ""}`;
      const req = https.request(
        { hostname: "api.airtable.com", port: 443, path: path2, method: "GET", headers: { Authorization: `Bearer ${c.apiKey}` } },
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
            try {
              data = JSON.parse(text);
            } catch {
              clearTimeout(timer);
              return finish({ ok: false, error: "Bad Airtable JSON" });
            }
            if (Array.isArray(data.records)) records.push(...data.records);
            if (data.offset) fetchPage(data.offset);
            else {
              clearTimeout(timer);
              finish({ ok: true, records });
            }
          });
        }
      );
      req.on("error", (e) => {
        clearTimeout(timer);
        finish({ ok: false, error: e.message });
      });
      req.end();
    }
    fetchPage();
  });
}
async function listAirtableFiles() {
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
      attachments: Array.isArray(f.Attachments) ? f.Attachments.map((a) => ({ url: a.url, filename: a.filename })) : []
    };
  });
  return { ok: true, files };
}
async function getAllKnownFiles() {
  const local = listSourceFiles();
  const up = loadUploaded();
  const at = await listAirtableFiles();
  const uploadedAsLocal = up.files.map((f) => ({
    name: f.name,
    path: `uploaded://${f.name}`,
    size: f.size,
    modifiedAt: f.uploadedAt,
    source: "uploaded"
  }));
  const airtableAsLocal = (at.files || []).map((f) => ({
    name: f.name,
    path: f.path,
    size: f.size,
    modifiedAt: f.modifiedAt,
    source: "airtable",
    attachments: f.attachments,
    recordId: f.recordId
  }));
  return { sourceDir: local.sourceDir, exists: local.exists, files: [...local.files, ...uploadedAsLocal, ...airtableAsLocal], airtable: at };
}

// api/attachments/list.mjs
var config = { runtime: "nodejs18.x" };
async function handler(_req, res) {
  try {
    const data = await getAllKnownFiles();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message, files: [] });
  }
}
export {
  config,
  handler as default
};
