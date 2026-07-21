import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/outlook";
import { saveTokens } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/#error=no_code", url.origin));
  try {
    const tokens = await exchangeCode(code);
    saveTokens(tokens);
    return NextResponse.redirect(new URL("/#s=ok", url.origin));
  } catch (e) {
    console.error("CALLBACK_AUTH_ERROR:", e);
    const msg = encodeURIComponent(String(e.message || e).slice(0, 220));
    return NextResponse.redirect(new URL(`/#error=auth_failed&msg=${msg}`, url.origin));
  }
}
