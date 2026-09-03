# Invoice Automation Dashboard

A Vite + React + TypeScript dashboard for the 23-step Invoice Automation Bot, with
a small Express server that:

- Counts files in `C:\RPA\SavedAttachments` (drives the **Outlook Attachments** KPI)
- Syncs new files to your Airtable base (fields: `Date`, `File Name`, `Attachments`)

## Run locally

```bash
cp .env.example .env.local
# Fill in AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID
npm install
npm run dev
```

- Vite dev server: http://localhost:5173
- Express server (also started by `npm run dev`): http://localhost:3000

The Vite dev server proxies `/api/*` to the Express server.

## Build & run in production

```bash
npm run build      # builds the Vite SPA into dist/
npm run start      # Express serves dist/ + /api/* on PORT (default 3000)
```

## Airtable

1. Create a Personal Access Token at https://airtable.com/create/tokens with
   scopes `data.records:read`, `data.records:write`, and `attachment:write` on
   the Invoice Bot base.
2. Put the token in `AIRTABLE_API_KEY` in `.env.local`.
3. The base id and table id are already in `.env.example`
   (`appk7XKYQBNBjuE5` / `tbletDPR6YDhviL7g`).
4. In the table, create three fields:
   - `Date` (Single line text)
   - `File Name` (Single line text)
   - `Attachments` (Attachment)

The dashboard has a **Sync to Airtable** button. The bot auto-skips files
already uploaded (tracked locally in `data/synced-airtable.json`) and uploads
only new ones.

## Endpoints

- `GET  /api/attachments/count` — `{ sourceDir, count }`
- `GET  /api/airtable/status`   — `{ configured, total, records }`
- `POST /api/airtable/sync`     — uploads any new files in the source folder

## Deploy

- `vercel.json` is configured for Vite + SPA rewrites.
- The Express server is for local use. On Vercel the dashboard runs as a
  static SPA; Airtable sync is a local-only feature (Vercel can't read your
  Windows folder). Run the local server (or `npm run dev`) to sync files.
