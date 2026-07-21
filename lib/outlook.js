import { loadTokens, saveTokens } from "./crypto";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TENANT = "consumers";
const SCOPES = "openid profile offline_access Mail.Read";

export async function startDeviceCode() {
  const cid = process.env.MICROSOFT_CLIENT_ID;
  if (!cid) throw new Error("Missing MICROSOFT_CLIENT_ID.");

  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cid,
      scope: SCOPES,
    }),
  });
  if (!res.ok) throw new Error("Device code request failed: " + (await res.text()));
  return res.json(); // { user_code, verification_uri, device_code, expires_in, interval, message }
}

export async function pollDeviceCode(deviceCode) {
  const cid = process.env.MICROSOFT_CLIENT_ID;
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: cid,
      device_code: deviceCode,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    return { done: false, error: err.error_description || err.error };
  }
  const json = await res.json();
  const tokens = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
  };
  saveTokens(tokens);
  return { done: true, tokens };
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

export async function getValidToken() {
  let tokens = loadTokens();
  if (!tokens) return null;
  if (Date.now() >= tokens.expires_at) {
    const json = await tokenRequest({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
      scope: SCOPES,
    });
    tokens = {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: Date.now() + (json.expires_in - 60) * 1000,
    };
    saveTokens(tokens);
  }
  return tokens.access_token;
}

export async function getUnreadCount() {
  const token = await getValidToken();
  if (!token) return null;
  const res = await fetch(
    GRAPH + "/me/mailFolders/inbox/messages?$filter=isRead eq false&$top=1&$count=true",
    {
      headers: { Authorization: `Bearer ${token}`, "ConsistencyLevel": "eventual" },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    if (res.status === 401) return "EXPIRED";
    throw new Error(`Graph ${res.status}`);
  }
  const data = await res.json();
  return data["@odata.count"] ?? 0;
}

export async function getUnreadMessages() {
  const token = await getValidToken();
  if (!token) return null;
  const res = await fetch(
    GRAPH + "/me/mailFolders/inbox/messages?$filter=isRead eq false&$orderby=receivedDateTime desc&$top=50&$select=id,subject,receivedDateTime,sender,hasAttachments",
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) {
    if (res.status === 401) return "EXPIRED";
    throw new Error(`Graph ${res.status}`);
  }
  return (await res.json()).value || [];
}

export async function sendReminder(to, subject, bodyText) {
  const token = await getValidToken();
  if (!token) return false;
  const body = {
    message: { subject, body: { contentType: "text", content: bodyText }, toRecipients: [{ emailAddress: { address: to } }] },
    saveToSentItems: true,
  };
  const res = await fetch(GRAPH + "/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function getMyEmail() {
  const token = await getValidToken();
  if (!token) return null;
  const res = await fetch(GRAPH + "/me?$select=mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const me = await res.json();
  return me.mail || me.userPrincipalName;
}
