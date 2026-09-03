import { useEffect, useState } from "react";
import { FolderInput, RefreshCw, FileText, AlertTriangle } from "lucide-react";
import StatusPill from "../components/StatusPill";

interface SourceFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function InputFiles() {
  const [sourceDir, setSourceDir] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean>(true);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/attachments/list", { cache: "no-store" }).then((r) => r.json());
      setSourceDir(r.sourceDir || null);
      setExists(Boolean(r.exists));
      setFiles(Array.isArray(r.files) ? r.files : []);
      if (r.error) setError(r.error);
      setLastRefresh(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  const filtered = files.filter((f) =>
    query ? f.name.toLowerCase().includes(query.toLowerCase()) : true
  );

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <FolderInput className="h-6 w-6 text-brand-600" />
            Input Files
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Files waiting in the RPA bot's input folder. Whatever is here is what the bot will pick up and sync.
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-pad">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Folder</div>
          <div className="mt-1 flex items-center gap-2">
            <StatusPill tone={exists ? "green" : "red"}>
              {exists ? "Available" : "Not found"}
            </StatusPill>
          </div>
        </div>
        <div className="card card-pad">
          <div className="text-xs text-slate-500 uppercase tracking-wide">File Count</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{files.length}</div>
        </div>
        <div className="card card-pad">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Total Size</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{formatSize(totalSize)}</div>
        </div>
      </div>

      {error && (
        <div className="card card-pad">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      {/* Search + list */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-700">Files in {sourceDir || "RPA folder"}</h3>
          <input
            className="input max-w-xs"
            placeholder="Filter by file name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {!exists && (
          <div className="px-5 py-6 text-sm text-rose-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Source folder does not exist. Check the <span className="font-mono">RPA_ATTACHMENTS_DIR</span> env var.
          </div>
        )}

        {exists && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th">#</th>
                  <th className="table-th">File Name</th>
                  <th className="table-th text-right">Size</th>
                  <th className="table-th">Modified</th>
                  <th className="table-th">Full Path</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td className="table-td text-center text-slate-500" colSpan={5}>
                      {loading
                        ? "Loading…"
                        : query
                        ? "No files match the filter."
                        : "No files in this folder. Drop a PDF into the folder to see it here."}
                    </td>
                  </tr>
                )}
                {filtered.map((f, i) => (
                  <tr key={f.path} className="hover:bg-slate-50">
                    <td className="table-td text-slate-500 text-xs">{i + 1}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-xs">{f.name}</span>
                      </div>
                    </td>
                    <td className="table-td text-right">{formatSize(f.size)}</td>
                    <td className="table-td text-xs text-slate-600">
                      {new Date(f.modifiedAt).toLocaleString()}
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
