import { NextResponse } from "next/server";
import { getStoredTokens, sendReminderEmail } from "@/lib/graph";

export const runtime = "nodejs";

export async function POST(request) {
  if (!(await getStoredTokens())) {
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
    const to = await sendReminderEmail(invoices);
    return NextResponse.json({ sent: true, to, count: invoices.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
