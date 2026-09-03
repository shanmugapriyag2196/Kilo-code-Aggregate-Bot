import { MailCheck, BookOpenCheck, CheckCircle2 } from "lucide-react";
import KpiCard from "../components/KpiCard";
import StatusPill from "../components/StatusPill";
import { mockInvoices } from "../data/mockData";

export default function QuickBooksPage() {
  const data = mockInvoices;
  const ready = data.filter((i) => i.quickBooksStatus === "Ready");
  const loaded = data.filter((i) => i.quickBooksStatus === "Loaded");
  const completed = data.filter((i) => i.quickBooksStatus === "Completed");

  const qbEmailCount = completed.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">QuickBooks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Invoices flow through Ready → Loaded → Completed. On completion the client is notified by email.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Ready for QuickBooks" value={ready.length} tone="info" icon={<BookOpenCheck className="h-4 w-4" />} />
        <KpiCard label="Loaded into QuickBooks" value={loaded.length} tone="info" icon={<MailCheck className="h-4 w-4" />} />
        <KpiCard label="Completed" value={completed.length} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Client Email Notification</div>
            <div className="text-base font-semibold text-slate-900">
              {qbEmailCount} invoice(s) loaded into QuickBooks
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              The bot emails the client with the count of invoices loaded into QuickBooks.
            </div>
          </div>
          <StatusPill tone="indigo">Email Sent: {qbEmailCount}</StatusPill>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Ready for QuickBooks" rows={ready} emptyText="No invoices ready." tone="blue" />
        <Section title="Loaded into QuickBooks" rows={loaded} emptyText="No invoices loaded." tone="indigo" />
        <Section title="Completed" rows={completed} emptyText="No completed invoices." tone="green" />
      </div>
    </div>
  );
}

function Section({ title, rows, emptyText, tone }: { title: string; rows: typeof mockInvoices; emptyText: string; tone: "blue" | "indigo" | "green" }) {
  const pillTone = tone;
  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <StatusPill tone={pillTone}>{rows.length}</StatusPill>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{emptyText}</li>}
        {rows.map((inv) => (
          <li key={inv.id} className="px-5 py-3">
            <div className="text-sm text-slate-800 font-medium">{inv.vendor}</div>
            <div className="text-xs text-slate-500 font-mono">{inv.fileName}</div>
            <div className="text-xs text-slate-500 mt-0.5">${inv.amount.toFixed(2)} · PO {inv.poNumber ?? "—"}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
