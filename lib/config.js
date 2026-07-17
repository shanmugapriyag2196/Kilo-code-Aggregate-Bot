import path from "path";
import fs from "fs";

function req(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v;
}

export const CONFIG = {
  PORT: parseInt(req("PORT", "3000"), 10),
  // Local folder where invoice PDFs are saved
  INVOICE_DIR: req("INVOICE_DIR", path.join(process.cwd(), "invoices")),
  DB_PATH: req("DB_PATH", path.join(process.cwd(), "data.db")),
  // Where the dashboard actually runs (for webhook / redirect)
  PUBLIC_URL: req("PUBLIC_URL", "http://localhost:3000"),
  // Microsoft Graph (personal Outlook)
  MICROSOFT_CLIENT_ID: req("MICROSOFT_CLIENT_ID"),
  MICROSOFT_CLIENT_SECRET: req("MICROSOFT_CLIENT_SECRET"),
  MICROSOFT_REDIRECT_URI: req(
    "MICROSOFT_REDIRECT_URI",
    "http://localhost:3000/api/auth/callback"
  ),
  ENCRYPTION_KEY: req("ENCRYPTION_KEY"),
  // Endpoint that resolves Buyer Name from {invoiceNo, vendor}
  BUYER_ENDPOINT: req("BUYER_ENDPOINT"),
  // QuickBooks Online (Phase: Excel + QB push)
  QB_CLIENT_ID: req("QB_CLIENT_ID"),
  QB_CLIENT_SECRET: req("QB_CLIENT_SECRET"),
  QB_REDIRECT_URI: req("QB_REDIRECT_URI", "http://localhost:3000/api/qb/callback"),
  QB_ENV: req("QB_ENV", "sandbox"),
};

export function ensureDirs() {
  if (!fs.existsSync(CONFIG.INVOICE_DIR)) fs.mkdirSync(CONFIG.INVOICE_DIR, { recursive: true });
  const dir = path.dirname(CONFIG.DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
