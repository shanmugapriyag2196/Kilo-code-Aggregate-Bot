import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request) {
  cookies().delete("ms_tokens");
  cookies().delete("ms_oauth_state");
  return NextResponse.redirect(new URL("/", new URL(request.url).origin));
}
