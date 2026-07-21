import { NextResponse } from "next/server";
import { loadTokens } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = loadTokens();
  return NextResponse.json({ connected: !!tokens });
}

export async function POST() {
  const { rm } = require("fs");
  const TOKEN_FILE = require("path").join(process.cwd(), ".tokens.enc");
  try { rm(TOKEN_FILE); } catch {}
  return NextResponse.json({ disconnected: true });
}
