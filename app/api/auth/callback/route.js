import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, setStoredTokens } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies().get("ms_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", url.origin));
  }
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL("/?error=state_mismatch", url.origin));
  }

  try {
    const tokens = await exchangeCode(code);
    await setStoredTokens(tokens);
    cookies().delete("ms_oauth_state");
    return NextResponse.redirect(new URL("/", url.origin));
  } catch (e) {
    console.error("CALLBACK_AUTH_ERROR:", e);
    const msg = encodeURIComponent(String(e.message || e).slice(0, 220));
    return NextResponse.redirect(new URL(`/?error=auth_failed&msg=${msg}`, url.origin));
  }
}
