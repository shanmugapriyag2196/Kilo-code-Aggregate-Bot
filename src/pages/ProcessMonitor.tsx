import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { PROCESS_STEPS } from "../lib/process";

type State = "Pending" | "Processing" | "Completed";

interface Step {
  name: string;
  state: State;
  detail?: string;
}

const STEPS: Step[] = [
  { name: "Outlook", state: "Completed", detail: "Receiving invoice PDF attachments from Outlook Mail" },
  { name: "Power Automate Desktop", state: "Completed", detail: "Saves attachments into Save Attachment folder" },
  { name: "Python", state: "Completed", detail: "Runs Test.py and Test2.py via Command Prompt" },
  { name: "Input.json", state: "Completed", detail: "Whole PDF text stored" },
  { name: "Output.json", state: "Completed", detail: "Extracted fields stored" },
  { name: "Excel", state: "Completed", detail: "Output.json data entered into Excel one by one" },
  { name: "CenPoint", state: "Processing", detail: "Resolving Buyer Name from PO Number" },
  { name: "Aggregate Web Application", state: "Processing", detail: "Bot / Admin / Buyer roles" },
  { name: "QuickBooks Online", state: "Pending", detail: "Invoices loaded into QuickBooks Online one by one" },
];

export default function ProcessMonitor() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Process Monitor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Live status of each subsystem involved in the 23-step Invoice Automation process.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {STEPS.map((s) => (
          <div key={s.name} className="card card-pad">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">{s.name}</div>
              <StatePill state={s.state} />
            </div>
            <p className="text-xs text-slate-500 mt-1">{s.detail}</p>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <h3 className="text-sm font-semibold text-slate-700">23-Step Process</h3>
        <p className="text-xs text-slate-500">
          Each step in the bot's automation pipeline. Click an invoice in the Invoices page to see its current position.
        </p>
        <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
          {PROCESS_STEPS.map((step, idx) => (
            <li key={step} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
                {idx + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StatePill({ state }: { state: State }) {
  if (state === "Completed")
    return (
      <span className="pill bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  if (state === "Processing")
    return (
      <span className="pill bg-sky-100 text-sky-700">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
      </span>
    );
  return (
    <span className="pill bg-slate-100 text-slate-700">
      <Clock className="h-3.5 w-3.5" /> Pending
    </span>
  );
}
