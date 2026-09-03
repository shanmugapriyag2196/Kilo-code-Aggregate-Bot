import { getSourceDir, getSourceFileCount } from "../../shared/api.js";

export const config = { runtime: "nodejs18.x" };

export default function handler(_req, res) {
  res.status(200).json({
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
}
