# Changelog

All notable changes to the ADAGE Field Service Dashboard. Newest first. Add an entry for every change,
noting what changed, why, and how it was verified.

## 2026-10-09 — "Service Report" renamed to "Worksheet" throughout the Report/Overview tabs

- Every user-facing label, tooltip, empty-state and drill-down title that said "service report(s)" now says
  "worksheet(s)" — Engineer Ranking's "Reports · Rate" / "Last Report" columns are now "Worksheets · Rate" /
  "Last Worksheet"; the Service Type donut's unit changed from "reports" to "worksheets". `docs/metrics.md`
  updated to match. Odoo field names (e.g. "Service Engineers") are untouched — only report-text wording.

## 2026-10-09 — Engineer Ranking formula wording

- The "Ranking" formula in Engineer Ranking & Workload's info tooltip now reads "Report Rate = Worksheets
  logged / Jobs assigned" (was "Reports Logged ÷ Jobs Assigned").

## 2026-10-09 — Only the Report tab is shown; it's the default on load

- Header tab bar now lists only "Report" (`tabs` array in App.jsx filtered down); Overview/Worksheets/
  Documents/Timesheets stay in the code (components + routes untouched) but aren't reachable from the nav.
  Default `activeTab` and the logo's "go home" click both changed from "overview" to "report".

## 2026-10-08 — Visit Analysis by Engineer: spare parts listed by name

- Spare Parts Used now lists the parts themselves (distinct, as tags) instead of "N of visits"; sorts by how many
  different parts, exports as a comma-separated list. `engineerVisitStats` returns `spareParts` (sorted names).

## 2026-10-08 — Visit Analysis by Engineer: Spare Parts Used replaces Resolution Recorded

- Columns now read … Avg Hours, Problems Identified, **Spare Parts Used** (visits with ≥ 1 spare part, "N of visits",
  red → green), Main Service Type. Resolution Recorded is removed (resolutions are still listed in Problems & Resolutions).
- `engineerVisitStats`: `withSpares` / `spareRate` replace `resolved` / `resolutionRate`. storageKey bumped to _v2.
- Verified: live data in headless Chrome, no console errors.

## 2026-10-08 — Visit Analysis by Engineer: counts instead of percentages

- Resolution Recorded and Problems Identified now show the number of visits ("2 of 3") instead of a %; they sort and
  export by the count. The badge keeps the red → green colour by share of visits.

## 2026-10-08 — Manager View: Visit Analysis by Engineer swaps Shortest/Longest for Avg Hours

- Removed the Shortest/Longest visit-days columns. Added Avg Hours: Total Working Hours summed across the
  engineer's own timesheets ÷ number of timesheet entries (`engineerHoursStats` in derive.js; engineer =
  the timesheet's Submitted By, else the job's Service Engineers) — a different source table from Avg Days,
  which stays based on worksheet visit dates. Blank when the engineer has no timesheets.
- Avg Days' tooltip now spells out the calculation in full (end − start + 1, both days count, visits
  missing a date excluded) instead of a one-line summary.
- Removed the grayed "VISIT ANALYSIS" section label above the table; the table's own title carries it.

## 2026-10-08 — Manager View: Engineer Ranking polish + donut "Other" drill-down

