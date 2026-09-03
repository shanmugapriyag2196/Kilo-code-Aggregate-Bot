import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  X,
} from "lucide-react";
import StatusPill from "../components/StatusPill";
import { mockInvoices } from "../data/mockData";
import type { Invoice } from "../types";
import { overallStatus, stepIndexForInvoice, PROCESS_STEPS } from "../lib/process";

type SortKey = keyof Invoice;

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "fileName", label: "Invoice File Name" },
  { key: "vendor", label: "Vendor Name" },
  { key: "klass", label: "Class" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "invoiceNumber", label: "Invoice Number" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "itemDescription", label: "Item Description" },
  { key: "poNumber", label: "PO Number" },
  { key: "buyerName", label: "Buyer Name" },
  { key: "buyerEmail", label: "Buyer Email" },
  { key: "accountNumber", label: "Account Number" },
  { key: "invoicePath", label: "Invoice Path" },
  { key: "managerApproval", label: "Manager" },
  { key: "buyerApproval", label: "Buyer" },
  { key: "quickBooksStatus", label: "QuickBooks" },
];

const PAGE_SIZE = 8;

function compare(a: Invoice, b: Invoice, key: SortKey, dir: 1 | -1): number {
  const av = a[key] as unknown;
  const bv = b[key] as unknown;
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
  return String(av).localeCompare(String(bv)) * dir;
}

