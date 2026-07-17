# Invoice Automation Dashboard — Implementation Plan

## Goal
A Vercel-hosted dashboard that automatically syncs invoice PDFs from a personal
Outlook inbox, extracts their fields, tracks each invoice through an approval
pipeline, and (later) exports to QuickBooks Online.

Per decisions:
- **Host:** Vercel, PDFs in **cloud storage** (Vercel Blob), not a local folder.
- **Data:** the **dashboard owns the data** (no external app DB to read from).
- **Approach:** plan first, then build in phases.

---

## 1. Domain model (the single source of truth)

An `Invoice` record drives the whole dashboard. Status moves left→right:

```
INBOX → EXTRACTED → MATCHED → PENDING_BUYER → PENDING_MANAGER → EXPORTED_QB → DONE
                                          (Buyer=Completed)   (Mgr=Yes→QB)   (Mgr=Done)
```

Fields:
- `id` (uuid)
- `emailId` (Graph message id, for de-dup)
- `receivedAt` (datetime)
- `pdfPath` (Vercel Blob URL)
- `pdfName`
- Extracted: `vendor`, `class`, `invoiceNo`, `invoiceDate`, `amount`, `item`, `poNo`
- `buyerName` (from endpoint)
- `accountNumber` (added during verification)
- `buyerApproval` ∈ {Pending, Completed}
- `managerApproval` ∈ {Pending, Yes, Done}
- `qbExportedAt`, `qbError`
- `extractionConfidence` (0–1) + `needsReview` flag
- `stage` (derived from the above)

---

## 2. Storage (replaces the cookie-only design)

We need server-side state, so add **Vercel Postgres** (or KV). Recommended: Vercel Postgres.

Tables:
- `invoices` (above fields)
- `sync_state` (last-seen email watermark / subscription info)
- `tokens` (encrypted Outlook token for background cron/webhook — replaces cookie)

Env additions: `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`, plus existing Microsoft vars.
`ENCRYPTION_KEY` now also encrypts the stored token.

---

## 3. Auto-sync Outlook → dashboard (the core ask)

Two layers:

### 3a. Webhook (instant, recommended for "remind me on arrival")
- `POST /api/webhook` — Microsoft Graph change notification for `Inbox` messages.
- On event: enqueue a job to fetch the message + PDF, save to Blob, extract, upsert Invoice.
- Subscription created/refreshed by cron (`/api/cron/renew-subscription`) every ~3 days.
- Needs a public URL (Vercel provides it) + a validation token handshake.

### 3b. Cron fallback (reliable, simple)
- `POST /api/cron/sync` (Vercel Cron every 2–5 min) — list new messages since watermark, process, update watermark.
- Works even if webhook is misconfigured.

Both call the same `processEmail(messageId)` pipeline:
1. Download PDF attachment → Vercel Blob (`pdfPath`).
2. Extract fields (parser) → fill Invoice.
3. Call Buyer endpoint → `buyerName`.
4. `stage = MATCHED` (or `INBOX` if extraction failed → `needsReview`).

"Remind me on new mail": when a new invoice lands, send an email via Graph
(`Mail.Send`) + show an in-app banner — same as current behavior, now server-driven.

---

## 4. PDF extraction
- Library: `pdf-parse` (or `unpdf` for edge). Plus regex/keyword rules per field:
  vendor (sender/known list), invoice no (`INV-`/regex), date, amount (`$`, totals),
  PO no, class/item.
- Low-confidence → `needsReview = true`, human fixes in UI, stored back.

---

## 5. Dashboard UI (new structure — pipeline, not just a count)

Layout:
- **Top KPIs:** received today, total amount pending, count per stage, exceptions.
- **Pipeline board:** columns = stages; cards = invoices; filter by stage/date/needsReview.
- **Invoice detail drawer:** PDF preview (`pdfPath`), editable extracted fields,
  Account Number input, Buyer/Manager approval controls, QB status.
- **Activity / alerts:** new-mail reminders, extraction failures, QB push errors.
- **Sync status:** last sync time, webhook health.

Human actions in UI:
- Edit extracted fields, set `accountNumber`.
- Set `buyerApproval = Completed`.
- Set `managerApproval = Yes` → triggers Excel export + QB push (Phase 4).
- After QB success → `managerApproval = Done`.

---

## 6. Build phases

**Phase 0 — Foundations**
- Add Vercel Postgres + Blob; data layer (`lib/db.js`) + `invoices` table migration.
- Move token storage server-side (encrypted in `tokens` table) so cron/webhook work.
- Keep current Outlook auth; persist token instead of fragment.

**Phase 1 — Auto-sync + extract (the main ask)**
- `processEmail` pipeline (download → Blob → extract → buyer endpoint → upsert).
- Cron `/api/cron/sync` + optional webhook `/api/webhook` + renewal cron.
- Email reminder on new invoice.

**Phase 2 — Dashboard UI**
- KPIs + pipeline board + detail drawer + edit/approval actions.
- Sync status panel.

**Phase 3 — Export & QB (later)**
- Excel export (`exceljs`) when Manager=Yes.
- QB Online push via QB API; set Manager=Done on success.

---

## 7. Open items to confirm before Phase 0
- The **Buyer endpoint** URL + request/response shape (to resolve `buyerName`).
- QB Online app credentials (for Phase 3).
- Whether webhook or cron-only sync is preferred for Phase 1 (recommend both, cron as fallback).
- PDF field formats/sample invoice to tune the extractor.
