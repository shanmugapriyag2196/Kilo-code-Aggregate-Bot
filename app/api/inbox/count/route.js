import { NextResponse } from "next/server";
import { getInboxUnreadCount } from "@/lib/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const count = await getInboxUnreadCount();
  if (count === null) return NextResponse.json({ error: "not connected" }, { status: 401 });
  if (count === "EXPIRED") return NextResponse.json({ error: "token expired, reconnect" }, { status: 401 });
  return NextResponse.json({ count });
}
