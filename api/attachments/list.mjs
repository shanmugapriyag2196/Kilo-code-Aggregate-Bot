import { getAllKnownFiles } from "../shared/api.js";

export const config = { runtime: "nodejs18.x" };

export default async function handler(_req, res) {
  try {
    const data = await getAllKnownFiles();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message, files: [] });
  }
}
