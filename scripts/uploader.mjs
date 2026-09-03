#!/usr/bin/env node
// PC uploader: watches the local RPA folder and POSTs any new file to the bot.
//
// Setup (one time):
//   1. Pick any random secret, e.g.   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
//   2. Set the same secret in the bot's environment as UPLOAD_TOKEN, and in
//      a .env file next to this script as UPLOAD_TOKEN.
//   3. Set UPLOAD_URL to your deployment, e.g. https://your-app.vercel.app/api/upload
//   4. Run:  node scripts/uploader.mjs
//      Or:    npm run uploader
//
// This script NEVER reads or contains the Airtable token.

import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
loadEnv({ path: path.join(ROOT, ".env.local") });
loadEnv({ path: path.join(ROOT, ".env") });

const SOURCE_DIR = process.env.RPA_ATTACHMENTS_DIR || "C:\\RPA\\SavedAttachments";
const UPLOAD_URL = process.env.UPLOAD_URL || "http://localhost:3000/api/upload";
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN || "";
const STATE_FILE = process.env.UPLOADER_STATE || path.join(ROOT, "data", "uploader-state.json");
const INTERVAL_MS = Number(process.env.UPLOADER_INTERVAL_MS || 5000);

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`[uploader] Source folder not found: ${SOURCE_DIR}`);
  console.error(`[uploader] Set RPA_ATTACHMENTS_DIR in your .env.local and try again.`);
  process.exit(1);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { files: {} };
  }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), "utf8");
}

function postFile(name, buf) {
  return new Promise((resolve, reject) => {
    const url = new URL(UPLOAD_URL);
    const body = JSON.stringify({
      name,
      contentType: "application/octet-stream",
      data: buf.toString("base64"),
    });
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...(UPLOAD_TOKEN ? { "X-Upload-Token": UPLOAD_TOKEN } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(text)); } catch { resolve({ raw: text }); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${text}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function scanAndUpload() {
  const state = loadState();
  const entries = fs.readdirSync(SOURCE_DIR);
  let uploaded = 0;
  for (const name of entries) {
    const src = path.join(SOURCE_DIR, name);
    let stat;
    try { stat = fs.statSync(src); } catch { continue; }
    if (!stat.isFile()) continue;
    const key = src;
    const prev = state.files[key];
    if (prev && prev.size === stat.size && prev.mtimeMs === stat.mtimeMs) continue;
    const buf = fs.readFileSync(src);
    try {
      const r = await postFile(name, buf);
      state.files[key] = { size: stat.size, mtimeMs: stat.mtimeMs, uploadedAt: new Date().toISOString(), record: r };
      uploaded++;
      console.log(`[uploader] uploaded: ${name} (${stat.size} bytes)`);
    } catch (e) {
      console.error(`[uploader] FAIL ${name}: ${e.message}`);
    }
  }
  if (uploaded) saveState(state);
}

async function main() {
  console.log(`[uploader] source: ${SOURCE_DIR}`);
  console.log(`[uploader] target: ${UPLOAD_URL}`);
  console.log(`[uploader] token:  ${UPLOAD_TOKEN ? "set (" + UPLOAD_TOKEN.slice(0, 4) + "…)" : "NOT SET (server will accept any)"}`);
  let watcher = null;
  try { watcher = fs.watch(SOURCE_DIR, { persistent: false }, () => scanAndUpload()); } catch {}
  await scanAndUpload();
  const timer = setInterval(scanAndUpload, INTERVAL_MS);
  process.on("SIGINT", () => {
    console.log("\n[uploader] stopping…");
    if (watcher) watcher.close();
    clearInterval(timer);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("[uploader] fatal:", e);
  process.exit(1);
});
