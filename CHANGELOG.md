# Changelog

All notable changes to the ADAGE Field Service Dashboard. Newest first. Add an entry for every change,
noting what changed, why, and how it was verified.

## 2026-10-08 — Over-engineering audit cleanup (round 2)

- Deleted unused `StatusPill`, `LoggingLabel`, `TASK_STATUS_COLORS` and `c.loggingLabel`.
- Stopped fetching unused Odoo fields: task `x_studio_problem_subtype`, `x_studio_call_id`, `x_studio_origin`;
  worksheet `x_project_task_id` (always empty), `x_studio_proposed_visit_date`, `x_studio_next_service_due_date`;
  timesheet `x_studio_client`. `docs/odoo-data-model.md` updated.
- `readBody()` in `api/_odoo-rpc.js` replaces the request-body reader duplicated in both proxies.
- Helpers only used in their own file are no longer exported.
- Verified: build passes; all 5 tabs load against live Odoo in headless Chrome with no console errors.

## 2026-10-07 — Worksheet column label

- Service Call Worksheets: the "Time Taken" column header now reads "Time Taken (Days)".
- Docs: README tab list (Report first, Case Status by stage, Problems & Resolutions, attachment rule) and
  `docs/metrics.md` (Time Taken (Days), Problems & Resolutions table) brought up to date.

## 2026-10-07 — Attachments clear flags, Documents insights, tab order

- Header: the Report tab is now first.
- Cases with a file in the task's **Attachments** field (`attachment_ids`) are never flagged; they show
  "✓ Attached". Flagged count dropped from 13 to 6 (5 No MoM, 1 No Worksheet); 8 cases cleared.
- Documents: the red banner is replaced by **Key Insights · Flagged Records**, which covers the totals, why each
  flag type happens, the engineer with the most flags, and cases cleared by attachments. The Document Check
  donut gains a "Cleared · files attached" segment and view.
- Overview Case Status: the bars now show Stage (was Task Status).
- Worksheets: Problems Identified and Spare Parts Used columns were moved from Service Call Worksheets to
  Problems & Resolutions, which now also lists worksheets that only record spare parts.
- Verified: build passes; headless Chrome against live Odoo shows no console errors and Document Check totals
  40 = 26 OK + 5 + 1 + 8 cleared.

## 2026-10-07 — All Records columns

- All Records order: Created On, Case, Customer, End User, Region, Problem Type, Service Engineers, Stage,
  Worksheets, MoM, Hours, Doc Check. Task Status, Call Type and Logging Status columns removed.
- MoM column shows the MoM type instead of a count: AMC = MoM (AMC), C = MoM Commissioning (hover a tag for
  the number of entries). Export writes "AMC + Commissioning".

## 2026-10-07 — Over-engineering audit cleanup

- Deleted dead `src/lib/format.js` (CRM leftover, nothing imported it), the unused `OdooLink` and `personColor`,
  and 4 unused CRM colour maps.
- Removed the CORS headers / `OPTIONS` handler from `api/odoo.js`: the proxy is same-origin, and `*` let any
  site call it.
- `engineerStats()` in `derive.js` replaces the two per-engineer loops (Overview + Report).
- `flagCaseColumns()` in `shared.jsx` replaces the duplicated flagged-table columns (Overview + Documents).
- `pct` / `plural` / `avg` live once in `ui.jsx` (were copied in 4 views).

Verified: build passes, all 5 tabs render in headless Chrome, report export works, no console errors.

## 2026-10-07 — Requirements gap fill + Utilization Report

Checked against both requirement briefs (the original website structure and the "high-level utilization report"
brief), then filled the gaps:

### Added
- **Report tab: Utilization Report**, a printable management report (Print / Save as PDF with print CSS,
  plus a multi-sheet Excel export). Sections: Executive Summary (narrative + 10 headline stats), Utilization
  (module adoption per case, the Odoo login that created each record, engineers logging vs never logged),
  What Was Logged (issue types, service types, spare parts), Time Taken, and **Problem Areas, Risks &
  Recommendations**: rule-based findings with High/Medium/Low severity, impact and a recommendation each,
  plus the top 5 recommendations.
