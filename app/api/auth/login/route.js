import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthUrl } from "@/lib/outlook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const state = crypto.randomBytes(16).toString("hex");
  try {
    return NextResponse.redirect(getAuthUrl(state));
  } catch (e) {
    return NextResponse.redirect(new URL("/#error=config", request.url));
  }
}
