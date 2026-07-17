import { NextResponse } from "next/server";
import { loadTokens } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = loadTokens();
  return NextResponse.json({ connected: !!tokens });
}
