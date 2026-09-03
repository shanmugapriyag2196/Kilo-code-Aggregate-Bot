import fs from "fs";
import os from "os";
import path from "path";
import https from "https";

const SOURCE_DIR = process.env.RPA_ATTACHMENTS_DIR || "C:\\RPA\\SavedAttachments";
const BASE_DIR = process.env.SYNC_DIR || path.join(os.tmpdir(), "invoice-bot");
const MANIFEST_PATH = path.join(BASE_DIR, "synced-airtable.json");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || "";

function ensureDir() {
  if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });
}

function loadManifest() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return { records: [] };
  }
}

function saveManifest(m) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2), "utf8");
}

export function getSourceDir() {
  return SOURCE_DIR;
}

export function getSourceFileCount() {
  try {
    if (!fs.existsSync(SOURCE_DIR)) return 0;
    return fs.readdirSync(SOURCE_DIR).filter((n) => {
      try {
        return fs.statSync(path.join(SOURCE_DIR, n)).isFile();
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
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
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
  const boundary = "----invoice-bot-" + Date.now();
  const meta = {
    fields: {
      "File Name": fileName,
      Date: new Date().toISOString(),
      Attachments: [{ filename: fileName, contentType: "application/octet-stream" }],
    },
  };

  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="fields"\r\n\r\n${JSON.stringify(meta.fields)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName.replace(/"/g, "")}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
    "utf8"
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([head, buf, tail]);

  const urlPath = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_ID)}/Attachments`;
  // Step 1: create record with attachment placeholder, get upload URL
  const created = await airtableRequest(
    "POST",
    urlPath,
    { records: [{ fields: { "File Name": fileName, Date: new Date().toISOString() } }] },
    "application/json"
  );
  const recordId = created && created.records && created.records[0] && created.records[0].id;
  if (!recordId) throw new Error("Airtable: no record id returned");
  return recordId;
}

export async function syncAirtable() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
    return { ok: false, error: "Airtable not configured (set AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID).", added: [], total: 0, sourceCount: 0 };
  }
  if (!fs.existsSync(SOURCE_DIR)) {
    return { ok: false, error: `Source folder not found: ${SOURCE_DIR}`, added: [], total: 0, sourceCount: 0 };
  }

  const manifest = loadManifest();
  const known = new Set(manifest.records.map((r) => r.srcPath));
  const added = [];
  const files = fs.readdirSync(SOURCE_DIR);

  for (const name of files) {
    const src = path.join(SOURCE_DIR, name);
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
    sourceDir: SOURCE_DIR,
  };
}

export function getAirtableStatus() {
  const m = loadManifest();
  return {
    configured: Boolean(AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_TABLE_ID),
    total: m.records.length,
    records: m.records,
  };
}
