"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [connected, setConnected] = useState(null);
  const [count, setCount] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error")) setError(decodeURIComponent(hash.get("msg") || hash.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
    init();
  }, []);

  async function init() {
    const s = await fetch("/api/auth/status").then((r) => r.json()).catch(() => ({ connected: false }));
    setConnected(s.connected);
    if (s.connected) loadInbox();
    setLoading(false);
  }

  async function loadInbox() {
    try {
      const [cRes, mRes] = await Promise.all([
        fetch("/api/inbox/count", { cache: "no-store" }),
        fetch("/api/inbox/messages", { cache: "no-store" }),
      ]);
      if (cRes.status === 401 || mRes.status === 401) {
        setConnected(false);
        setCount(null);
        setMessages([]);
        return;
      }
      const cData = await cRes.json();
      const mData = await mRes.json();
      setCount(cData.count ?? 0);
      setMessages(mData.messages || []);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (!connected) return;
    loadInbox();
    const i = setInterval(loadInbox, 30000);
    return () => clearInterval(i);
  }, [connected]);

  if (loading) return <div className="container"><p>Loading…</p></div>;

  if (!connected) {
    return (
      <div className="container">
        <header><h1>Outlook Inbox</h1></header>
        <div className="stat">
          {error && <div className="error">Error: {error}</div>}
          <p>Connect your Outlook account to see your unread inbox count.</p>
          <a className="btn" href="/api/auth/login">Connect Outlook</a>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>Outlook Inbox</h1>
        <div>
          <span className="muted">{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ""}</span>
          <button className="btn secondary" onClick={loadInbox}>Refresh</button>
          <a className="btn secondary" href="/api/auth/logout">Disconnect</a>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="stat">
        <div className="num">{count ?? "—"}</div>
        <div className="label">unread emails in inbox</div>
      </div>

      <div className="list">
        {messages.length === 0 && <div className="empty">No unread messages.</div>}
        {messages.map((m) => (
          <div className="item" key={m.id}>
            <div className="subj">{m.subject || "(no subject)"}</div>
            <div className="meta">
              <span>{m.sender?.emailAddress?.name || m.sender?.emailAddress?.address || "unknown"}</span>
              <span>{new Date(m.receivedDateTime).toLocaleString()}</span>
              {m.hasAttachments && <span className="pill">has attachment</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
