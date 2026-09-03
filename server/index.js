import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { syncAirtable, getAirtableStatus, getSourceDir, getSourceFileCount, listSourceFiles, listUploadedFiles, getAllKnownFiles, receiveUpload } from "./airtable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

app.get("/api/attachments/count", (_req, res) => {
  const all = getAllKnownFiles();
  res.json({
    sourceDir: getSourceDir(),
    count: all.files.length,
    fromLocal: all.exists ? listSourceFiles().files.length : 0,
    fromUploads: listUploadedFiles().files.length,
  });
});

app.get("/api/attachments/list", (_req, res) => {
  res.json(getAllKnownFiles());
});

app.get("/api/uploaded", (_req, res) => {
  res.json(listUploadedFiles());
});

app.post("/api/upload", async (req, res) => {
  const expected = process.env.UPLOAD_TOKEN;
  if (expected) {
    const got = req.headers["x-upload-token"];
    if (got !== expected) {
      return res.status(401).json({ ok: false, error: "invalid token" });
    }
  }
  try {
    const { name, data, contentType } = req.body || {};
    if (!data) return res.status(400).json({ ok: false, error: "missing data" });
    const rec = await receiveUpload({ name, data, contentType });
    res.json({ ok: true, file: rec });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/airtable/status", (_req, res) => {
  res.json(getAirtableStatus());
});

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
    const r = await syncAirtable();
    res.json(r);
  } catch (e) {
    res.json({ ok: false, error: e.message, added: [], total: 0, sourceCount: getSourceFileCount() });
  }
});

const distDir = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.status(500).send("Dashboard not built yet. Run `npm run build` first.");
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
