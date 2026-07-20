import { NextResponse } from "next/server";
import db, { getSetting, setSetting, loadTokens } from "@/lib/db";
import { listMessagesSince } from "@/lib/graph";
import { processEmail } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const token = loadTokens();
  if (!token) return NextResponse.json({ error: "not connected" }, { status: 401 });

  const since = getSetting("last_sync");
  const sinceIso = since || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const messages = await listMessagesSince(sinceIso);
  const results = [];
  for (const m of messages) {
    try {
      results.push(await processEmail(m.id));
    } catch (e) {
      results.push({ error: String(e.message) });
    }
  }
  setSetting("last_sync", new Date().toISOString());

  return NextResponse.json({ processed: results.length, results });
}