- Engineer Ranking & Workload: dropped the duplicate grayed section label (kept the table's own title),
  thickened/bordered the report-rate bar for legibility, and replaced the hover-only toolbar tooltip with a
  keyboard-accessible `InfoDot`. The tooltip now uses labeled sections with the Report Rate / Workload
  formulas in their own highlighted boxes instead of one paragraph.
- `InfoDot` (`ui.jsx`) now accepts a structured `{label, formula?, text}[]` in addition to a plain string.
- `InteractiveDonut`: clicking the "Other" slice (ring or legend) now redraws the whole chart and legend
  into that slice's breakdown, with a "← Back" link to return — instead of a static top-4-plus-Other view.
  `topWithOther()` in ReportTab.jsx now keeps the folded-in items (`others`) so this works for Problem Types
  and Service Type.

## 2026-10-08 — Manager View: visit length, visit dates and recurring problems panels removed

- Removed "How long each visit took" (and its visit list), "Visit Dates" and the "Recurring problems" panel. The recurring
  pair still feeds the Next Steps action.
- The Service Type donut moved beside Problem Types; the section is now "Problem Types, Service Types & Next Steps".
- Visit Analysis keeps Visit Analysis by Engineer and Problems & Resolutions.

## 2026-10-08 — Manager View: clearer "never reported" next step

- Reworded: "5 engineers have 3 or more jobs but have never submitted a service report (27 jobs between them)…", so the
  number on the button no longer looks unexplained.
- Its **Take Action → (N engineers)** now opens a table of those engineers (assigned, open, completed, report rate,
  last report…); clicking one lists their assigned jobs. Other actions still open their job list directly.

## 2026-10-08 — Manager View: Next Steps "Take Action" drill-downs

- Each Next Steps bullet has a **Take Action → (N)** button that opens the exact jobs behind it below the card, using the
  same job table (sort, search, Excel export `field-service-action-<id>`, rows open Odoo, ✕ Close). One list open at a time.
- `r.actions` items are now `{ id, text, rows }`; `recurring` keeps its case-id Set. Thresholds and wording unchanged.
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: Visit Analysis by Engineer moved up, rows open assigned jobs

- **Visit Analysis by Engineer** now sits above Problems & Resolutions.
- Clicking an engineer there lists the jobs assigned to them (Service Engineers field) right below, with the same job
  table as the other drill-downs (rows open the case in Odoo; ✕ Close or click the row again). The employee Odoo link
  stays in the Excel export.

## 2026-10-08 — Manager View: engineer ranking rows open the engineer's jobs

- Clicking an engineer in **Engineer Ranking & Workload** now lists their jobs right below the table (status, created on,
  days open, hours, service report; rows open the case in Odoo; ✕ Close or click the row again). The selected row is
  highlighted. Previously the row opened the employee record in Odoo; that link stays in the Excel export.

## 2026-10-08 — Manager View: Problems & Resolutions table trimmed

- "Problems, Resolutions & Visit Duration" renamed **Problems & Resolutions**; Visit Start, Visit End and Duration columns
  removed (visit length lives in "How long each visit took" and Visit Analysis by Engineer). storageKey bumped to _v3;
  export renamed field-service-problems-resolutions.

## 2026-10-08 — Manager View: Visit Analysis by Engineer

- New **Visit Analysis by Engineer** table in Visit Analysis: visits, avg / shortest / longest visit days, Resolution
  Recorded %, Problems Identified % (both heat-coloured red → green), main Service Type. Default sort slowest average visit
  first; every column sortable; search, Excel export, row opens the employee in Odoo.
- `derive.js`: new `engineerVisitStats(worksheets, userMap)` and `wsEngineerIds(w)` (the report's worksheet → engineer
  rule now lives there). `HeatPct` badge shared by both engineer tables.
- Verified: esbuild compile check passes; engineerVisitStats checked against a small hand-made sample.

## 2026-10-08 — Manager View: Engineer Ranking & Workload table

- New **Engineer Ranking & Workload** table after the treemap: Assigned, Open, Completed, Reports · Rate (heat-coloured
  bar + %), Backlog, Flagged, Hours, Last Report (red when never / > 30 days). Default sort worst report rate first; every
  column sortable; search, Excel export (with an Odoo employee link), row opens the employee in Odoo.
- Reuses the existing `engineerStats(r.live, userMap)` call (now returned from the report memo).
- Next Steps no longer lists the never-reported engineers by name; it points to the table.
- `src/lib/odoo.js`: added `odooEmployeeUrl(id)`.
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: interactive monthly trend

- Monthly Trend now shows **two bars per month** (with worksheet / without worksheet) with the count on each bar, a hover /
  keyboard read-out ("May '26: 32 jobs · 10 with · 22 without (31% with a worksheet)") and animated bar heights.
- Clicking a month lists that month's jobs below (status, days open, service report; rows open Odoo; ✕ Close).
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: visit-length band opens its own table

- Clicking a band in **How long each visit took** now opens a separate table of every visit in that band (visit start / end,
  duration, engineer, job, service type; rows open Odoo; ✕ Close), like the waiting-jobs list. The Problems, Resolutions &
  Visit Duration table is no longer filtered by the band.
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: clickable waiting bands, "How long each visit took"

- How long open jobs have been waiting: click an age band (e.g. 90+ days) to list those jobs below the chart; rows open
  the case in Odoo; ✕ Close or click the band again to hide.
- "Start → End Duration" renamed **How long each visit took** with a plain-English tooltip; clicking a band filters the
  Problems, Resolutions & Visit Duration table to visits of that length ("show all" clears it).
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: header removed, completion pointer

- Removed the Manager View header card (title, date, scope); the page now starts with the Regions & Engineers treemap.
- The treemap's 0–100% key is now a completion scale with a moving pointer: it shows the hovered / focused / selected
  region or engineer's completion %, or the whole level (all regions, or the open region) when nothing is pointed at.
  Exposed to screen readers as a meter.
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: UI/UX audit fixes

- Treemap tiles are real buttons: Tab to focus (visible focus ring), Enter/Space to drill, aria-label with the full numbers.
- Small tiles always show their completion %; a 0–100% colour key and a detail strip (hovered / focused / selected tile,
  full hours, open, late, reports) sit under the breadcrumb, so nothing depends on hover or colour alone.
- Treemap height scales with the screen (280–420 px); tile, hint and footnote text raised to 11.5–12 px; tile secondary text
  uses the darker secondary colour for contrast.
- Service Type and Problem Types donuts show the top 4 + "Other".
- Recurring problems now use the service reports' Problems Identified tags (same customer, 2+ jobs) instead of the job's
  Problem Type, which mostly held visit types.
- Section renamed "Recurring Problems & Next Steps"; footnote no longer points to docs/metrics.md.
- Verified: esbuild compile check passes (dev server stopped for low memory, no browser check).

## 2026-10-08 — Manager View: Service Type and Problem Types donuts, Next Steps

- Visit Analysis: **Service Type** donut added beside Visit Dates (same data as the Worksheets tab).
- Recurring Problems & Actions: **Problem Types** donut beside Recurring problems.
- "What to do" renamed **Next Steps**.
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: breadcrumb, Odoo link, visit dates, visit table

- Treemap breadcrumb moved under the panel title, above the filters.
- "Waiting longest" job name links to the case in Odoo (new tab).
- Visit Dates: Missing replaced by Average visit; stats stacked in a narrower column (no white space).
- Visit table columns: Visit Start, Visit End, Duration, Engineer, Job, Problems Identified, Resolution Applied, Spare Parts
  Used; rows with neither a problem nor a resolution are hidden (storageKey bumped to _v2).
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: Print/PDF and Export Excel removed from the header

- The Manager View header no longer has Print / Save as PDF or Export Excel (and the report-level export code and print CSS
  are gone). The drill-down and Visit Analysis tables keep their own Excel export.
- Verified: esbuild compile check passes.

## 2026-10-08 — Manager View: summary, headline numbers and Needs attention removed

- Removed the summary bullets, the 4 headline cards (open, late, stuck, engineers with no reports) and the "Needs
  attention this week" list. The last section is now **Recurring Problems & Actions** (recurring problems + What to do).
- Excel: Summary sheet now holds scope, date and actions; the Needs Attention sheet is gone.
- Verified: esbuild compile check passes (dev server was stopped for low memory, so no browser check this time).

## 2026-10-08 — Manager View restructured: Regions & Engineers, Trends, Visit Analysis

- Page order: **Regions & Engineers** (heading + treemap) → **Monthly Trend · Cases Created** and **How long open jobs have
  been waiting** (the Overview backlog-aging panel, renamed) → **Visit Analysis** → Summary & Actions.
- Treemap tiles now also show hours worked, open (late) jobs and service reports; the engineer jobs table gains Hours.
- Visit Analysis: Start → End Duration, Visit Dates (shortest / longest / missing / average) and a table of problems
  identified, resolution applied, spare parts used (future scope), visit start/end and duration.
- `WorksheetsTab.jsx` now exports `DURATION_BUCKETS` and `TagList` so the report reuses them.
- Verified: NORTH/DELHI → ADESH KUMAR tile "2 of 6 completed · 48 h worked · 4 open (3 late) · 2 service reports";
  export downloads; no console errors.

## 2026-10-08 — Manager View: treemap first, with filters; heat map and region/engineer lists removed

- The region → engineer treemap is now at the top of the Manager View, with filters for Year and Month (Created On),
  Customer and Problem Type (chips + Clear all; "N jobs shown").
- Removed: Engineer ranking heat map, "Engineers needing attention" and "Regions · report rate" (and the region action /
  Engineer Ranking export sheet).
- Verified: 126 jobs → 22 with Year 2026 + Aug; export downloads; no console errors.

## 2026-10-08 — Manager View: region → engineer treemap

- New interactive **treemap** (squarified, no new library): regions sized by jobs and coloured by % completed; click a
  region for its engineers, click an engineer to list their jobs in that region; breadcrumb to go back.
- The engineer-jobs table is shared by the heat map and the treemap.
- Verified: NORTH/DELHI → ADESH KUMAR lists 6 jobs (2 completed); no console errors.

## 2026-10-08 — Manager View: engineer heat map with drill-down

- Engineer ranking is now a **heat map**: one tile per engineer (completed / assigned, %, open, late), coloured red → green
  by completion rate. Clicking a tile opens that engineer's jobs in a table below (status, created on, days open,
  service report; rows open Odoo; Excel export; ✕ Close).
