import fs from "fs";
import os from "os";
import path from "path";
import https from "https";
import { config as loadEnv } from "dotenv";

// Load .env.local first (highest priority), then .env.
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const DEFAULT_SOURCE_DIR = "C:\\RPA\\SavedAttachments";

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

