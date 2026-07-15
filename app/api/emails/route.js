import { NextResponse } from "next/server";
import { getStoredTokens, getTodayInvoiceEmails } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET() {
  if (!(await getStoredTokens())) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  try {
    const invoices = await getTodayInvoiceEmails();
    return NextResponse.json({ authenticated: true, count: invoices.length, invoices });
  } catch (e) {
    if (e.message === "NO_TOKEN") {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
