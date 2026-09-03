import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  trend?: { dir: "up" | "down"; text: string } | null;
  icon?: ReactNode;
}

const toneStyles: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "bg-white border-slate-200",
  success: "bg-emerald-50 border-emerald-200",
  warning: "bg-amber-50 border-amber-200",
  danger: "bg-rose-50 border-rose-200",
  info: "bg-sky-50 border-sky-200",
};

const toneValue: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-slate-900",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
  info: "text-sky-700",
};

export default function KpiCard({ label, value, hint, tone = "default", trend = null, icon }: KpiCardProps) {
  return (
    <div className={`rounded-xl border shadow-sm p-5 ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-slate-600">{label}</div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${toneValue[tone]}`}>{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 ${
              trend.dir === "up" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {trend.dir === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {trend.text}
          </span>
        )}
        {hint && <span className="text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}
