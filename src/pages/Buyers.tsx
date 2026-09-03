import { useMemo } from "react";
import { mockInvoices, mockBuyers } from "../data/mockData";
import StatusPill from "../components/StatusPill";

export default function Buyers() {
  const rows = useMemo(() => {
    return mockBuyers.map((b) => {
      const owned = mockInvoices.filter((i) => i.buyerEmail === b.email);
      return {
        ...b,
        total: owned.length,
        verified: owned.filter((i) => i.buyerApproval === "Verified").length,
        notVerified: owned.filter((i) => i.buyerApproval === "Not Verified").length,
        completed: owned.filter((i) => i.buyerApproval === "Completed").length,
      };
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Buyers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Buyers can only see invoices assigned to them and can change Buyer Approval (Verified / Not Verified).
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="table-th">Buyer Name</th>
              <th className="table-th">Buyer Email</th>
              <th className="table-th text-right">Total Assigned</th>
              <th className="table-th text-right">Verified</th>
              <th className="table-th text-right">Not Verified</th>
              <th className="table-th text-right">Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.email} className="hover:bg-slate-50">
                <td className="table-td font-medium text-slate-800">{b.name}</td>
                <td className="table-td text-xs">{b.email}</td>
                <td className="table-td text-right">{b.total}</td>
                <td className="table-td text-right">
                  <StatusPill tone="blue">{b.verified}</StatusPill>
                </td>
                <td className="table-td text-right">
                  <StatusPill tone="amber">{b.notVerified}</StatusPill>
                </td>
                <td className="table-td text-right">
                  <StatusPill tone="green">{b.completed}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {rows.map((b) => (
          <div key={b.email} className="card card-pad">
            <div className="text-xs text-slate-500">{b.email}</div>
            <div className="text-base font-semibold text-slate-900">{b.name}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Verified" value={b.verified} tone="blue" />
              <Stat label="Not Verified" value={b.notVerified} tone="amber" />
              <Stat label="Completed" value={b.completed} tone="green" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "blue" | "amber" | "green" }) {
  const styles =
    tone === "blue"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <div className={`rounded-lg border p-2 ${styles}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px]">{label}</div>
    </div>
  );
}
