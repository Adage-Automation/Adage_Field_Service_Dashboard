# Project Context — ADAGE Field Service Dashboard

A plain-language overview of what this project is, why it exists, what it shows and how it works.
For detail, see `docs/metrics.md` (every calculation), `docs/odoo-data-model.md` (every Odoo field),
`CLAUDE.md` (developer conventions) and `CHANGELOG.md` (history).

---

## 1. Purpose

ADAGE Automation runs its field service operations (AMC visits, commissioning, troubleshooting, service calls)
in **Odoo 19 Field Service**. Engineers are expected to record each visit through:

- a **Service Call Worksheet** (what was done, problems found, spare parts used, visit dates),
- a **MoM** (Minutes of Meeting: AMC or Commissioning),
- a **Timesheet** (working hours, overtime, travel, special dates),
- supporting files (certificates, attachments).

Odoo stores all of this but doesn't show management **whether the paperwork is actually being done**. This
dashboard answers:

- How many cases are there, and how many have been **logged** (have a worksheet)?
- Which engineers log their work, and which don't?
- Which cases have **inconsistent paperwork** (a worksheet with no MoM, or documents with no worksheet)?
- How much time is being spent on site, in travel and in overtime?
- What problems keep recurring, and which spare parts are being used?
- Which jobs need attention this week, and what should be done? (Manager View)

It is a **read-only** reporting tool. It never writes to Odoo.

---

## 2. Who uses it

ADAGE managers and service coordinators. Sign-in uses **Microsoft (Azure AD)** and is limited to
`adage-automation.com` and `adage-kanoo.com` accounts. Sign-in is skipped when running locally in dev mode.

---

## 3. Relationship to the CRM dashboard

It's a sibling of the **ADAGE CRM dashboard** (`github.com/Adage-Automation/adage-crm-app`) and deliberately
keeps **exactly the same look and behaviour**: the theme, header and tab pills, cards, donuts, pill dropdowns,
list view, column resizing and Excel export. New UI should copy CRM patterns rather than invent new ones.

---

## 4. What the dashboard shows

A **Service Engineer** dropdown (searchable) in the header filters **every tab** to one engineer's cases.
**Refresh** reloads live data from Odoo in the background without clearing the screen.

| Tab | What it shows |
|---|---|
| **Report** | **Manager View** for the CSD manager, in plain English: regions → engineers treemap with filters, monthly trend, how long open jobs have been waiting, visit analysis (duration, visit dates, problems & resolutions), recurring problems and up to 3 actions. |
| **Overview** | Total cases, logged vs not logged, unlogged backlog and its age, completed cases with no worksheet, **Case Status by stage**, monthly trend, region logging rates, **Engineer Workload & Logging Compliance** table, logging ranking, Key Insights, Flagged Records, and the full **All Records** list. |
| **Worksheets** | Worksheet counts, problems identified, spare parts used, average **Time Taken (days)**, service type split, visit dates, engineer answers, worksheet records, **Problems Found & Resolution Applied** (problems, resolution, spare parts) and the Spare Parts Register. |
| **Documents** | Paperwork consistency. **Key Insights · Flagged Records** explains how many cases are flagged and why, plus the Document Check donut, flagged-by-engineer chart, MoM Register and Completed · No Evidence list. |
| **Timesheets** | Working and overtime hours, travelling days, special dates (site holiday, casual leave, overtime), hours per engineer, task and customer, time to complete, and Key Insights. |

Every table supports search, sorting, resizable columns and **Excel export**. Clicking a row opens the
case in Odoo, and the Odoo link is included in exports.

---

## 5. The core business rules

**Case**: an Odoo `project.task` with `is_fsm = True`.

**Assigned engineer**: the case's **Service Engineers** field (`x_studio_service_engineers`).

**Logged case**: the case has **at least one Service Call Worksheet**.

**Document flags** (shown in the Doc Check column and the Documents tab):

| Flag | When |
|---|---|
| ⚑ **No MoM** | a worksheet is filled, but there is no MoM (AMC) or MoM Commissioning |
| ⚑ **No Worksheet** | a MoM, Commissioning Certificate or Documents-section file exists, but no worksheet |
| ✓ **Attached** | the case's **Attachments** field (`attachment_ids`) has a file: **never flagged** |
| ✓ OK | worksheet + MoM |
| Not started | nothing recorded yet |

