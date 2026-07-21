import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = await kv.get("ms_tokens");
  return NextResponse.json({ connected: !!tokens });
}

export async function POST() {
  await kv.del("ms_tokens");
  return NextResponse.json({ disconnected: true });
}
