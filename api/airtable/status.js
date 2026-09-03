import { getAirtableStatus, getSourceDir, getSourceFileCount } from "../../shared/api.js";

export const config = { runtime: "nodejs18.x" };

export default function handler(_req, res) {
  res.status(200).json(getAirtableStatus());
}
