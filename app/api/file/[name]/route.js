import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getInvoicesDir } from "@/lib/filesync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICES_DIR = getInvoicesDir();

export async function GET(req, { params }) {
  const name = params.name;
  // Prevent path traversal: only allow a single basename.
  if (!name || name !== path.basename(name) || name.includes("..")) {
    return NextResponse.json({ error: "invalid name" }, { status: 400 });
  }
  const filePath = path.join(INVOICES_DIR, name);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const ext = path.extname(name).toLowerCase();
  const contentType =
    ext === ".pdf" ? "application/pdf"
    : ext === ".png" ? "image/png"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : "application/octet-stream";

  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
