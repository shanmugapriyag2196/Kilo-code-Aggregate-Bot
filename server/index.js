import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getAllKnownFiles,
  listSourceFiles,
  listUploadedFiles,
  receiveUpload,
  getAirtableStatus,
  syncAirtable,
  getSourceDir,
  getSourceFileCount,
} from "../shared/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "20mb" }));

app.get("/api/attachments/count", async (_req, res) => {
  try {
    const all = await getAllKnownFiles();
    const local = listSourceFiles();
    const up = listUploadedFiles();
    res.json({
      sourceDir: getSourceDir(),
      count: all.files.length,
      fromLocal: local.exists ? local.files.length : 0,
      fromUploads: up.files.length,
      fromAirtable: (all.files || []).filter((f) => f.source === "airtable").length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, count: 0 });
  }
});

app.get("/api/attachments/list", async (_req, res) => {
  try {
    res.json(await getAllKnownFiles());
  } catch (e) {
    res.status(500).json({ error: e.message, files: [] });
  }
});

app.get("/api/uploaded", (_req, res) => res.json(listUploadedFiles()));

app.post("/api/upload", (req, res) => {
  const expected = process.env.UPLOAD_TOKEN;
  if (expected && req.headers["x-upload-token"] !== expected) {
    return res.status(401).json({ ok: false, error: "invalid token" });
  }
  try {
    const { name, data, contentType } = req.body || {};
    if (!data) return res.status(400).json({ ok: false, error: "missing data" });
    const rec = receiveUpload({ name, data, contentType });
    res.json({ ok: true, file: rec });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/airtable/status", (_req, res) => res.json(getAirtableStatus()));

app.get("/api/airtable/debug", (_req, res) => {
  res.json({
    sourceDir: getSourceDir(),
    sourceCount: getSourceFileCount(),
    airtable: {
      hasKey: Boolean(process.env.AIRTABLE_API_KEY),
      keyPrefix: process.env.AIRTABLE_API_KEY ? process.env.AIRTABLE_API_KEY.slice(0, 8) + "…" : null,
      baseId: process.env.AIRTABLE_BASE_ID || null,
      tableId: process.env.AIRTABLE_TABLE_ID || null,
      baseMatch: process.env.AIRTABLE_BASE_ID === "appk7XKYQBNBjuE5",
      tableMatch: process.env.AIRTABLE_TABLE_ID === "tbletDPR6YDhviL7g",
    },
  });
});

app.post("/api/airtable/sync", async (_req, res) => {
  try {
    res.json(await syncAirtable());
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, added: [], total: 0, sourceCount: getSourceFileCount() });
  }
});

const distDir = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
} else {
  app.get("/", (_req, res) => res.status(500).send("Dashboard not built yet. Run `npm run build` first."));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
