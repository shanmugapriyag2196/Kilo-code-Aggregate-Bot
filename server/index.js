import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { syncAirtable, getAirtableStatus, getSourceDir, getSourceFileCount } from "./airtable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

app.get("/api/attachments/count", (_req, res) => {
  res.json({
    sourceDir: getSourceDir(),
    count: getSourceFileCount(),
  });
});

app.get("/api/airtable/status", (_req, res) => {
  res.json(getAirtableStatus());
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
