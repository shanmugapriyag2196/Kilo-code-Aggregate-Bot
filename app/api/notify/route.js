import { NextResponse } from "next/server";
import { parseSession, sendReminderEmail, createSession, refreshIfNeeded } from "@/lib/graph";

export const runtime = "nodejs";

export async function POST(request) {
  const blob = request.headers.get("x-session");
  const tokens = parseSession(blob);
  if (!tokens) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  let invoices = [];
  try {
    const body = await request.json();
    invoices = body.invoices || [];
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return NextResponse.json({ skipped: true });
  }
  try {
    await refreshIfNeeded(tokens);
    const to = await sendReminderEmail(tokens, invoices);
    return NextResponse.json({ sent: true, to, count: invoices.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
