# Local folder auto-sync bot

A small Next.js dashboard that auto-syncs files from a local folder
(default `C:\RPA\SavedAttachments`) into the bot. Any file dropped in the
source folder is copied into the project's `invoices/` folder (de-duplicated by
source path) and listed under **Synced Files** on the dashboard. The sync runs
automatically on every dashboard load and every 60s while the tab is open.

## Setup

```bash
cp .env.example .env.local   # optional: set RPA_ATTACHMENTS_DIR
npm install
npm run dev
```

Open http://localhost:3000.

## Configuration (`.env.local`)

- `RPA_ATTACHMENTS_DIR` — source folder to watch. Defaults to `C:\RPA\SavedAttachments`.

## Sync from the CLI

- One-shot sync: `npm run sync`
- Continuous watcher (copies new files within ~5s): `npm run sync:watch`

## How it works

- `lib/filesync.js` — scans the source folder, copies new files into `invoices/`,
  and tracks them in `data/synced-files.json`.
- `app/api/files/route.js` — auto-syncs and lists synced files.
- `app/api/file/[name]/route.js` — safely serves a synced file
  (path-traversal protected).
- `scripts/sync.mjs` — CLI wrapper used by the `sync` / `sync:watch` scripts.
