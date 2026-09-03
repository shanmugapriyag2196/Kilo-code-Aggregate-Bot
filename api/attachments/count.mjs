import { getAllKnownFiles, getSourceDir, listSourceFiles, listUploadedFiles } from "../../../shared/api.js";

export const config = { runtime: "nodejs18.x" };

export default async function handler(_req, res) {
  try {
    const all = await getAllKnownFiles();
    const local = listSourceFiles();
    const up = listUploadedFiles();
    res.status(200).json({
      sourceDir: getSourceDir(),
      count: all.files.length,
      fromLocal: local.exists ? local.files.length : 0,
      fromUploads: up.files.length,
      fromAirtable: (all.files || []).filter((f) => f.source === "airtable").length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, count: 0 });
  }
}