- Verified: clicking ADESH KUMAR lists 11 jobs (5 completed, 6 open); no console errors.

## 2026-10-08 — Manager View: engineer ranking as a bar chart

- Engineer ranking is now a full-width bar chart of **every** engineer: assigned (grey) vs completed (green), most
  completed first, names written vertically. Regions moved to its own full-width panel below.
- Verified: no console errors, export downloads.

## 2026-10-08 — Manager View: engineer ranking, paperwork items removed

- Removed the completed-job paperwork items: "Completed with a service report" and "Ready to close & invoice" KPIs,
  "completed but no service report" attention rows, and the matching summary sentence and action.
- Added **Engineer ranking · completion rate** (engineers with 3+ jobs: completed ÷ assigned, open, late, avg days to
  complete) next to the region panel, plus an "Engineer Ranking" Excel sheet.
- "Open jobs by age" renamed "How long open jobs have been waiting".
- Verified: no console errors, export downloads; top-ranked engineer 3 of 3 completed (100%).

## 2026-10-08 — Report tab rebuilt as the CSD Manager View

- The Report tab is now a minimalist **Manager View** in plain English: 6 status-coloured numbers (open jobs, running
  late, stuck, completed with a service report, ready to close & invoice, engineers with no reports), a "Needs
  attention this week" list (max 5 jobs, click opens Odoo), open jobs by age, engineers needing attention, recurring
  problems (same customer + problem), report rate by region, and up to 3 "What to do" actions.
- Removed from the report: hours, overtime, special dates, spare parts, service types, visit duration, module
  adoption, Odoo-login table and the 12-row risk table. Task Status is no longer used (it isn't maintained in Odoo).
- Excel export slimmed to Summary, Needs Attention, Engineers and Recurring Problems.
- New task field read: `date_last_stage_update` (Odoo has no due dates on any FSM case).
- Verified (live data): 96 open, 84 older than 60 days, 96 stuck, 73% (22/30) completed with a report, 70% (21/30)
  ready to close, 5 engineers with no reports; other tabs unchanged; no console errors; export downloads.

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
