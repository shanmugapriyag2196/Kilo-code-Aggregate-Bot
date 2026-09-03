import { receiveUpload } from "../shared/api.js";

export const config = { runtime: "nodejs18.x" };

export default async function handler(req, res) {
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
