"use client";

import { useEffect, useState, useRef } from "react";

export default function Dashboard() {
  const [connected, setConnected] = useState(null);
  const [count, setCount] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reminded, setReminded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Device code flow state
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function init() {
    try {
      const s = await fetch("/api/auth/status").then(r => r.json()).catch(() => ({ connected: false }));
      setConnected(s.connected);
      if (s.connected) loadInbox();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function loadInbox() {
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      if (res.status === 401) {
        setConnected(false);
        setCount(null);
        setMessages([]);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load");
        return;
      }
      const data = await res.json();
      setCount(data.count ?? 0);
      setMessages(data.messages || []);
      setReminded(data.reminded || false);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendReminderNow() {
    try {
      const res = await fetch("/api/sync", { method: "POST", cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setReminded(true);
        setTimeout(() => setReminded(false), 5000);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  // Device Code Flow
  async function startConnect() {
    setError(null);
    setDeviceInfo(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST" });
      const data = await res.json();
      if (data.userCode) {
        setDeviceInfo(data);
        setPolling(true);
        pollRef.current = setInterval(async () => {
          try {
            const pRes = await fetch(`/api/auth/login?device_code=${encodeURIComponent(data.userCode)}`);
            const pData = await pRes.json();
            if (pData.connected) {
              clearInterval(pollRef.current);
              setPolling(false);
              setDeviceInfo(null);
              setConnected(true);
              loadInbox();
            } else if (pData.error && pData.error !== "slow_down" && pData.error !== "authorization_pending") {
              clearInterval(pollRef.current);
              setPolling(false);
              setDeviceInfo(null);
              setError("Connection failed: " + pData.error);
            }
          } catch {}
        }, 3000);
      } else {
        setError(data.error || "Failed to start device code flow");
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function disconnect() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(false);
    setDeviceInfo(null);
    await fetch("/api/auth/status", { method: "POST" });
    setConnected(false);
    setCount(null);
    setMessages([]);
  }

  useEffect(() => {
    if (!connected) return;
    loadInbox();
    const i = setInterval(loadInbox, 60000);
    return () => clearInterval(i);
  }, [connected]);

  if (loading) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container">
      <header>
        <h1>Outlook Inbox</h1>
        {connected && (
          <div>
            <span className="muted">{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ""}</span>
            <button className="btn secondary" onClick={loadInbox}>Refresh</button>
            {count > 0 && <button className="btn secondary" onClick={sendReminderNow}>Remind me</button>}
            <button className="btn secondary" onClick={disconnect}>Disconnect</button>
          </div>
        )}
      </header>

      {error && <div className="error">Error: {error}</div>}
      {reminded && <div className="banner">Reminder email sent!</div>}

      {!connected && !deviceInfo && (
        <div className="stat">
          <p>Connect your Outlook account to see your unread inbox count.</p>
          <button className="btn" onClick={startConnect}>Connect Outlook</button>
        </div>
      )}

      {!connected && deviceInfo && (
        <div className="stat">
          <h3>Step 1: Copy this code</h3>
          <div className="code-box">{deviceInfo.userCode}</div>
          <h3>Step 2: Open this URL and enter the code</h3>
          <a className="btn" href={deviceInfo.verificationUri} target="_blank" rel="noreferrer">
            Open {deviceInfo.verificationUri}
          </a>
          <p className="muted">{deviceInfo.message}</p>
          {polling && <p className="muted">Waiting for sign-in… (polling every 3s)</p>}
          <button className="btn secondary" onClick={() => { setDeviceInfo(null); setPolling(false); }}>Cancel</button>
        </div>
      )}

      {connected && (
        <>
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
        </>
      )}
    </div>
  );
}
