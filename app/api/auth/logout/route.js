import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.redirect(new URL("/", new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").origin));
}