- **"Logged Case" label**: a Logging Status column in All Records (`c.loggingLabel`).
- **MoM Register** (Documents): every case with a MoM and its type (AMC / Commissioning / both), row counts,
  subjects, latest date, and whether a worksheet exists.
- **Completed · No Evidence** (Documents): cases in a Completed stage with no files (chatter attachments +
  Documents section), no MoM and no timesheet. Live data: 5 of 30.
- **Problems Found & Resolution Applied** table (Worksheets): problem type, problems, the engineer's resolution text.
- **Spare Parts Register** (Worksheets): times used, the cases and engineers, last used; the most-used part is badged.
- **Problem Types · All Cases** and **Avg Time Taken by Service Type** panels (Worksheets).
- **Hours Taken per Task** table, **Time Taken to Complete** and **Hours by Customer** (Timesheets). All FSM
  cases are in one Odoo project ("Field Service"), so "per project" is reported per task, with the project total.

### Changed
- "Avg Visit Duration" renamed **Avg Time Taken**, and the worksheet "Days" column renamed **Time Taken**.
- New fields read: task `project_id`, `message_attachment_count`; worksheet `x_studio_resolution_applied`,
  `create_uid`; timesheet/MoM `create_uid`.

### Finding worth knowing
- 95% of worksheets/timesheets/MoMs were created by one shared Odoo login ("Service Engineers"), so the
  Odoo user can't identify who did the work. Per-engineer metrics use the Service Engineers / Assigned
  Service Engineer fields instead. This is listed as a risk in the report.

## 2026-10-07 — Review feedback round 3 (business insights, export, refresh)

### Fixed
- **Excel export** now uses a cross-browser download (`downloadBlob()` in `ui.jsx`). The link is attached to the
  DOM and the object URL is revoked after 4 s instead of synchronously, which could silently cancel the
  download in Edge/Firefox. Errors are no longer swallowed: the toolbar shows "✓ Exported N rows" or
  "Export failed: …".
- **Refresh** no longer blanks the page. After the first load it refreshes in the background: the data stays
  visible, the button spins ("Refreshing…"), a progress bar shows under the header, a toast confirms
  ("✓ Data refreshed from Odoo · N cases") or reports the error while keeping the old data, and the header
  shows "Updated HH:MM". Tab and filter state are preserved.

### Changed — Overview rebuilt for business insight
- "Assignments per Engineer" bar list replaced by an **Engineer Workload & Logging Compliance** table: assigned,
  open, completed, logging rate (logged vs not-logged bar), **unlogged backlog** (open cases without a
  worksheet, with the oldest one's age), **Done, No Worksheet**, flagged, hours, and **Last Logged** (how recently
  they filed a worksheet). Sorted by backlog, exportable, and clicking a row filters All Records.
- New KPIs: **Unlogged Backlog** (open cases with no worksheet, oldest age) and **Done, No Worksheet** (completed
  cases missing their service report). "Engineers" shows average cases per engineer.
- **Key Insights** card: auto-generated, clickable findings (logging rate, completed-but-unlogged, largest
  backlog, engineers with zero logging, cases unlogged for 60+ days, paperwork mismatches, best performer,
  weakest region).
- **Monthly Trend** column chart (cases created per month, logged vs not; click a month to filter).
- **Unlogged Backlog · Aging** (0–30 / 31–60 / 61–90 / 90+ days; click to filter) with the oldest case called out.
- **Cases by Region · Logging Rate** (colour-coded by rate; click to filter).
- The Logging Ranking note now includes "last logged N days ago". All Records shows each case's age, and the
  Worksheet filter gains "Open, not logged".
- Worksheets and Timesheets tabs gained their own **Key Insights** (dominant service type, problem rate,
  recurring issues, spares usage, long visits, missing dates; overtime share, engineer dependency, travel per
  trip, leave/holidays, unlinked timesheets).
- `derive.js`: cases now carry `createdISO`, `ageDays`, `isOpen`, `backlog` and `lastLoggedISO`. Added
  `daysAgo()`, `AGE_BUCKETS` and `ageBucketOf()`. `ui.jsx` adds `InsightsCard`, `ColumnChart`, `MiniStack`, and
  `defaultSort` on `DataTable`.

Verified in headless Chrome at 1366 px: all 7 table exports download, refresh re-fetches (11 calls) with data
kept on screen, no console errors.

