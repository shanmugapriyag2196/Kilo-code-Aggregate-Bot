"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [syncedFiles, setSyncedFiles] = useState([]);
  const [filesError, setFilesError] = useState(null);
  const [sourceDir, setSourceDir] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadFiles() {
    try {
      const res = await fetch("/api/files", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setFilesError(data.error || "Failed to load synced files");
        setSyncedFiles([]);
      } else {
        setSyncedFiles(data.files || []);
        setSourceDir(data.sourceDir || null);
        setFilesError(null);
      }
      setLastRefresh(new Date());
    } catch (e) {
      setFilesError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
    const i = setInterval(loadFiles, 60000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="container">
      <header>
        <h1>Saved Attachments Sync</h1>
        <div>
          <span className="muted">
            {sourceDir ? `from ${sourceDir}` : ""}
            {lastRefresh ? ` · updated ${lastRefresh.toLocaleTimeString()}` : ""}
          </span>
          <button className="btn secondary" onClick={loadFiles}>Refresh</button>
        </div>
      </header>

      {filesError && <div className="error">Error: {filesError}</div>}

      {loading && <p>Loading…</p>}

      <div className="list">
        {!loading && !filesError && syncedFiles.length === 0 && (
          <div className="empty">No files synced yet. Drop files into the source folder to auto-sync.</div>
        )}
        {syncedFiles.map((f) => (
          <div className="item" key={f.name}>
            <div className="subj">{f.name}</div>
            <div className="meta">
              <span>{f.size != null ? `${(f.size / 1024).toFixed(1)} KB` : "unknown size"}</span>
              <span>{f.syncedAt ? new Date(f.syncedAt).toLocaleString() : ""}</span>
              <a className="pill" href={`/api/file/${encodeURIComponent(f.name)}`} target="_blank" rel="noreferrer">open</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
