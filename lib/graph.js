import { cookies } from "next/headers";
import { decrypt, encrypt } from "./cookies";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TENANT = "consumers"; // personal Outlook.com / Hotmail accounts
const SCOPES = "openid profile offline_access Mail.Read Mail.Send";

export function getAuthUrl(state) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error(
      "Missing MICROSOFT_CLIENT_ID or MICROSOFT_REDIRECT_URI in environment variables."
    );
  }
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    scope: SCOPES,
    response_mode: "query",
    state,
  });
  return `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${params}`;
}

async function tokenRequest(body) {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new Error("Token request failed: " + (await res.text()));
  }
  return res.json();
}

export async function exchangeCode(code) {
  const json = await tokenRequest({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
  });
  return normalize(json);
}

export async function refreshAccessToken(refreshToken) {
  const json = await tokenRequest({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES,
  });
  return normalize(json);
}

function normalize(json) {
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
  };
}

export async function getStoredTokens() {
  const c = cookies().get("ms_tokens");
  if (!c) return null;
  try {
    return decrypt(c.value);
  } catch {
    return null;
  }
}

export async function setStoredTokens(tokens) {
  cookies().set("ms_tokens", encrypt(tokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getAccessToken() {
  const tokens = await getStoredTokens();
  if (!tokens) return null;
  if (Date.now() >= tokens.expires_at) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    await setStoredTokens(refreshed);
    return refreshed.access_token;
  }
  return tokens.access_token;
}

export async function graphFetch(path, init = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("NO_TOKEN");
  const res = await fetch(GRAPH + path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("NO_TOKEN");
    throw new Error(`Graph ${res.status}: ${text}`);
  }
  return res.json();
}

// Fetch today's emails that have a PDF attachment (invoice candidates).
export async function getTodayInvoiceEmails() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const iso = start.toISOString();
  const path =
    `/me/messages?$filter=(receivedDateTime ge '${iso}') and (hasAttachments eq true)` +
    `&$expand=attachments($select=name,contentType)` +
    `&$select=subject,receivedDateTime,id,sender,hasAttachments` +
    `&$orderby=receivedDateTime desc&$top=50`;
  const data = await graphFetch(path);
  const value = data.value || [];
  return value
    .filter((m) =>
      (m.attachments || []).some(
        (a) => a.contentType === "application/pdf" || (a.name || "").toLowerCase().endsWith(".pdf")
      )
    )
    .map((m) => ({
      id: m.id,
      subject: m.subject || "(no subject)",
      receivedDateTime: m.receivedDateTime,
      sender: m.sender?.emailAddress?.address || "",
      senderName: m.sender?.emailAddress?.name || "",
      attachments: (m.attachments || [])
        .filter((a) => a.contentType === "application/pdf" || (a.name || "").toLowerCase().endsWith(".pdf"))
        .map((a) => a.name),
    }));
}

export async function sendReminderEmail(invoices) {
  const me = await graphFetch("/me?$select=mail,userPrincipalName");
  const to = me.mail || me.userPrincipalName;
  const lines = invoices
    .map((m) => `- ${m.subject} from ${m.senderName || m.sender} (${new Date(m.receivedDateTime).toLocaleString()})`)
    .join("\n");
  const body = {
    message: {
      subject: `New invoice email received (${invoices.length})`,
      body: {
        contentType: "text",
        content: `You have ${invoices.length} new invoice email(s) with PDF attachment(s):\n\n${lines}`,
      },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  };
  await graphFetch("/me/sendMail", { method: "POST", body: JSON.stringify(body) });
  return to;
}
