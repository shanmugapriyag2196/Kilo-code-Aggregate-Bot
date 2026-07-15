import { NextResponse } from "next/server";
import { exchangeCode, createSession } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", url.origin));
  }

  try {
    const tokens = await exchangeCode(code);
    const blob = createSession(tokens);
    return NextResponse.redirect(new URL(`/?s=${encodeURIComponent(blob)}`, url.origin));
  } catch (e) {
    console.error("CALLBACK_AUTH_ERROR:", e);
    const msg = encodeURIComponent(String(e.message || e).slice(0, 220));
    return NextResponse.redirect(new URL(`/?error=auth_failed&msg=${msg}`, url.origin));
  }
}
