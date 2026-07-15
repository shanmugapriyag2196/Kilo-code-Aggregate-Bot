"use client";

import { useEffect, useRef, useState } from "react";

const REFRESH_MS = 60000;

export default function Dashboard() {
  const [status, setStatus] = useState("loading"); // loading | auth | ready | error
  const [count, setCount] = useState(0);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);

  const seenRef = useRef(null);
  const notifyingRef = useRef(false);

  async function load() {
    try {
      const res = await fetch("/api/emails", { cache: "no-store" });
      if (res.status === 401) {
        setStatus("auth");
        return;
      }
      if (!res.ok) {
        setError("Failed to load emails.");
        setStatus("error");
        return;
      }
      const json = await res.json();
      const newOnes = json.invoices.filter((m) => !seenRef.current?.has(m.id));
      if (seenRef.current && newOnes.length > 0 && !notifyingRef.current) {
        notifyingRef.current = true;
        setBanner(`New invoice email(s) detected — sending email reminder for ${newOnes.length}.`);
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoices: newOnes }),
        }).catch(() => {});
        setTimeout(() => setBanner(null), 8000);
        setTimeout(() => (notifyingRef.current = false), 12000);
      }
      seenRef.current = new Set(json.invoices.map((m) => m.id));
      setCount(json.count);
      setInvoices(json.invoices);
      setError(null);
      setStatus("ready");
    } catch (e) {
      setError(e.message || "Network error");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, REFRESH_MS);
    return () => clearInterval(i);
  }, []);

  if (status === "loading") {
    return (
      <div className="container">
        <p>Loading…</p>
      </div>
    );
  }

  if (status === "auth") {
    return (
      <div className="container">
        <header>
          <h1>Invoice Automation</h1>
        </header>
        <div className="stat">
          <p>Connect your personal Outlook account to start tracking invoice emails.</p>
          <a className="btn" href="/api/auth/login">
            Connect Outlook
          </a>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="container">
      <header>
        <h1>Invoice Automation</h1>
        <a className="btn secondary" href="/api/auth/logout">
          Disconnect
        </a>
      </header>

      {banner && <div className="banner">{banner}</div>}
      {error && <div className="error">{error}</div>}

      <div className="stat">
        <div className="num">{count}</div>
        <div className="label">invoice emails received today ({today})</div>
      </div>

      <div className="list">
        {invoices.length === 0 && <div className="empty">No invoice emails with PDFs yet today.</div>}
        {invoices.map((m) => (
          <div className="item" key={m.id}>
            <div className="subj">{m.subject}</div>
            <div className="meta">
              <span>{m.senderName || m.sender}</span>
              <span>{new Date(m.receivedDateTime).toLocaleString()}</span>
              <span className="pill">{m.attachments.join(", ")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
