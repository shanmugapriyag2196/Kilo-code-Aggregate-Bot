import { useEffect, useState } from "react";
import { FolderInput, RefreshCw, FileText, AlertTriangle, Cloud, HardDrive, Upload } from "lucide-react";
import StatusPill from "../components/StatusPill";

interface SourceFile {
  name: string;
  path: string;
  size: number | null;
  modifiedAt: string | null;
  source?: "local" | "uploaded" | "airtable";
  attachments?: { url: string; filename: string }[];
  recordId?: string;
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function sourceIcon(source: SourceFile["source"]) {
  if (source === "airtable") return <Cloud className="h-4 w-4 text-sky-500" />;
  if (source === "uploaded") return <Upload className="h-4 w-4 text-violet-500" />;
  return <HardDrive className="h-4 w-4 text-emerald-500" />;
}

function sourceLabel(source: SourceFile["source"]) {
  if (source === "airtable") return "Airtable";
  if (source === "uploaded") return "Uploaded";
  return "Local folder";
}

export default function InputFiles() {
  const [sourceDir, setSourceDir] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean>(true);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [airtableStatus, setAirtableStatus] = useState<{ ok: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "local" | "uploaded" | "airtable">("all");

  async function load() {
    setLoading(true);
    setError(null);
    setServerDown(false);
    try {
      const res = await fetch("/api/attachments/list", { cache: "no-store" });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        setServerDown(true);
        setError(
          `The dashboard is not talking to a backend server. Got a ${ct || "non-JSON"} response from ${res.url}. ` +
            `This usually means the Express server (node server/index.js) is not running, ` +
            `or you're viewing the Vercel deployment where /api routes don't exist.`
        );
        setFiles([]);
        return;
      }
      const r = await res.json();
      setSourceDir(r.sourceDir || null);
      setExists(Boolean(r.exists));
      setFiles(Array.isArray(r.files) ? r.files : []);
      if (r.airtable) setAirtableStatus({ ok: r.airtable.ok, error: r.airtable.error });
      if (r.error) setError(r.error);
      setLastRefresh(new Date());
    } catch (e) {
      setServerDown(true);
      setError(
        `Cannot reach the server: ${(e as Error).message}. ` +
          `Start it with: node server/index.js`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  const filtered = files.filter((f) => {
    if (sourceFilter !== "all" && (f.source || "local") !== sourceFilter) return false;
    if (query && !f.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const localCount = files.filter((f) => (f.source || "local") === "local").length;
  const uploadedCount = files.filter((f) => f.source === "uploaded").length;
  const airtableCount = files.filter((f) => f.source === "airtable").length;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <FolderInput className="h-6 w-6 text-brand-600" />
            Input Files
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Files in the RPA bot's input folder, files uploaded from the PC uploader, and records already in Airtable.
          </p>
          {sourceDir && (
            <p className="text-xs text-slate-500 mt-1 font-mono break-all">{sourceDir}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-slate-500">
              updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Source summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card card-pad">
          <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" /> Local folder
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusPill tone={exists ? "green" : "red"}>
              {exists ? "Available" : "Not found"}
            </StatusPill>
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{localCount}</div>
        </div>
        <div className="card card-pad">
          <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Uploaded
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{uploadedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">From the PC uploader</div>
        </div>
        <div className="card card-pad">
          <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Cloud className="h-3.5 w-3.5" /> Airtable
          </div>
          <div className="mt-1 flex items-center gap-2">
            {airtableStatus?.ok ? (
              <StatusPill tone="green">Connected</StatusPill>
            ) : (
              <StatusPill tone="amber">{airtableStatus?.error ? "Error" : "Not configured"}</StatusPill>
            )}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{airtableCount}</div>
        </div>
        <div className="card card-pad">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Total</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{files.length}</div>
        </div>
      </div>

      {error && (
        <div className={`card card-pad ${serverDown ? "border-rose-300 bg-rose-50" : ""}`}>
          <div className={`flex items-start gap-2 ${serverDown ? "text-rose-700" : "text-amber-700"}`}>
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-medium">
                {serverDown ? "Cannot reach the bot server" : "Notice"}
              </div>
              <div className="text-sm mt-1 whitespace-pre-line">{error}</div>
              {serverDown && (
                <div className="text-sm mt-2 font-mono bg-white border border-rose-200 rounded px-2 py-1 inline-block">
                  node server/index.js
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search + source filter + list */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-700">Files</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="input max-w-[180px]"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
            >
              <option value="all">All sources</option>
              <option value="local">Local folder only</option>
              <option value="uploaded">Uploaded only</option>
              <option value="airtable">Airtable only</option>
            </select>
            <input
              className="input max-w-xs"
              placeholder="Filter by file name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {exists && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th">#</th>
                  <th className="table-th">File Name</th>
                  <th className="table-th">Source</th>
                  <th className="table-th text-right">Size</th>
                  <th className="table-th">Date</th>
                  <th className="table-th">Path / Record</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td className="table-td text-center text-slate-500" colSpan={6}>
                      {loading
                        ? "Loading…"
                        : query || sourceFilter !== "all"
                        ? "No files match the filter."
                        : "No files yet. Drop a PDF into the folder or run the PC uploader."}
                    </td>
                  </tr>
                )}
                {filtered.map((f, i) => (
                  <tr key={`${f.source || "local"}:${f.path}:${i}`} className="hover:bg-slate-50">
                    <td className="table-td text-slate-500 text-xs">{i + 1}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        {sourceIcon(f.source)}
                        <span className="font-mono text-xs">{f.name}</span>
                      </div>
                    </td>
                    <td className="table-td">
                      <StatusPill
                        tone={
                          f.source === "airtable" ? "blue" : f.source === "uploaded" ? "violet" : "green"
                        }
                      >
                        {sourceLabel(f.source)}
                      </StatusPill>
                    </td>
                    <td className="table-td text-right">{formatSize(f.size)}</td>
                    <td className="table-td text-xs text-slate-600">
                      {f.modifiedAt ? new Date(f.modifiedAt).toLocaleString() : "—"}
                    </td>
                    <td className="table-td text-xs text-slate-500 font-mono max-w-[420px] truncate" title={f.path}>
                      {f.path}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
