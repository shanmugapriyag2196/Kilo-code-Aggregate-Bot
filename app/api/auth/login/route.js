import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getAuthUrl } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(request) {
  const state = crypto.randomBytes(16).toString("hex");
  cookies().set("ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  try {
    return NextResponse.redirect(getAuthUrl(state));
  } catch (e) {
    return NextResponse.redirect(new URL("/?error=config", request.url));
  }
}
