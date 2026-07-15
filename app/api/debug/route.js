import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.ENCRYPTION_KEY || "";
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasClientId: !!process.env.MICROSOFT_CLIENT_ID,
    hasSecret: !!process.env.MICROSOFT_CLIENT_SECRET,
    hasRedirect: !!process.env.MICROSOFT_REDIRECT_URI,
    redirect: process.env.MICROSOFT_REDIRECT_URI || null,
    hasKey: !!process.env.ENCRYPTION_KEY,
    keyLen: key.length,
    keyValid: key.length === 64,
  });
}
