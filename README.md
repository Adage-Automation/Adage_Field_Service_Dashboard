# ADAGE Field Service Dashboard

React dashboard for Odoo Field Service (cases, worksheets, MoM documents, timesheets). Same UI/UX and
stack as the [ADAGE CRM dashboard](https://github.com/Adage-Automation/adage-crm-app): React 18 + Vite,
inline theme tokens, a server-side Odoo proxy, and Microsoft sign-in.

Tabs:
- **Report**: one-screen Manager View for the CSD manager: 6 status-coloured numbers, jobs needing attention, recurring problems, regions and what to do
- **Overview**: totals, logged vs not-logged cases, case status by stage, assignments per engineer, worksheet-logging ranking, and the full case list
- **Worksheets**: visit duration (Time Taken in days), service type, and a Problems & Resolutions table with problems identified, resolution applied and spare parts used
- **Documents**: key insights on flagged records and why they're flagged: a worksheet with no MoM (AMC / Commissioning), or documents with no worksheet. Cases with files in their Attachments field are never flagged
- **Timesheets**: working hours and overtime, travelling days, special dates (with averages)

The **Service Engineer** dropdown in the header filters every tab.

## Run locally

```powershell
npm install
npm run dev
```

Open **http://localhost:5173/**. Microsoft sign-in is skipped in dev.

## Odoo credentials

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `ODOO_URL` | Odoo instance URL, e.g. `https://your-instance.odoo.com` |
| `ODOO_DB` | Database name |
| `ODOO_USERNAME` | Login email of the Odoo user |
| `ODOO_PASSWORD` | API key (recommended) or password |

These are read **server-side only**: by `api/odoo.js` on Vercel and by `vite-odoo-proxy.js` in dev.
Both use the shared `api/_odoo-rpc.js`, which calls Odoo's external `/jsonrpc` API.

The CRM app's `/web/session/authenticate` flow is not used, because Odoo 19 rejects API keys for web
sessions ("Access Denied"). The proxy also allows at most 2 concurrent calls and retries when Odoo.com
answers "Rate limit exceeded".

For Vercel, add the same four variables under **Project → Settings → Environment Variables**.

## Microsoft sign-in (production)

This works the same as in the CRM app. Create a SPA app registration in Azure and set
`VITE_MICROSOFT_CLIENT_ID` and `VITE_MICROSOFT_TENANT_ID` (locally in `.env` and in Vercel). Only
`adage-automation.com` and `adage-kanoo.com` accounts are allowed (see `src/lib/authConfig.js`).
Without these IDs, a production build shows a "sign-in isn't configured" page.

## Project docs

- `CONTEXT.md`: what the project is and does, in plain language
- `CLAUDE.md`: architecture, conventions and gotchas (loaded automatically by Claude Code)
- `docs/odoo-data-model.md`: Odoo models and fields, and how records link together
- `docs/metrics.md`: how every KPI, flag and column is calculated
- `CHANGELOG.md`: history of changes
