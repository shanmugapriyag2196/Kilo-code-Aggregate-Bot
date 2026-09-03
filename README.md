# Invoice Automation Dashboard

A Vite + React + TypeScript dashboard for the 23-step Invoice Automation Bot, with
a small Express server that:

- Watches `RPA_ATTACHMENTS_DIR` (default `C:\RPA\SavedAttachments`)
- Accepts uploads from a PC-side uploader (so the hosted dashboard can see files
  even when Vercel has no access to your local Windows folder)
- Syncs uploaded files to Airtable (fields: `Date`, `File Name`, `Attachments`)

## Run locally

```bash
cp .env.example .env.local
# Fill in AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, UPLOAD_TOKEN
npm install
npm run dev
```

- Vite dev server: http://localhost:5173
- Express server: http://localhost:3000

The Vite dev server proxies `/api/*` to Express on :3000.

## Build & run in production

```bash
npm run build      # builds the Vite SPA into dist/
npm run start      # Express serves dist/ + /api/* on PORT (default 3000)
```

## Vercel + PC uploader (hosted dashboard)

Vercel cannot read `C:\RPA\SavedAttachments` directly. To make the hosted
dashboard see new files, run the small uploader on your PC:

1. In your Vercel project, set env vars: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`,
   `AIRTABLE_TABLE_ID`, `UPLOAD_TOKEN` (use the same value locally).
2. In a `.env.local` next to `scripts/uploader.mjs` (or in the project root),
   set:
   ```
   UPLOAD_URL=https://your-app.vercel.app/api/upload
   UPLOAD_TOKEN=the-same-value-as-above
   RPA_ATTACHMENTS_DIR=C:\RPA\SavedAttachments
   ```
3. Start it (one terminal, leave open):
   ```bash
   npm run uploader
   ```
   It watches the folder and POSTs each new/changed file to `/api/upload`
   with header `X-Upload-Token`. The server stores the file in `/tmp`
   and the dashboard picks it up.
4. In the dashboard, click **Sync to Airtable** to push the uploaded files
   into your Airtable table.

> Limitation: on Vercel serverless the `/tmp` directory is per-instance, so
> cold starts may lose uploaded files between deployments. For a permanent
> store, swap the `receiveUpload` function in `server/airtable.js` to write
> to Vercel Blob / KV / Postgres.

## Endpoints

- `GET  /api/attachments/count` — `{ sourceDir, count, fromLocal, fromUploads }`
- `GET  /api/attachments/list`  — local + uploaded files
- `GET  /api/uploaded`          — uploaded-only list
- `POST /api/upload`            — body: `{ name, contentType, data(base64) }`,
                                  header: `X-Upload-Token: <UPLOAD_TOKEN>`
- `GET  /api/airtable/status`
- `GET  /api/airtable/debug`
- `POST /api/airtable/sync`

## Deploy

`vercel.json` is configured for Vite + SPA rewrites. The Express server
runs both locally (`node server/index.js`) and on Vercel.