export default function Invoices() {
  const [query, setQuery] = useState("");
  const [poFilter, setPoFilter] = useState<"all" | "with" | "without">("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [buyerFilter, setBuyerFilter] = useState<string>("all");
  const [qbFilter, setQbFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("invoiceDate");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Invoice | null>(null);

  const rows = useMemo(() => {
    let r = mockInvoices.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((inv) =>
        [
          inv.fileName,
          inv.vendor,
          inv.klass,
          inv.invoiceNumber,
          inv.itemDescription,
          inv.poNumber ?? "",
          inv.buyerName ?? "",
          inv.buyerEmail ?? "",
          inv.accountNumber ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    if (poFilter === "with") r = r.filter((i) => i.poNumber);
    if (poFilter === "without") r = r.filter((i) => !i.poNumber);
    if (managerFilter !== "all") r = r.filter((i) => i.managerApproval === managerFilter);
    if (buyerFilter !== "all") r = r.filter((i) => i.buyerApproval === buyerFilter);
    if (qbFilter !== "all") r = r.filter((i) => i.quickBooksStatus === qbFilter);
    r.sort((a, b) => compare(a, b, sortKey, sortDir));
    return r;
  }, [query, poFilter, managerFilter, buyerFilter, qbFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "amount" ? -1 : 1);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <p className="text-sm text-slate-500 mt-1">
          {rows.length} of {mockInvoices.length} invoices
        </p>
      </div>

      {/* Filter bar */}
      <div className="card card-pad">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by file, vendor, PO, buyer…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select className="input" value={poFilter} onChange={(e) => { setPoFilter(e.target.value as "all" | "with" | "without"); setPage(0); }}>
            <option value="all">All PO Status</option>
            <option value="with">PO Available</option>
            <option value="without">PO Not Available</option>
          </select>
          <select className="input" value={managerFilter} onChange={(e) => { setManagerFilter(e.target.value); setPage(0); }}>
            <option value="all">Manager: All</option>
            <option value="Yes">Manager: Yes</option>
            <option value="No">Manager: No</option>
            <option value="Done">Manager: Done</option>
          </select>
          <select className="input" value={buyerFilter} onChange={(e) => { setBuyerFilter(e.target.value); setPage(0); }}>
            <option value="all">Buyer: All</option>
            <option value="Verified">Buyer: Verified</option>
            <option value="Not Verified">Buyer: Not Verified</option>
            <option value="Completed">Buyer: Completed</option>
          </select>
          <select className="input" value={qbFilter} onChange={(e) => { setQbFilter(e.target.value); setPage(0); }}>
            <option value="all">QuickBooks: All</option>
            <option value="Not Ready">QB: Not Ready</option>
            <option value="Ready">QB: Ready</option>
            <option value="Loaded">QB: Loaded</option>
            <option value="Completed">QB: Completed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`table-th ${c.align === "right" ? "text-right" : ""}`}
                    onClick={() => toggleSort(c.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key ? (
                        sortDir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="table-th">Overall</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="table-td font-mono text-xs whitespace-nowrap">{inv.fileName}</td>
                  <td className="table-td whitespace-nowrap">{inv.vendor}</td>
                  <td className="table-td whitespace-nowrap">{inv.klass}</td>
                  <td className="table-td whitespace-nowrap">{inv.invoiceDate}</td>
                  <td className="table-td font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="table-td text-right">${inv.amount.toFixed(2)}</td>
                  <td className="table-td max-w-[260px] truncate" title={inv.itemDescription}>{inv.itemDescription}</td>
                  <td className="table-td font-mono text-xs">{inv.poNumber ?? "—"}</td>
                  <td className="table-td whitespace-nowrap">{inv.buyerName ?? "—"}</td>
                  <td className="table-td text-xs">{inv.buyerEmail ?? "—"}</td>
                  <td className="table-td font-mono text-xs">{inv.accountNumber ?? "—"}</td>
                  <td className="table-td text-xs max-w-[260px] truncate" title={inv.invoicePath}>{inv.invoicePath}</td>
                  <td className="table-td">
                    <StatusPill tone={inv.managerApproval === "Yes" ? "green" : inv.managerApproval === "Done" ? "indigo" : "gray"}>
                      {inv.managerApproval}
                    </StatusPill>
                  </td>
                  <td className="table-td">
                    <StatusPill
                      tone={inv.buyerApproval === "Completed" ? "green" : inv.buyerApproval === "Verified" ? "blue" : "amber"}
                    >
                      {inv.buyerApproval}
                    </StatusPill>
                  </td>
                  <td className="table-td">{inv.quickBooksStatus}</td>
                  <td className="table-td">
                    <StatusPill
                      tone={overallStatus(inv) === "Completed" ? "green" : "indigo"}
                    >
                      {overallStatus(inv)}
                    </StatusPill>
                  </td>
                  <td className="table-td">
                    <button className="btn-secondary" onClick={() => setSelected(inv)}>View</button>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td className="table-td text-center text-slate-500" colSpan={COLUMNS.length + 2}>
                    No invoices match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Page {page + 1} of {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </button>
            <button
              className="btn-secondary"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && <InvoiceDrawer invoice={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function InvoiceDrawer({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const idx = stepIndexForInvoice(invoice);
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 flex" onClick={onClose}>
      <div
        className="ml-auto h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="text-xs text-slate-500">{invoice.invoiceNumber}</div>
            <h2 className="text-lg font-semibold text-slate-900">{invoice.vendor}</h2>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">{invoice.fileName}</div>
          </div>
          <button onClick={onClose} className="btn-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <Section title="Invoice Details">
            <Field label="Class" value={invoice.klass} />
            <Field label="Invoice Date" value={invoice.invoiceDate} />
            <Field label="Amount" value={`$${invoice.amount.toFixed(2)}`} />
            <Field label="Item Description" value={invoice.itemDescription} full />
            <Field label="PO Number" value={invoice.poNumber ?? "—"} />
            <Field label="Invoice Path" value={invoice.invoicePath} full mono />
            <Field label="Account Number" value={invoice.accountNumber ?? "—"} mono />
          </Section>

          <Section title="Buyer">
            <Field label="Buyer Name" value={invoice.buyerName ?? "—"} />
            <Field label="Buyer Email" value={invoice.buyerEmail ?? "—"} />
          </Section>

          <Section title="Approvals">
            <Field
              label="Manager Approval"
              value={
                <StatusPill tone={invoice.managerApproval === "Yes" ? "green" : invoice.managerApproval === "Done" ? "indigo" : "gray"}>
                  {invoice.managerApproval}
                </StatusPill>
              }
            />
            <Field
              label="Buyer Approval"
              value={
                <StatusPill tone={invoice.buyerApproval === "Completed" ? "green" : invoice.buyerApproval === "Verified" ? "blue" : "amber"}>
                  {invoice.buyerApproval}
                </StatusPill>
              }
            />
            <Field label="QuickBooks Status" value={invoice.quickBooksStatus} />
            <Field label="Overall" value={overallStatus(invoice)} />
          </Section>

          <Section title="Position in 23-Step Process">
            <div className="col-span-2">
              <div className="text-xs text-slate-500">
                Currently at: <span className="font-semibold text-slate-800">Step {idx + 1} – {PROCESS_STEPS[idx]}</span>
              </div>
              <ol className="mt-3 space-y-1.5">
                {PROCESS_STEPS.map((step, i) => (
                  <li
                    key={step}
                    className={`flex items-center gap-2 text-xs ${
                      i < idx ? "text-emerald-600" : i === idx ? "text-brand-700 font-semibold" : "text-slate-400"
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                        i < idx
                          ? "bg-emerald-100 text-emerald-700"
                          : i === idx
                          ? "bg-brand-100 text-brand-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">{children}</div>
    </div>
  );
}

function Field({ label, value, full, mono }: { label: string; value: React.ReactNode; full?: boolean; mono?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-sm text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
