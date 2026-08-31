import { scanAndSync, watchSync, getSyncedFiles, getSourceDir } from "../lib/filesync.js";

const watch = process.argv.includes("--watch");

function summary() {
  const r = scanAndSync();
  if (!r.ok) {
    console.log(`[sync] ${r.error}`);
    return r;
  }
  if (r.added.length) {
    console.log(`[sync] Copied ${r.added.length} new file(s) from ${r.sourceDir}:`);
    for (const f of r.added) console.log(`  + ${f.destName} (${f.size} bytes)`);
  } else {
    console.log(`[sync] Nothing new. ${r.total} file(s) synced in total.`);
  }
  return r;
}

if (watch) {
  console.log(`[sync] Watching ${getSourceDir()} (Ctrl+C to stop)...`);
  summary();
  watchSync(
    (r) => {
      if (r && r.added && r.added.length) summary();
    },
    5000
  );
} else {
  summary();
  const files = getSyncedFiles();
  if (files.length) {
    console.log("[sync] Synced files:");
    for (const f of files) console.log(`  - ${f.name}  (synced ${f.syncedAt})`);
  }
}
