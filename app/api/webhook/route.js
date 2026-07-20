import { NextResponse } from "next/server";
import { processEmail } from "@/lib/pipeline";
import { loadTokens } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  const notifications = body.value || [];
  const token = loadTokens();
  const results = [];
  for (const n of notifications) {
    const resource = n.resource || "";
    const messageId = resource.split("('")[1]?.split("')")[0] || resource.split("/")[1];
    if (messageId && token) {
      try {
        results.push(await processEmail(messageId));
      } catch (e) {
        results.push({ error: String(e.message) });
      }
    }
  }
  return NextResponse.json({ received: notifications.length, results });
}

export async function GET(request) {
  const url = new URL(request.url);
  const validation = url.searchParams.get("validationToken");
  if (validation) {
    return new NextResponse(validation, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ ok: true });
}
