import { NextResponse } from "next/server";
import { startDeviceCode, pollDeviceCode } from "@/lib/outlook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Store pending device codes in memory (map of deviceCode -> { userCode, verificationUri, expiresAt })
const pending = new Map();

export async function POST(request) {
  const result = await startDeviceCode();
  pending.set(result.user_code, {
    deviceCode: result.device_code,
    verificationUri: result.verification_uri,
    expiresAt: Date.now() + result.expires_in * 1000,
    interval: result.interval || 5000,
  });
  return NextResponse.json({
    userCode: result.user_code,
    verificationUri: result.verification_uri,
    message: result.message,
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const userCode = url.searchParams.get("device_code"); // frontend sends userCode here
  if (!userCode) return NextResponse.json({ error: "device_code required" }, { status: 400 });

  const entry = pending.get(userCode);
  if (!entry) return NextResponse.json({ error: "not found or expired" }, { status: 404 });

  if (Date.now() > entry.expiresAt) {
    pending.delete(userCode);
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const result = await pollDeviceCode(entry.deviceCode);
  if (result.done) {
    pending.delete(userCode);
    return NextResponse.json({ connected: true });
  }
  if (result.error === "authorization_pending" || result.error === "slow_down") {
    return NextResponse.json({ waiting: true, error: result.error });
  }
  return NextResponse.json({ error: result.error }, { status: 400 });
}
