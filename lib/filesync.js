import fs from "fs";
import path from "path";

const SOURCE_DIR = process.env.RPA_ATTACHMENTS_DIR || "C:\\RPA\\SavedAttachments";
const INVOICES_DIR = path.join(process.cwd(), "invoices");
const MANIFEST_PATH = path.join(process.cwd(), "data", "synced-files.json");

function ensureDirs() {
  if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });
  const dataDir = path.dirname(MANIFEST_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return { files: [] };
  }
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

function safeName(name) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || "file";
}

function uniqueDest(name) {
  let destName = safeName(name);
  let dest = path.join(INVOICES_DIR, destName);
  let i = 1;
  while (fs.existsSync(dest)) {
    const ext = path.extname(destName);
    const stem = destName.slice(0, destName.length - ext.length);
    destName = `${stem}_${i}${ext}`;
    dest = path.join(INVOICES_DIR, destName);
    i++;
  }
  return { destName, dest };
}

export function getSourceDir() {
  return SOURCE_DIR;
}

export function scanAndSync() {
  ensureDirs();
  if (!fs.existsSync(SOURCE_DIR)) {
    return { ok: false, error: `Source folder not found: ${SOURCE_DIR}`, added: [], total: 0 };
  }

  const manifest = loadManifest();
  const known = new Set(manifest.files.map((f) => f.srcPath));
  const added = [];

  let entries = [];
  try {
    entries = fs.readdirSync(SOURCE_DIR);
  } catch (e) {
    return { ok: false, error: `Cannot read source folder: ${e.message}`, added, total: manifest.files.length };
  }

  for (const name of entries) {
    const src = path.join(SOURCE_DIR, name);
    let stat;
    try {
      stat = fs.statSync(src);
    } catch {
      continue;
    }
    if (!stat.isFile() || known.has(src)) continue;

    const { destName, dest } = uniqueDest(name);
    try {
      fs.copyFileSync(src, dest);
    } catch {
      continue;
    }

    const rec = {
      srcPath: src,
      destName,
      size: stat.size,
      syncedAt: new Date().toISOString(),
    };
    manifest.files.push(rec);
    added.push(rec);
  }

  if (added.length) saveManifest(manifest);

  return { ok: true, added, total: manifest.files.length, sourceDir: SOURCE_DIR };
}

export function getSyncedFiles() {
  const manifest = loadManifest();
  return manifest.files.map((f) => ({
    name: f.destName,
    size: f.size,
    syncedAt: f.syncedAt,
    source: f.srcPath,
  }));
}

export function watchSync(onChange, intervalMs = 5000) {
  const run = () => {
    const result = scanAndSync();
    if (onChange) onChange(result);
  };
  run();
  let watcher = null;
  try {
    watcher = fs.watch(SOURCE_DIR, { persistent: false }, () => run());
  } catch {
    // fall back to interval-only if fs.watch is unavailable
  }
  const timer = setInterval(run, intervalMs);
  return () => {
    if (watcher) watcher.close();
    clearInterval(timer);
  };
}
