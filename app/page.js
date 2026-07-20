"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "INBOX",
  "EXTRACTED",
  "MATCHED",
  "PENDING_BUYER",
  "PENDING_MANAGER",
  "EXPORTED_QB",
  "DONE",
];

const STAGE_LABEL = {
  INBOX: "Inbox / Needs Review",
  EXTRACTED: "Extracted",
  MATCHED: "Matched (Buyer)",
  PENDING_BUYER: "Pending Buyer",
  PENDING_MANAGER: "Pending Manager",
  EXPORTED_QB: "Exported QB",
  DONE: "Done",
};

export default function Dashboard() {
  const [connected, setConnected] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncMsg, setSyncMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error")) setError(decodeURIComponent(hash.get("msg") || hash.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
    load();
  }, []);

  async function load() {
    const status = await fetch("/api/auth/status").then((r) => r.json()).catch(() => ({ connected: false }));
    setConnected(status.connected);
    if (!status.connected) {
      setLoading(false);
      return;
    }
    const data = await fetch("/api/invoices").then((r) => r.json()).catch(() => ({ invoices: [] }));
    setInvoices(data.invoices || []);
    setLoading(false);
  }

  async function runSync() {
    setSyncMsg("Syncing…");
    const r = await fetch("/api/cron/sync", { method: "POST" }).then((r) => r.json()).catch((e) => ({ error: e.message }));
    setSyncMsg(JSON.stringify(r).slice(0, 200));
    load();
  }

  async function updateInvoice(id, fields) {
    await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    load();
    setSelected(null);
  }

  if (loading) return <div className="container"><p>Loading…</p></div>;

  if (!connected) {
    return (
      <div className="container">
        <h1>Invoice Automation</h1>
        <div className="stat">
          {error && <div className="error">Error: {error}</div>}
          <p>Connect your Outlook account to start auto-syncing invoice emails.</p>
          <a className="btn" href="/api/auth/login">Connect Outlook</a>
        </div>
      </div>
    );
  }

  const byStage = (s) => invoices.filter((i) => i.stage === s);
  const today = invoices.filter(
    (i) => i.received_at && new Date(i.received_at) > new Date(new Date().setHours(0, 0, 0, 0))
  );
  const pendingAmount = invoices
    .filter((i) => ["MATCHED", "PENDING_BUYER", "PENDING_MANAGER"].includes(i.stage))
    .reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);
  const exceptions = invoices.filter((i) => i.needs_review).length;

  return (
    <div className="container">
      <header>
        <h1>Invoice Automation</h1>
        <div>
          <button className="btn secondary" onClick={runSync}>Sync now</button>
        </div>
      </header>

      {syncMsg && <div className="banner">{syncMsg}</div>}
      {error && <div className="error">{error}</div>}

      <div className="kpis">
        <div className="kpi"><div className="num">{today.length}</div><div>received today</div></div>
        <div className="kpi"><div className="num">{invoices.length}</div><div>total invoices</div></div>
        <div className="kpi"><div className="num">${pendingAmount.toFixed(2)}</div><div>amount pending</div></div>
        <div className="kpi"><div className="num">{exceptions}</div><div>need review</div></div>
      </div>

      <div className="board">
        {STAGES.map((s) => (
          <div className="col" key={s}>
            <div className="col-head">{STAGE_LABEL[s]} <span>({byStage(s).length})</span></div>
            {byStage(s).map((inv) => (
              <div className="card" key={inv.id} onClick={() => setSelected(inv)}>
                <div className="c-vendor">{inv.vendor || "(unknown vendor)"}</div>
                <div className="c-meta">#{inv.invoice_no || "—"} · {inv.invoice_date || "—"}</div>
                <div className="c-meta">${inv.amount ?? "—"} · {inv.buyer_name || "no buyer"}</div>
                {inv.needs_review && <div className="pill red">review</div>}
              </div>
            ))}
            {byStage(s).length === 0 && <div className="empty">—</div>}
          </div>
        ))}
      </div>

      {selected && (
        <DetailDrawer inv={selected} onClose={() => setSelected(null)} onSave={updateInvoice} />
      )}
    </div>
  );
}

function DetailDrawer({ inv, onClose, onSave }) {
  const [form, setForm] = useState({ ...inv });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="drawer">
      <div className="drawer-head">
        <h2>Invoice detail</h2>
        <button className="btn secondary" onClick={onClose}>Close</button>
      </div>
      {inv.pdf_path && <a className="btn" href={inv.pdf_path} target="_blank" rel="noreferrer">View PDF</a>}
      <div className="form">
        <Label k="Vendor" v={form.vendor} onChange={(v) => set("vendor", v)} />
        <Label k="Class" v={form.class} onChange={(v) => set("class", v)} />
        <Label k="Invoice No" v={form.invoice_no} onChange={(v) => set("invoice_no", v)} />
        <Label k="Invoice Date" v={form.invoice_date} onChange={(v) => set("invoice_date", v)} />
        <Label k="Amount" v={form.amount} onChange={(v) => set("amount", v)} />
        <Label k="Item" v={form.item} onChange={(v) => set("item", v)} />
        <Label k="PO No" v={form.po_no} onChange={(v) => set("po_no", v)} />
        <Label k="Buyer Name" v={form.buyer_name} onChange={(v) => set("buyer_name", v)} />
        <Label k="Account Number" v={form.account_number} onChange={(v) => set("account_number", v)} />
      </div>

      <div className="approval">
        <div>
          <span>Buyer Approval:</span>
          <select value={form.buyer_approval} onChange={(e) => set("buyer_approval", e.target.value)}>
            <option>Pending</option><option>Completed</option>
          </select>
        </div>
        <div>
          <span>Manager Approval:</span>
          <select value={form.manager_approval} onChange={(e) => set("manager_approval", e.target.value)}>
            <option>Pending</option><option>Yes</option><option>Done</option>
          </select>
        </div>
      </div>

      <button className="btn" onClick={() => onSave(inv.id, form)}>Save</button>
    </div>
  );
}

function Label({ k, v, onChange }) {
  return (
    <label className="field">
      <span>{k}</span>
      <input value={v || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
