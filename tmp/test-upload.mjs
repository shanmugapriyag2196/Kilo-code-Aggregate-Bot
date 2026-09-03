// shared/api.js
import fs from "fs";
import os from "os";
import path from "path";
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
function receiveUpload({ name, data, contentType }) {
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
  const rec = { name: path.basename(dest), size: stat.size, uploadedAt: (/* @__PURE__ */ new Date()).toISOString(), contentType: contentType || "application/octet-stream" };
  m.files.push(rec);
  saveUploaded(m);
  return rec;
}

// api/upload.mjs
var config = { runtime: "nodejs18.x" };
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const expected = process.env.UPLOAD_TOKEN;
  if (expected) {
    const got = req.headers["x-upload-token"];
    if (got !== expected) return res.status(401).json({ ok: false, error: "invalid token" });
  }
  try {
    const { name, data, contentType } = req.body || {};
    if (!data) return res.status(400).json({ ok: false, error: "missing data" });
    const rec = receiveUpload({ name, data, contentType });
    res.status(200).json({ ok: true, file: rec });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
export {
  config,
  handler as default
};
