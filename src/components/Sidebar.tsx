import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  CheckSquare,
  BookOpen,
  Activity,
  FolderInput,
} from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/input-files", label: "Input Files", icon: FolderInput },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/buyers", label: "Buyers", icon: Users },
  { to: "/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/quickbooks", label: "QuickBooks", icon: BookOpen },
  { to: "/process", label: "Process Monitor", icon: Activity },
];

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="text-xs uppercase tracking-wider text-slate-400">RPA Bot</div>
        <div className="text-base font-semibold mt-0.5">Invoice Automation</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end as boolean | undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-[11px] text-slate-500 border-t border-slate-800">
        v1.0 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
