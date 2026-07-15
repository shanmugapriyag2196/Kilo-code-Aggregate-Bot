import { NextResponse } from "next/server";
import { parseSession, refreshIfNeeded, getTodayInvoiceEmails, createSession } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(request) {
  const blob = request.headers.get("x-session");
  const tokens = parseSession(blob);
  if (!tokens) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  try {
    const updated = await refreshIfNeeded(tokens);
    const invoices = await getTodayInvoiceEmails(updated);
    const res = NextResponse.json({ authenticated: true, count: invoices.length, invoices });
    if (updated !== tokens) {
      res.headers.set("x-session", createSession(updated));
    }
    return res;
  } catch (e) {
    if (e.message === "NO_TOKEN") {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
