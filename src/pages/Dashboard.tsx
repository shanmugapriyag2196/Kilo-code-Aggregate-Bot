import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  FileSearch,
  CheckCircle2,
  XCircle,
  UserCheck,
  ShieldCheck,
  BookOpen,
  Flag,
  RefreshCw,
  Database,
  Send,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KpiCard from "../components/KpiCard";
import StatusPill from "../components/StatusPill";
import { mockInvoices } from "../data/mockData";
import { PROCESS_STEPS, stepIndexForInvoice, overallStatus } from "../lib/process";

const TONE_BY_KPI: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  "Total Invoices": "default",
  "Outlook Attachments": "info",
  "PO Available": "success",
  "PO Not Available": "danger",
  "Buyer Approval": "warning",
  "Manager Approval": "warning",
  "Loaded into QuickBooks": "info",
  Completed: "success",
};

export default function Dashboard() {
  const data = mockInvoices;
  const total = data.length;

  const [outlookAttachments, setOutlookAttachments] = useState<number | null>(null);
  const [sourceDir, setSourceDir] = useState<string | null>(null);
  const [airtableConfigured, setAirtableConfigured] = useState<boolean>(false);
  const [airtableTotal, setAirtableTotal] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function refreshAttachments() {
    try {
      const r = await fetch("/api/attachments/count", { cache: "no-store" }).then((r) => r.json());
      setOutlookAttachments(typeof r.count === "number" ? r.count : 0);
      setSourceDir(r.sourceDir || null);
    } catch {
      setOutlookAttachments(null);
    }
  }

  async function refreshAirtableStatus() {
    try {
      const r = await fetch("/api/airtable/status", { cache: "no-store" }).then((r) => r.json());
      setAirtableConfigured(Boolean(r.configured));
      setAirtableTotal(typeof r.total === "number" ? r.total : 0);
    } catch {
      setAirtableConfigured(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const r = await fetch("/api/airtable/sync", { method: "POST", cache: "no-store" }).then((r) => r.json());
      if (r.ok) {
        setSyncMessage(
          `Synced ${r.added.length} new attachment(s) to Airtable. Total: ${r.total}.`
        );
        await refreshAirtableStatus();
        await refreshAttachments();
      } else {
        setSyncMessage(`Sync failed: ${r.error || "unknown error"}`);
      }
    } catch (e) {
      setSyncMessage(`Sync failed: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    refreshAttachments();
    refreshAirtableStatus();
    const i = setInterval(() => {
      refreshAttachments();
      refreshAirtableStatus();
    }, 60000);
    return () => clearInterval(i);
  }, []);

  const kpis = useMemo(() => {
    return {
      "Total Invoices": total,
      "Outlook Attachments": outlookAttachments ?? 0,
      "PO Available": data.filter((i) => i.poNumber).length,
      "PO Not Available": data.filter((i) => !i.poNumber).length,
      "Buyer Approval": data.filter((i) => i.buyerApproval !== "Completed").length,
      "Manager Approval": data.filter((i) => i.managerApproval === "Yes").length,
      "Loaded into QuickBooks": data.filter((i) => i.quickBooksStatus === "Loaded").length,
      Completed: data.filter((i) => i.quickBooksStatus === "Completed" && i.managerApproval === "Done").length,
    };
  }, [data, outlookAttachments, total]);

  const icons: Record<string, JSX.Element> = {
    "Total Invoices": <FileSearch className="h-4 w-4" />,
    "Outlook Attachments": <Mail className="h-4 w-4" />,
    "PO Available": <CheckCircle2 className="h-4 w-4" />,
    "PO Not Available": <XCircle className="h-4 w-4" />,
    "Buyer Approval": <UserCheck className="h-4 w-4" />,
    "Manager Approval": <ShieldCheck className="h-4 w-4" />,
    "Loaded into QuickBooks": <BookOpen className="h-4 w-4" />,
    Completed: <Flag className="h-4 w-4" />,
  };

  // Bar chart: invoice count at each major stage
  const stageChart = useMemo(() => {
    const buckets = [
      { name: "Outlook", value: total },
      { name: "PDF Extract", value: data.filter((i) => i.pdfExtraction === "Completed").length },
      { name: "JSON Extract", value: data.filter((i) => i.jsonExtraction === "Completed").length },
      { name: "Excel", value: data.filter((i) => i.excelProcessing === "Completed").length },
      { name: "PO Check", value: total },
      { name: "CenPoint", value: data.filter((i) => i.poNumber && i.buyerName).length },
      { name: "Buyer Aprv", value: data.filter((i) => i.buyerApproval !== "Not Verified").length },
      { name: "Manager Aprv", value: data.filter((i) => i.managerApproval !== "No").length },
      { name: "Ready QB", value: data.filter((i) => i.quickBooksStatus === "Ready").length },
      { name: "Loaded QB", value: data.filter((i) => i.quickBooksStatus === "Loaded").length },
      { name: "Done", value: data.filter((i) => i.managerApproval === "Done").length },
    ];
    return buckets;
  }, [data, total]);

  const pieData = [
    { name: "PO Available", value: kpis["PO Available"] },
    { name: "PO Not Available", value: kpis["PO Not Available"] },
  ];
  const PIE_COLORS = ["#10b981", "#f43f5e"];

  // Step distribution for the flow diagram
  const stepCounts = useMemo(() => {
    const counts = new Array(PROCESS_STEPS.length).fill(0);
    data.forEach((inv) => {
      const idx = stepIndexForInvoice(inv);
      counts[idx] = (counts[idx] || 0) + 1;
    });
    return counts;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoice Automation Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time visibility across the 23-step Invoice Automation Bot process.
          </p>
        </div>
        <StatusPill tone="indigo">Process Status: Running</StatusPill>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {(Object.entries(kpis) as [string, number][]).map(([label, value]) => (
          <KpiCard
            key={label}
            label={label}
            value={value}
            tone={TONE_BY_KPI[label]}
            icon={icons[label]}
          />
        ))}
      </div>

      {/* Status flow + charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card card-pad lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700">Invoice Volume by Stage</h3>
          <p className="text-xs text-slate-500">How many invoices are at each pipeline stage.</p>
          <div className="h-64 mt-3">
            <ResponsiveContainer>
              <BarChart data={stageChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} interval={0} angle={-15} dy={6} height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="text-sm font-semibold text-slate-700">PO Number Split</h3>
          <p className="text-xs text-slate-500">Invoices with vs. without a PO Number.</p>
          <div className="h-64 mt-3">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 23-step process flow */}
      <div className="card card-pad">
        <h3 className="text-sm font-semibold text-slate-700">Invoice Status Flow</h3>
        <p className="text-xs text-slate-500">
          Each step shows how many invoices are currently positioned there. Click any invoice in the Invoices
          page to see its position in this flow.
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="flex items-stretch gap-2 min-w-max">
            {PROCESS_STEPS.map((step, idx) => (
              <div key={step} className="flex items-center">
                <div className="w-40 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Step {idx + 1}</div>
                  <div className="text-xs font-medium text-slate-800 leading-tight mt-0.5">{step}</div>
                  <div className="mt-2 text-lg font-semibold text-brand-700">{stepCounts[idx]}</div>
                </div>
                {idx < PROCESS_STEPS.length - 1 && (
                  <div className="w-3 h-px bg-slate-300 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Airtable sync */}
      <div className="card card-pad">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Airtable Sync</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Watches <span className="font-mono">{sourceDir || "C:\\RPA\\SavedAttachments"}</span> and uploads new
              files to Airtable. Fields: <span className="font-mono">Date</span>,{" "}
              <span className="font-mono">File Name</span>, <span className="font-mono">Attachments</span>.
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
              <Database className="h-3.5 w-3.5 text-slate-400" />
              Airtable:{" "}
              {airtableConfigured ? (
                <StatusPill tone="green">Configured · {airtableTotal} record(s)</StatusPill>
              ) : (
                <StatusPill tone="amber">Not configured (set AIRTABLE_API_KEY / BASE_ID / TABLE_ID)</StatusPill>
              )}
            </div>
            {syncMessage && <div className="mt-2 text-xs text-slate-600">{syncMessage}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                refreshAttachments();
                refreshAirtableStatus();
              }}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button className="btn-primary" disabled={syncing} onClick={triggerSync}>
              <Send className="h-4 w-4" /> {syncing ? "Syncing…" : "Sync to Airtable"}
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Recent Invoices</h3>
            <p className="text-xs text-slate-500">Last 5 invoices received.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th">File Name</th>
                <th className="table-th">Vendor</th>
                <th className="table-th">PO #</th>
                <th className="table-th">Buyer</th>
                <th className="table-th">Manager</th>
                <th className="table-th">Buyer Approval</th>
                <th className="table-th">QuickBooks</th>
                <th className="table-th">Overall</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(-5).reverse().map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="table-td font-mono text-xs">{inv.fileName}</td>
                  <td className="table-td">{inv.vendor}</td>
                  <td className="table-td">{inv.poNumber ?? "—"}</td>
                  <td className="table-td">{inv.buyerName ?? "—"}</td>
                  <td className="table-td">
                    <StatusPill
                      tone={inv.managerApproval === "Yes" ? "green" : inv.managerApproval === "Done" ? "indigo" : "gray"}
                    >
                      {inv.managerApproval}
                    </StatusPill>
                  </td>
                  <td className="table-td">
                    <StatusPill
                      tone={
                        inv.buyerApproval === "Completed"
                          ? "green"
                          : inv.buyerApproval === "Verified"
                          ? "blue"
                          : "amber"
                      }
                    >
                      {inv.buyerApproval}
                    </StatusPill>
                  </td>
                  <td className="table-td">{inv.quickBooksStatus}</td>
                  <td className="table-td">{overallStatus(inv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