**Completed · No Evidence**: the case is in a Completed stage but has no files, no MoM and no timesheet.

**Time Taken (days)**: Actual Visit End − Actual Visit Start + 1.

**Travelling days**: travel-to days + travel-from days, inclusive.

Full formulas are in `docs/metrics.md`.

---

## 6. Where the data comes from (Odoo)

```
project.task (is_fsm)                         the case
 ├─ Service Call Worksheet  (x_project_task_worksheet_template_4, via x_studio_task_id)
 │    ├─ problems   → x_problems
 │    └─ spares     → x_spare_parts
 ├─ MoM (AMC)                 x_project_task_line_34995
 ├─ MoM Commissioning         x_project_task_line_12c3e
 ├─ Commissioning Certificate x_project_task_line_3517d
 ├─ Documents section         x_project_task_line_04bec
 └─ Timesheets                x_project_task_line_d19f2
      └─ Special Dates        x_project_task_line_d19f2_line_1c99e
hr.employee — names of engineers
```

All records are fetched once and joined **in the browser** (`src/lib/derive.js`). Odoo can't filter on several
of the needed counts because they are non-stored fields. The Studio model names (`x_project_task_line_…`) are
specific to this Odoo instance. The schema PDFs in the repo root document them.

---

## 7. How it works (architecture)

```
Browser (React)  ──POST /api/odoo──►  Proxy  ──JSON-RPC /jsonrpc──►  Odoo 19
                                       │
                 dev:  vite-odoo-proxy.js (Vite middleware)
                 prod: api/odoo.js (Vercel serverless function)
                 both: api/_odoo-rpc.js (login, 2-call concurrency limit, retry on rate limits)
```

- **Frontend:** React 18 + Vite 5, plain JavaScript. All styling is inline, using the theme tokens in
  `src/constants/theme.js`. There's no CSS framework and no state library.
- **Credentials** (`ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_PASSWORD`, an API key) live only on the
  server. The browser only ever sees `ODOO_URL`, which it uses to build links.
- **Why `/jsonrpc`:** Odoo 19 rejects API keys on `/web/session/authenticate`, the method the CRM app uses.
- **Excel export** uses `exceljs`, loaded on demand.

### Folder map

```
api/                Odoo proxy (Vercel) + shared JSON-RPC client
src/App.jsx         data loading, header, tabs, engineer filter, refresh
src/lib/derive.js   joins Odoo records into cases; flags, metrics, helpers
src/lib/odoo.js     fetchOdoo() and odooTaskUrl()
src/components/ui.jsx   shared UI: KPI cards, donuts, bar lists, tables, dropdowns, export
src/views/*Tab.jsx  one file per tab; shared.jsx = case-level cell helpers
src/main.jsx        Microsoft sign-in wrapper
docs/               metrics and data-model reference
*.pdf               Odoo schema exports for each model
```

---

## 8. Running and deploying

```powershell
npm install
npm run dev        # http://localhost:5173 (sign-in skipped)
npm run build      # production build
```

1. Create a `.env` file by copying `.env.example` and filling in the four Odoo values. `.env` is gitignored.
   **Never commit it.**
2. Production runs on **Vercel**. Set the same Odoo variables there, plus `VITE_MICROSOFT_CLIENT_ID` and
   `VITE_MICROSOFT_TENANT_ID` for sign-in. Without those two, the production site shows a
   "sign-in isn't configured" page.

---

## 9. Known data caveats

- About 95% of worksheets, timesheets and MoMs are created by one shared Odoo login ("Service Engineers").
  Per-engineer numbers therefore use the **Service Engineers** fields, not the Odoo user who created the record.
- Some timesheets aren't linked to a case. They count in the totals and drop out when an engineer is selected.
- Timesheet hours are stored in Odoo as text, so the app parses them.
- Odoo.com rate-limits bursts of requests. The proxy limits concurrency and retries automatically.

---

## 10. Baseline numbers (live data, Oct 2026)

| Measure | Value |
|---|---|
| Cases | 126 (96 In Progress / 30 Completed) |
| Logged cases | 37 |
| Worksheets | 42 |
| Timesheets | 42 |
| Engineers | 44 |
| Document Check | 40 checked: 26 OK, 5 No MoM, 1 No Worksheet, 8 cleared by attachments |

These are useful for checking that a change hasn't broken a calculation.
