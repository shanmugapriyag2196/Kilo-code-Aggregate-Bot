# Invoice Automation Dashboard

A Vercel-ready Next.js dashboard that connects to a **personal Outlook.com** account
via Microsoft Graph and tracks invoice emails (emails with PDF attachments) received **today**.

- Live-fetches emails on every load (no database).
- Shows the **daily invoice email count** + a list.
- Auto-refreshes every 60s; when new invoice emails arrive it **emails you a reminder**.
- Stores OAuth tokens in an encrypted, http-only cookie (no DB).

## 1. Create a Microsoft app registration

1. Go to https://entra.microsoft.com → **App registrations** → **New registration**.
2. Name it (e.g. `Invoice Dashboard`).
3. **Supported account types** → *Personal Microsoft accounts only*.
4. **Redirect URI** → Web → `http://localhost:3000/api/auth/callback` (add the production URL later).
5. After creating, open **Certificates & secrets** → **New client secret** → copy the value.
6. Copy the **Application (client) ID**.

## 2. Local setup

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

- `MICROSOFT_CLIENT_ID` – from step 1.
- `MICROSOFT_CLIENT_SECRET` – from step 1.
- `MICROSOFT_REDIRECT_URI` – `http://localhost:3000/api/auth/callback`.
- `ENCRYPTION_KEY` – 64-char hex. Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000 → **Connect Outlook** → sign in with your personal account.
Grant `Mail.Read` and `Mail.Send`.

## 3. Deploy to Vercel

1. Push this folder to a Git repo and import it into https://vercel.com.
2. In project **Settings → Environment Variables**, add the same variables as `.env.local`.
3. Add a **production Redirect URI** in the Azure app registration, e.g.:
   `https://your-app.vercel.app/api/auth/callback`
   and set `MICROSOFT_REDIRECT_URI` to that value.
4. Deploy. Visit the production URL and connect Outlook.

## How the email reminder works

The dashboard polls `/api/emails` every 60 seconds. When it detects invoice emails
it had not seen before, it calls `/api/notify`, which sends an email to your own
address via Microsoft Graph (`Mail.Send`). The reminder fires while the dashboard
tab is open. For push-style reminders even when the tab is closed, add a Microsoft
Graph [change notification webhook](https://learn.microsoft.com/graph/webhooks) +
a small KV store for tokens (not included in this no-DB version).

## Notes / limitations

- "Invoice" = an email received today that has at least one `.pdf` attachment.
  Tighten the filter (e.g. subject contains "invoice") in `lib/graph.js` if needed.
- Tokens live in a cookie; clearing cookies requires reconnecting.
- The reminder requires the dashboard tab to stay open (no background worker, by design for the no-DB setup).
