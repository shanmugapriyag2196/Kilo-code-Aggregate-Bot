import { CONFIG } from "./config";
import { loadTokens, saveTokens } from "./db";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TENANT = "consumers";
const SCOPES = "openid profile offline_access Mail.Read Mail.Send";

export function getAuthUrl(state) {
  if (!CONFIG.MICROSOFT_CLIENT_ID || !CONFIG.MICROSOFT_REDIRECT_URI) {
    throw new Error("Missing MICROSOFT_CLIENT_ID or MICROSOFT_REDIRECT_URI.");
  }
  const params = new URLSearchParams({
    client_id: CONFIG.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: CONFIG.MICROSOFT_REDIRECT_URI,
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
  if (!res.ok) throw new Error("Token request failed: " + (await res.text()));
  return res.json();
}
function normalize(json) {
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
  };
}

export async function exchangeCode(code) {
  const json = await tokenRequest({
    client_id: CONFIG.MICROSOFT_CLIENT_ID,
    client_secret: CONFIG.MICROSOFT_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: CONFIG.MICROSOFT_REDIRECT_URI,
  });
  return normalize(json);
}

export async function getValidToken() {
  let tokens = loadTokens();
  if (!tokens) return null;
  if (Date.now() >= tokens.expires_at) {
    const refreshed = await tokenRequest({
      client_id: CONFIG.MICROSOFT_CLIENT_ID,
      client_secret: CONFIG.MICROSOFT_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
      scope: SCOPES,
    }).then(normalize);
    saveTokens(refreshed);
    tokens = refreshed;
  }
  return tokens.access_token;
}

async function graphFetch(path, token, init = {}) {
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
  return res;
}

export async function listMessagesSince(sinceIso) {
  const token = await getValidToken();
  if (!token) return [];
  const filter = `(receivedDateTime ge '${sinceIso}') and (hasAttachments eq true)`;
  const url = `/me/messages?$filter=${encodeURIComponent(filter)}&$select=id,subject,receivedDateTime,sender,hasAttachments&$orderby=receivedDateTime desc&$top=50`;
  const res = await graphFetch(url, token);
  const data = await res.json();
  return data.value || [];
}

export async function getMessage(token, id) {
  const res = await graphFetch(`/me/messages/${id}?$select=id,subject,receivedDateTime,sender,hasAttachments`, token);
  return res.json();
}

export async function getPdfAttachments(token, id) {
  const res = await graphFetch(`/me/messages/${id}/attachments?$select=id,name,contentType,contentBytes`, token);
  const data = await res.json();
  return (data.value || []).filter(
    (a) => a.contentType === "application/pdf" || (a.name || "").toLowerCase().endsWith(".pdf")
  );
}

export async function downloadAttachment(token, messageId, attachmentId) {
  const res = await graphFetch(`/me/messages/${messageId}/attachments/${attachmentId}/$value`, token);
  return Buffer.from(await res.arrayBuffer());
}

export async function sendReminderEmail(to, subject, bodyText) {
  const token = await getValidToken();
  if (!token) return false;
  const body = {
    message: {
      subject,
      body: { contentType: "text", content: bodyText },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  };
  await graphFetch("/me/sendMail", token, { method: "POST", body: JSON.stringify(body) });
  return true;
}

export async function getMyEmail() {
  const token = await getValidToken();
  if (!token) return null;
  const res = await graphFetch("/me?$select=mail,userPrincipalName", token);
  const me = await res.json();
  return me.mail || me.userPrincipalName;
}
