import { NextResponse } from "next/server";
import { getInboxMessages } from "@/lib/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const messages = await getInboxMessages();
  if (messages === null) return NextResponse.json({ error: "not connected" }, { status: 401 });
  if (messages === "EXPIRED") return NextResponse.json({ error: "token expired, reconnect" }, { status: 401 });
  return NextResponse.json({ messages });
}