## 2026-10-07 — Review feedback round 2 (layout)

### Changed
- **No more ragged white space in chart rows.** Rows now use `ChartRow` (cards stretch to the tallest card),
  short cards are paired in a `Stack`, and list cards are `Panel`s that fill their cell. Donuts take `grow={false}`
  inside a stack so they keep their natural height.
- Overview: the Worksheet Logging donut is paired with a new **Case Status** panel (stage split bar + Task Status bars).
  The KPI row gains a **Flagged Records** card (click to jump to the table).
- Worksheets: Service Type is paired with **Visit Dates** (shortest / longest / missing; "Missing" filters the
  list). Duration is paired with **Engineer Answers** (Yes/No/Blank split bars for "Problems found?" and
  "Spare parts used?"). Top Problems and Top Spare Parts lists show more rows.
- Timesheets: the Special Dates donut is paired with a **Time Summary** (regular vs overtime split, average
  hours, average travel, total work days).
- Documents: the two donuts are stacked on the left, with Flagged by Engineer on the right.

### Added
- **Flagged Records table on the Overview** (between the charts and All Records): flag + reason, case, engineers,
  stage, worksheets, MoM/docs, created on. It has search, Excel export (with the Odoo link), a colored left
  edge per flag type, and the engineer filter applies.
- `ui.jsx` layout helpers: `ChartRow`, `Stack`, `Panel`, `SplitBar`, `MiniStat`.

Verified at 1366 px and 1600 px in headless Chrome against live data; no console errors.

## 2026-10-07 — Review feedback round 1

### Added
- **Searchable Service Engineer filter** in the header (`SearchSelect` in `ui.jsx`). Type to filter, use the
  arrow keys and Enter, Esc to close. It replaces the plain `<select>`, which was hard to use with 44 engineers.
- **"?" column descriptions** in table headers (`info` on `DataTable` columns, shown as a native tooltip like the
  CRM's list headers). They explain the source field and the calculation for every computed column, across all tabs.
- **Reverse document flag: "⚑ No Worksheet"**. A case that has a MoM (AMC / Commissioning), Commissioning
  Certificate or Documents-section file but **no worksheet** is now flagged, with a written reason. The
  existing flag was renamed "⚑ No MoM" (worksheet without MoM) and also carries a reason. Commissioning
  Certificates (`x_project_task_line_3517d`) and the Documents section (`x_project_task_line_04bec`) are now fetched.
- **Doc Check column** in the Overview "All Records" list (flag, with the reason on hover).
- Project context docs: `CLAUDE.md`, `CHANGELOG.md`, `docs/odoo-data-model.md`, `docs/metrics.md`.

### Changed
- **Odoo link column removed from every grid**; clicking a row already opens the case in Odoo. The link is
  still written to the Excel export (`exportOnly` columns).
- Documents tab: KPIs now split into "Worksheet · No MoM" and "Docs · No Worksheet". The "Show" filter
  gains both flag types, the donut shows three states, and the document-type donut includes certificates and files.
- Table `storageKey`s bumped to `_v2` (the visible column sets changed).

### Removed
- `MEMORY.md`. Its content moved into `CLAUDE.md` and `docs/`.

## 2026-10-07 — Initial build

- Built from the `adage-crm-app` scaffold: same theme, header, tabs, cards, donut, list view and Excel export,
  with Microsoft sign-in kept (bypassed in dev).
- Tabs: Overview, Worksheets, Documents, Timesheets, plus a global Service Engineer filter.
- Odoo proxy rewritten to `/jsonrpc` (`api/_odoo-rpc.js`). Odoo 19 rejects API keys on the CRM's
  `/web/session/authenticate` flow. Added a 2-call concurrency limit and retry on Odoo.com "Rate limit exceeded".
- Env var names follow this folder's `.env`: `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_PASSWORD`.
- **Verified baseline (live data, 2026-10-07):** 126 cases (96 In Progress / 30 Completed), 37 logged,
  42 worksheets, 44 engineers / 143 assignments, 11 cases with a worksheet but no MoM, 2 with a MoM but no
  worksheet, 42 timesheets (12 unlinked), 25 special dates, 2,368 working hours, 87 travel days.
