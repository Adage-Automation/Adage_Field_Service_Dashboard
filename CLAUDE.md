# CLAUDE.md — ADAGE Field Service Dashboard

Context for Claude Code (and humans) working in this repo. Read this first, then:
- **`docs/odoo-data-model.md`**: every Odoo model and field the app reads, and how records link together
- **`docs/metrics.md`**: how every KPI, chart, flag and table column is calculated
- **`CHANGELOG.md`**: what changed and when. **Add an entry for every change you make.**

## What this is

A React dashboard over live **Odoo 19 Field Service** data (instance: `ODOO_URL` in `.env`). It reports on
cases (`project.task` with `is_fsm`), service worksheets, MoM documents and timesheets, and flags records
where the paperwork is inconsistent.

It's a sibling of the **ADAGE CRM dashboard** (`github.com/Adage-Automation/adage-crm-app`) and must keep
**exactly the same UI/UX**: theme tokens, header and tab pills, cards, donuts, pill dropdowns, the list view
and Excel export. When adding UI, copy the CRM's patterns; don't invent new ones.

Tabs: **Report · Overview · Worksheets · Documents · Timesheets** (the Report tab is the plain-English CSD Manager View). The header's searchable **Service Engineer**
dropdown filters every tab.

## Commands

```powershell
npm install        # first time
npm run dev        # http://localhost:5173 — Microsoft sign-in is skipped in dev
npm run build      # production build (needs VITE_MICROSOFT_* to render more than the "sign-in not configured" page)
```

Node.js lives at `C:\Program Files\nodejs`. In Git Bash, prefix `export PATH="/c/Program Files/nodejs:$PATH";`
if `node` isn't found. There is no test framework. Verify by building, then by loading the app in a browser
against live Odoo and checking the numbers (expected baseline values are in the CHANGELOG).

## Stack and layout

- React 18 + Vite 5, plain JS. No CSS framework: **all styling is inline `style={}` driven by `T`**
  (`src/constants/theme.js`) plus a little global CSS in `App.jsx` (`.card`, `.tab-btn`, `.bar-fill`) and
  `TABLE_CSS` in `ui.jsx`. Categorical colors live in `src/constants/colors.js`.
- No state library. `App.jsx` owns data loading and the engineer filter and passes `model` down.

```
api/_odoo-rpc.js        shared Odoo JSON-RPC client (login + execute_kw, concurrency limit, rate-limit retry)
api/odoo.js             Vercel serverless proxy  → /api/odoo
vite-odoo-proxy.js      dev-server proxy         → /api/odoo (same client)
src/lib/odoo.js         fetchOdoo(model, method, args, kwargs), ODOO_BASE_URL, odooTaskUrl(id)
src/lib/derive.js       buildModel() joins raw reads into cases; filterModel(); flags + reasons; tally()
src/components/ui.jsx   KpiCard, BarList, InteractiveDonut, MultiSelect, FilterSelect, SearchSelect, DataTable, exportToExcel
src/views/shared.jsx    case cell helpers: EngineerPills, StagePill, FlagCell, CountBadge, openCase, odooLinkCell …
src/views/*Tab.jsx      one file per tab
src/main.jsx            MSAL sign-in wrapper (bypassed when import.meta.env.DEV)
```

## Conventions

- Section dividers use `// ─── Name ───…` comments, matching the CRM code.
- **Tables** use `DataTable` with column objects `{ key, label, weight, render, sortValue, exportValue, info, exportOnly }`:
  - Rows open the case in Odoo on click. **Don't add an Odoo-link column to the grid.** Use
    `{ key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (r) => odooLinkCell(id) }` so the
    link only appears in the Excel export.
  - Give `info` (the "?" header hint) to any column that is computed or whose meaning isn't obvious.
    Describe the source field and the formula.
  - Bump the `storageKey` version (`…_cols_vN`) whenever a table's visible columns change. Saved column
    widths are keyed by column count.
- **Chart rows**: wrap them in `<ChartRow columns="…">`. Put list/summary cards in `<Panel>` (it fills the
  cell), and pair short cards with `<Stack>` (donuts inside a stack take `grow={false}`) so every row has
  even heights with no blank areas. Check the layout at 1366 px wide as well as 1600 px.
- KPI cards and chart cards carry an `info` tooltip that explains the calculation. Keep `docs/metrics.md` in sync.
- Never hardcode the Odoo domain. Links go through `odooTaskUrl()`, which uses `ODOO_URL`.
- All counts are derived client-side in `derive.js` (see Gotchas). Put new joins and derived fields there,
  not in the views.

## Gotchas (learned the hard way)

1. **Auth**: `ODOO_PASSWORD` is an API key. Odoo 19 **rejects API keys on `/web/session/authenticate`**
   ("Access Denied"), which is the CRM app's method. This app uses `/jsonrpc` `common.login` + `object.execute_kw`.
2. **Rate limits**: Odoo.com returns "Rate limit exceeded" (HTTP 429, HTML page) on bursts. The proxy allows
   2 concurrent calls and retries with backoff. Don't fire many parallel requests from the client.
3. **Non-stored fields**: `worksheet_count`, `x_studio_worksheets_count`, `message_attachment_count` can't be
   used in domains (they raise "not stored"). Count child rows instead.
4. **Worksheet link**: worksheets point at their case through **`x_studio_task_id`**. `x_project_task_id`
   exists but is always empty.
5. **Text hours**: timesheet hours (`x_studio_total_working_hours`, `x_studio_total_overtime_hours`) are
   **char** fields. Parse them with `parseHours()`.
6. **Assigned person**: `x_studio_service_engineers` (m2m `hr.employee`). `user_ids` and
   `x_studio_assigned_persons` are empty on this instance.
7. Some timesheets have no `x_project_task_id`. They count in the unfiltered totals and drop out when you
   filter by engineer.
8. Studio model and field technical names (`x_project_task_line_xxxxx`) are instance-specific and can change if
   a Studio model is recreated. Before assuming a logic bug, check the schema PDFs in the repo root
   (`Project Model Overview.pdf`, `Worksheets Overview.pdf`, `Timesheets Model Overview.pdf`,
   `MoM AMC Model Overview.pdf`, `MoM Commissioning Model Overview.pdf`), or run `fields_get` on the live instance.
9. Production builds without `VITE_MICROSOFT_CLIENT_ID` / `VITE_MICROSOFT_TENANT_ID` fold to the
   "sign-in isn't configured" page, and the bundle is tiny. That's expected.

## Environment

`.env` (gitignored, server-side only): `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_PASSWORD`, plus
`VITE_MICROSOFT_CLIENT_ID` / `VITE_MICROSOFT_TENANT_ID` for production sign-in. Only `ODOO_URL` is exposed to the
browser (`vite.config.js` `define`), and only for links. See `.env.example`.
