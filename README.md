# Invoice Automation Dashboard

A Vite + React + TypeScript dashboard for the 23-step Invoice Automation Bot.

- **Local:** runs an Express server that reads `RPA_ATTACHMENTS_DIR` directly.
- **Vercel:** serverless functions in `api/*.mjs` handle `/api/*` and read the same shared code in `shared/api.js`.

## Run locally

```bash
cp .env.example .env.local
# Fill in AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, UPLOAD_TOKEN
npm install
npm run dev          # Vite (5173) + Express (3000) concurrently
# or:
npm run build && npm run start   # production build served on 3000
```

Open http://localhost:3000.

## Deploy to Vercel

`vercel.json` is configured so Vercel:
1. Runs `npm run build` to produce `dist/`
2. Serves `dist/` as static files (with SPA rewrites for routes like `/input-files`)
3. Auto-detects every `api/*.mjs` as a serverless function

Set the same env vars in **Vercel → Project → Settings → Environment Variables**:
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID` = `appk7XKYQBNBjuE5`
- `AIRTABLE_TABLE_ID` = `tbletDPR6YDhviL7g`
- `UPLOAD_TOKEN` (any random hex)

Then deploy. The dashboard at `https://<your-app>.vercel.app` will work the same as locally.

## PC uploader (Vercel)

Vercel cannot read your local Windows folder. Run this on your PC to feed new
files to the hosted dashboard:

```bash
# .env.local on your PC
UPLOAD_URL=https://<your-app>.vercel.app/api/upload
UPLOAD_TOKEN=<same value as on Vercel>
RPA_ATTACHMENTS_DIR=C:\RPA\SavedAttachments

npm run uploader
```

The uploader POSTs each new file in the source folder to `/api/upload`, where
it's stored on Vercel's `/tmp` and the dashboard reads it back.

> Limitation: on Vercel serverless, `/tmp` is per-instance. For a permanent
> store, swap `receiveUpload` in `shared/api.js` to write to Vercel Blob / KV /
> Postgres.

## Endpoints

- `GET  /api/attachments/count` — `{ sourceDir, count, fromLocal, fromUploads, fromAirtable }`
- `GET  /api/attachments/list`  — local + uploaded + airtable
- `GET  /api/uploaded`
- `POST /api/upload`            — body: `{ name, contentType, data(base64) }`, header `X-Upload-Token`
- `GET  /api/airtable/status`
- `GET  /api/airtable/debug`
- `POST /api/airtable/sync`

## Layout

```
api/                  Vercel serverless functions
  attachments/
    count.mjs
    list.mjs
  airtable/
    status.mjs
    debug.mjs
    sync.mjs
  uploaded.mjs
  upload.mjs
server/index.js       Local Express server (re-uses shared/api.js)
shared/api.js         All business logic (used by both)
src/                  Vite + React + TypeScript dashboard
dist/                 Built SPA (output of `npm run build`)
```
