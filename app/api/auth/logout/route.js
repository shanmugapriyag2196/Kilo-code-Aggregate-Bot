import { NextResponse } from "next/server";
import { loadTokens } from "@/lib/crypto";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const TOKEN_FILE = path.join(process.cwd(), ".tokens.enc");
  try { fs.unlinkSync(TOKEN_FILE); } catch {}
  return NextResponse.redirect(new URL("/", process.env.PUBLIC_URL || "http://localhost:3000"));
}

export async function POST() {
  const TOKEN_FILE = path.join(process.cwd(), ".tokens.enc");
  try { fs.unlinkSync(TOKEN_FILE); } catch {}
  return NextResponse.json({ disconnected: true });
}
