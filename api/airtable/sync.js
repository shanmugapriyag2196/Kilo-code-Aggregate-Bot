import { syncAirtable, getSourceFileCount } from "../../shared/api.js";

export const config = { runtime: "nodejs18.x" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  try {
    const r = await syncAirtable();
    res.status(200).json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, added: [], total: 0, sourceCount: getSourceFileCount() });
  }
}
