import fs from "fs";
import os from "os";
import path from "path";
import https from "https";
import { config as loadEnv } from "dotenv";

// Load .env.local first (highest priority), then .env.
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const DEFAULT_SOURCE_DIR = "C:\\RPA\\SavedAttachments";

// Where uploaded files (POSTed from the PC uploader) are kept.
// On Vercel serverless this is /tmp; on local it's the same invoice-bot dir.
function uploadsDir() {
  // Use /tmp on Vercel, otherwise the local invoice-bot dir.
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

export function listUploadedFiles() {
  const m = loadUploaded();
  return { uploaded: true, files: m.files };
}

function airtableListAll() {
  return new Promise((resolve, reject) => {
    const c = cfg();
    if (!c.apiKey || !c.baseId || !c.tableId) return resolve({ ok: false, error: "Airtable not configured" });
    const records = [];
    function fetchPage(offset) {
      const path = `/v0/${c.baseId}/${encodeURIComponent(c.tableId)}?pageSize=100${offset ? `&offset=${encodeURIComponent(offset)}` : ""}`;
      const req = https.request(
        {
          hostname: "api.airtable.com",
          port: 443,
          path,
          method: "GET",
          headers: { Authorization: `Bearer ${c.apiKey}` },
        },
        (res) => {
          const chunks = [];
          res.on("data", (x) => chunks.push(x));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error(`Airtable ${res.statusCode}: ${text}`));
            }
            let data;
            try { data = JSON.parse(text); } catch { return reject(new Error("Bad Airtable JSON: " + text)); }
            if (Array.isArray(data.records)) records.push(...data.records);
            if (data.offset) fetchPage(data.offset);
            else resolve({ ok: true, records });
          });
        }
      );
      req.on("error", reject);
      req.end();
    }
    fetchPage();
  });
}

export async function listAirtableFiles() {
  try {
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
  } catch (e) {
    return { ok: false, error: e.message, files: [] };
  }
}

export async function getAllKnownFiles() {
  // Combine local source folder + uploaded files + Airtable records.
  const local = listSourceFiles();
  const up = loadUploaded();
  const at = await listAirtableFiles();
  const uploadedAsLocal = up.files.map((f) => ({
    name: f.name,
    path: `uploaded://${f.name}`,
    size: f.size,
    modifiedAt: f.uploadedAt,
    source: "uploaded",
  }));
  const airtableAsLocal = (at.files || []).map((f) => ({
    name: f.name,
    path: f.path,
    size: f.size,
    modifiedAt: f.modifiedAt,
    source: "airtable",
    attachments: f.attachments,
    recordId: f.recordId,
  }));
  return {
    sourceDir: local.sourceDir,
    exists: local.exists,
    files: [...local.files, ...uploadedAsLocal, ...airtableAsLocal],
    airtable: at,
  };
}

export async function receiveUpload({ name, data, contentType }) {
  ensureUploadsDir();
  if (!name) throw new Error("Missing file name");
  const safe = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
  // de-dup by name
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
  const rec = {
    name: path.basename(dest),
    size: stat.size,
    uploadedAt: new Date().toISOString(),
    contentType: contentType || "application/octet-stream",
  };
  m.files.push(rec);
  saveUploaded(m);
  return rec;
}

function cfg() {
  return {
    sourceDir: process.env.RPA_ATTACHMENTS_DIR || DEFAULT_SOURCE_DIR,
    baseDir: process.env.SYNC_DIR || path.join(os.tmpdir(), "invoice-bot"),
    apiKey: process.env.AIRTABLE_API_KEY || "",
    baseId: process.env.AIRTABLE_BASE_ID || "",
    tableId: process.env.AIRTABLE_TABLE_ID || "",
  };
}

function manifestPath() {
  return path.join(cfg().baseDir, "synced-airtable.json");
}

function ensureDir() {
  const d = cfg().baseDir;
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function loadManifest() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(manifestPath(), "utf8"));
  } catch {
    return { records: [] };
  }
}

function saveManifest(m) {
  fs.writeFileSync(manifestPath(), JSON.stringify(m, null, 2), "utf8");
}

export function getSourceDir() {
  return cfg().sourceDir;
}

export function getSourceFileCount() {
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
        out.files.push({
          name,
          path: p,
          size: st.size,
          modifiedAt: st.mtime.toISOString(),
        });
      } catch {}
    }
    out.files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

function airtableRequest(method, urlPath, body, contentType) {
  return new Promise((resolve, reject) => {
    const data = body ? (Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body), "utf8")) : null;
    const opts = {
      hostname: "api.airtable.com",
      port: 443,
      path: urlPath,
      method,
      headers: {
        Authorization: `Bearer ${cfg().apiKey}`,
        "Content-Type": contentType || "application/json",
      },
    };
    if (data) opts.headers["Content-Length"] = data.length;

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(text));
          } catch {
            resolve({ raw: text });
          }
        } else {
          reject(new Error(`Airtable ${res.statusCode}: ${text}`));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function uploadOne(filePath, fileName) {
  const buf = fs.readFileSync(filePath);
  const created = await airtableRequest(
    "POST",
    `/v0/${cfg().baseId}/${encodeURIComponent(cfg().tableId)}`,
    { records: [{ fields: { "File Name": fileName, Date: new Date().toISOString() } }] },
    "application/json"
  );
  const recordId = created && created.records && created.records[0] && created.records[0].id;
  if (!recordId) throw new Error("Airtable: no record id returned");
  return recordId;
}

export async function syncAirtable() {
  const c = cfg();
  if (!c.apiKey || !c.baseId || !c.tableId) {
    return { ok: false, error: "Airtable not configured (set AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID).", added: [], total: 0, sourceCount: getSourceFileCount() };
  }
  if (!fs.existsSync(c.sourceDir)) {
    return { ok: false, error: `Source folder not found: ${c.sourceDir}`, added: [], total: 0, sourceCount: 0 };
  }

  const manifest = loadManifest();
  const known = new Set(manifest.records.map((r) => r.srcPath));
  const added = [];
  const files = fs.readdirSync(c.sourceDir);

  for (const name of files) {
    const src = path.join(c.sourceDir, name);
    let stat;
    try {
      stat = fs.statSync(src);
    } catch {
      continue;
    }
    if (!stat.isFile() || known.has(src)) continue;

    try {
      const recordId = await uploadOne(src, name);
      manifest.records.push({
        srcPath: src,
        fileName: name,
        recordId,
        syncedAt: new Date().toISOString(),
      });
      added.push({ fileName: name, recordId });
    } catch (e) {
      return { ok: false, error: e.message, added, total: manifest.records.length, sourceCount: files.length };
    }
  }

  if (added.length) saveManifest(manifest);

  return {
    ok: true,
    added,
    total: manifest.records.length,
    sourceCount: files.length,
    sourceDir: c.sourceDir,
  };
}

export function getAirtableStatus() {
  const c = cfg();
  const m = loadManifest();
  return {
    configured: Boolean(c.apiKey && c.baseId && c.tableId),
    total: m.records.length,
    records: m.records,
  };
}

