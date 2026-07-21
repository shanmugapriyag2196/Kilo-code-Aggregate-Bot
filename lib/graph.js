import { kv } from "@vercel/kv";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TENANT = "consumers";
const SCOPES = "openid profile offline_access Mail.Read";

export function getAuthUrl(state) {
  const cid = process.env.MICROSOFT_CLIENT_ID;
  const ru = process.env.MICROSOFT_REDIRECT_URI;
  if (!cid || !ru) throw new Error("Missing MICROSOFT_CLIENT_ID or MICROSOFT_REDIRECT_URI.");
  const params = new URLSearchParams({
    client_id: cid,
    response_type: "code",
    redirect_uri: ru,
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
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
  });
  return normalize(json);
}

export async function getValidToken() {
  let tokens = await kv.get("ms_tokens");
  if (!tokens) return null;
  if (Date.now() >= tokens.expires_at) {
    tokens = await tokenRequest({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
      scope: SCOPES,
    }).then(normalize);
    await kv.set("ms_tokens", tokens);
  }
  return tokens.access_token;
}

export async function getInboxUnreadCount() {
  const token = await getValidToken();
  if (!token) return null;
  const res = await fetch(
    GRAPH + "/me/mailFolders/inbox/messages?$filter=isRead eq false&$select=id&$top=1&$count=true",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "ConsistencyLevel": "eventual",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    if (res.status === 401) return "EXPIRED";
    throw new Error(`Graph ${res.status}`);
  }
  const data = await res.json();
  return data["@odata.count"] ?? data.value?.length ?? 0;
}

export async function getInboxMessages() {
  const token = await getValidToken();
  if (!token) return null;
  const res = await fetch(
    GRAPH + "/me/mailFolders/inbox/messages?$filter=isRead eq false&$orderby=receivedDateTime desc&$top=50&$select=id,subject,receivedDateTime,sender,hasAttachments",
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    if (res.status === 401) return "EXPIRED";
    throw new Error(`Graph ${res.status}`);
  }
  const data = await res.json();
  return data.value || [];
}
