import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { mockInvoices } from "../data/mockData";
import StatusPill from "../components/StatusPill";

export default function Approvals() {
  const data = mockInvoices;
  const managerCounts = {
    Yes: data.filter((i) => i.managerApproval === "Yes").length,
    No: data.filter((i) => i.managerApproval === "No").length,
    Done: data.filter((i) => i.managerApproval === "Done").length,
  };
  const buyerCounts = {
    Verified: data.filter((i) => i.buyerApproval === "Verified").length,
    "Not Verified": data.filter((i) => i.buyerApproval === "Not Verified").length,
    Completed: data.filter((i) => i.buyerApproval === "Completed").length,
  };

  const chartData = [
    { name: "Manager", Yes: managerCounts.Yes, No: managerCounts.No, Done: managerCounts.Done },
    { name: "Buyer", Verified: buyerCounts.Verified, "Not Verified": buyerCounts["Not Verified"], Completed: buyerCounts.Completed },
  ];

  const waitingManager = data.filter((i) => i.managerApproval === "No" && i.poNumber);
  const waitingBuyer = data.filter((i) => i.buyerApproval === "Not Verified" && i.managerApproval === "Yes");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Approvals</h1>
        <p className="text-sm text-slate-500 mt-1">Manager and Buyer approval status across all invoices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card card-pad">
          <h3 className="text-sm font-semibold text-slate-700">Manager Approval</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(["Yes", "No", "Done"] as const).map((k) => (
              <div key={k} className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{k}</div>
                <div className="text-2xl font-semibold text-slate-900">{managerCounts[k]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="text-sm font-semibold text-slate-700">Buyer Approval</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(["Verified", "Not Verified", "Completed"] as const).map((k) => (
              <div key={k} className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{k}</div>
                <div className="text-2xl font-semibold text-slate-900">{buyerCounts[k]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="text-sm font-semibold text-slate-700">Approval Distribution</h3>
        <div className="h-64 mt-3">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#475569" }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Yes" stackId="a" fill="#10b981" />
              <Bar dataKey="No" stackId="a" fill="#f43f5e" />
              <Bar dataKey="Done" stackId="a" fill="#6366f1" />
              <Bar dataKey="Verified" stackId="b" fill="#0ea5e9" />
              <Bar dataKey="Not Verified" stackId="b" fill="#f59e0b" />
              <Bar dataKey="Completed" stackId="b" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ApprovalList
          title="Waiting for Manager Approval"
          tone="amber"
          rows={waitingManager}
          emptyText="No invoices waiting for Manager."
        />
        <ApprovalList
          title="Waiting for Buyer Approval"
          tone="blue"
          rows={waitingBuyer}
          emptyText="No invoices waiting for Buyer."
        />
      </div>
    </div>
  );
}

function ApprovalList({
  title,
  tone,
  rows,
  emptyText,
}: {
  title: string;
  tone: "amber" | "blue";
  rows: typeof mockInvoices;
  emptyText: string;
}) {
  const pillTone = tone === "amber" ? "amber" : "blue";
  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <StatusPill tone={pillTone}>{rows.length}</StatusPill>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.length === 0 && (
          <li className="px-5 py-4 text-sm text-slate-500">{emptyText}</li>
        )}
        {rows.map((inv) => (
          <li key={inv.id} className="px-5 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-800 font-medium">{inv.vendor}</div>
              <div className="text-xs text-slate-500 font-mono">{inv.fileName}</div>
            </div>
            <div className="text-xs text-slate-500 text-right">
              <div>PO: {inv.poNumber ?? "—"}</div>
              <div>Buyer: {inv.buyerName ?? "—"}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
