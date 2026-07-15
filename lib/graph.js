import { decrypt, encrypt } from "./cookies";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TENANT = "consumers"; // personal Outlook.com / Hotmail accounts
const SCOPES = "openid profile offline_access Mail.Read Mail.Send";

export function getAuthUrl(state) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("Missing MICROSOFT_CLIENT_ID or MICROSOFT_REDIRECT_URI in environment variables.");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
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

// --- Cookie-free session: the encrypted token blob is held by the browser ---

export function createSession(tokens) {
  return encrypt(tokens);
}

export function parseSession(blob) {
  if (!blob) return null;
  try {
    return decrypt(blob);
  } catch {
    return null;
  }
}

export async function refreshIfNeeded(tokens) {
  if (Date.now() >= tokens.expires_at) {
    return refreshAccessToken(tokens.refresh_token);
  }
  return tokens;
}

export async function graphFetchWith(path, tokens, init = {}) {
  const res = await fetch(GRAPH + path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${tokens.access_token}`,
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
export async function getTodayInvoiceEmails(tokens) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const iso = start.toISOString();
  const path =
    `/me/messages?$filter=(receivedDateTime ge '${iso}') and (hasAttachments eq true)` +
    `&$expand=attachments($select=name,contentType)` +
    `&$select=subject,receivedDateTime,id,sender,hasAttachments` +
    `&$orderby=receivedDateTime desc&$top=50`;
  const data = await graphFetchWith(path, tokens);
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

export async function sendReminderEmail(tokens, invoices) {
  const me = await graphFetchWith("/me?$select=mail,userPrincipalName", tokens);
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
  await graphFetchWith("/me/sendMail", tokens, { method: "POST", body: JSON.stringify(body) });
  return to;
}
