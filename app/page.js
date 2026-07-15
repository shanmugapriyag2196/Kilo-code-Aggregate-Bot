"use client";

import { useEffect, useRef, useState } from "react";

const REFRESH_MS = 60000;

export default function Dashboard() {
  const [status, setStatus] = useState("loading");
  const [count, setCount] = useState(0);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [diag, setDiag] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    const msg = params.get("msg");
    const s = params.get("s");
    if (s) {
      sessionStorage.setItem("sess", s);
      window.history.replaceState({}, "", "/");
    }
    if (err) {
      setAuthError(msg ? `${err}: ${decodeURIComponent(msg)}` : err);
      sessionStorage.removeItem("sess");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const seenRef = useRef(null);
  const notifyingRef = useRef(false);

  function getSession() {
    return sessionStorage.getItem("sess");
  }
  function setSession(blob) {
    if (blob) sessionStorage.setItem("sess", blob);
  }

  async function runDiagnostics() {
    try {
      const r = await fetch("/api/debug", { cache: "no-store" });
      setDiag(await r.json());
    } catch (e) {
      setDiag({ fetchError: e.message });
    }
  }

  async function load() {
    const blob = getSession();
    if (!blob) {
      setStatus("auth");
      return;
    }
    try {
      const res = await fetch("/api/emails", {
        cache: "no-store",
        headers: { "x-session": blob },
      });
      const newBlob = res.headers.get("x-session");
      if (newBlob) setSession(newBlob);
      if (res.status === 401) {
        sessionStorage.removeItem("sess");
        setStatus("auth");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
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
          headers: { "Content-Type": "application/json", "x-session": getSession() },
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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (status === "loading") {
    return (
      <div className="container">
        <p>Loading…</p>
      </div>
    );
  }

  if (status === "auth" || status === "error") {
    return (
      <div className="container">
        <header>
          <h1>Invoice Automation</h1>
        </header>

        <div className="stat">
          {authError && <div className="error">Sign-in failed: {authError}</div>}
          {status === "error" && <div className="error">Error: {error}</div>}
          <p>Connect your personal Outlook account to start tracking invoice emails.</p>
          <a className="btn" href="/api/auth/login">
            Connect Outlook
          </a>
          <div style={{ marginTop: 16 }}>
            <button className="btn secondary" onClick={runDiagnostics}>
              Run diagnostics
            </button>
          </div>
        </div>

        {diag && (
          <div className="list">
            <div className="item">
              <div className="subj">Runtime configuration</div>
              <div className="meta">
                <span>nodeEnv: {String(diag.nodeEnv)}</span>
                <span>clientId: {String(diag.hasClientId)}</span>
                <span>secret: {String(diag.hasSecret)}</span>
                <span>redirect: {String(diag.hasRedirect)}</span>
                <span>encKey: {String(diag.hasKey)} (len {diag.keyLen})</span>
              </div>
              {diag.redirect && (
                <div className="meta">
                  <span>redirectUri = {diag.redirect}</span>
                </div>
              )}
              {diag.fetchError && <div className="meta"><span>fetchError: {diag.fetchError}</span></div>}
              <div className="meta">
                <span>
                  {diag.hasClientId && diag.hasSecret && diag.hasRedirect && diag.keyValid
                    ? "All env vars present ✓"
                    : "MISSING env vars — set them in Vercel and redeploy"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>Invoice Automation</h1>
        <a
          className="btn secondary"
          href="/api/auth/logout"
          onClick={() => sessionStorage.removeItem("sess")}
        >
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
