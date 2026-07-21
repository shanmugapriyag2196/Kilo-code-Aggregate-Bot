import { NextResponse } from "next/server";
import { getUnreadCount, getUnreadMessages, getMyEmail, sendReminder } from "@/lib/outlook";
import { loadTokens } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function apiError(status, message) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const tokens = loadTokens();
  if (!tokens) return apiError(401, "not connected");

  try {
    const [count, messages] = await Promise.all([getUnreadCount(), getUnreadMessages()]);
    if (count === "EXPIRED" || messages === "EXPIRED") {
      return apiError(401, "token expired, reconnect");
    }
    return NextResponse.json({ count, messages });
  } catch (e) {
    return apiError(500, e.message);
  }
}

export async function POST() {
  const tokens = loadTokens();
  if (!tokens) return apiError(401, "not connected");

  try {
    const [count, messages] = await Promise.all([getUnreadCount(), getUnreadMessages()]);
    if (count === "EXPIRED" || messages === "EXPIRED") {
      return apiError(401, "token expired, reconnect");
    }

    if (count > 0 && Array.isArray(messages)) {
      try {
        const me = await getMyEmail();
        if (me) {
          const subjects = messages.slice(0, 10).map(m => `- ${m.subject || "(no subject)"}`).join("\n");
          await sendReminder(me, `Outlook: ${count} unread email(s)`, `You have ${count} unread email(s):\n\n${subjects}`);
        }
      } catch {}
    }

    return NextResponse.json({ count, messages, reminded: count > 0 });
  } catch (e) {
    return apiError(500, e.message);
  }
}
