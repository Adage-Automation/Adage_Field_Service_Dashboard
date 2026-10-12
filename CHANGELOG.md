# Changelog

All notable changes to the ADAGE Field Service Dashboard. Newest first. Add an entry for every change,
noting what changed, why, and how it was verified.

## 2026-10-12 — Customer Insights: date filter (All Time / Month / Week / Custom range)

- Report tab's Customer Insights section (both the bar chart and the Grid table, which now read the same
  date-filtered data) gets a date filter on the job's Created On: **All Time** (default, unfiltered) · **Month
  wise** / **Week wise** with ← / → / Today navigation around an anchor date · **Custom range** with From/To +
  Apply. Reuses the Gantt toolbar's existing `ganttPeriodRange`/`ganttShiftAnchor` day-math instead of
  duplicating it. The active range and its job count are printed next to the controls; clicking a customer's bar
  or row still lists their jobs, now scoped to the filtered range too. Fixed an aria-label collision caught while
  testing: the new ←/→/Today buttons and From/To inputs initially reused the Gantt toolbar's exact aria-labels
  ("Previous period", "Range start", etc.), which would have broken screen-reader navigation between the two
  toolbars; renamed to "Customer Insights: …". Verified live with Playwright across all four modes (Month → Next
  → October, Custom range Aug–Oct → 47 jobs), no console errors.

## 2026-10-12 — Treemap drill-down happens in the same box, not a second panel

- Report tab's Engineer's Dashboard treemap: clicking a tile no longer opens a separate `DataTable` list, and no
  longer opens a second treemap in a panel below. **The one treemap box now swaps its own tiles in place**:
  grouped by engineer, clicking an engineer tile replaces the tiles with that engineer's customers; grouped by
  customer or region, clicking replaces them with the engineers involved (same `tile()` shape and hover meter,
  reused for both levels). The breadcrumb above the box grows a clickable segment for the drilled-in name —
  click it to swap back to the top-level tiles. Clicking a breakdown tile (or "View all N jobs") still lists the
  actual jobs below, unchanged. A new `tmDrillPeek` state drives the drilled-in level's hover meter, reset
  wherever `tmDrillKey` already was. Removed the now-unused `drillColumns` / breakdown `DataTable`. Verified live
  with Playwright: tile count goes from 48 (top level) to 6 (drilled into one engineer) and back to 48 on
  breadcrumb click, both grouping directions (engineer → customers, customer → engineers), no console errors.

## 2026-10-12 — Visit Analysis by Engineer: removed "Problems Identified" column

- Report tab's **Visit Analysis by Engineer** table no longer shows the Problems Identified column (visits with
  ≥ 1 problem tag). Still available in **Problems & Resolutions** below it and in the per-worksheet records table.
  Bumped `storageKey` to `..._cols_v4` since the visible column count changed. Verified with `npm run build`.

## 2026-10-09 — Manager View: KPI labels "Jobs In Progress" / "Jobs Completed"

- Report tab top KPI row: **In Progress** → **Jobs In Progress**, **Completed** → **Jobs Completed**. Verified with
  `npm run build`.

## 2026-10-09 — Manager View: "Pending Worksheet Entries" title

- Report tab: the **How long open jobs have been waiting** panel is renamed **Pending Worksheet Entries**. It still
  shows open jobs with no worksheet, grouped by age. Verified with `npm run build`.

## 2026-10-09 — Plain-English labels everywhere; dead donut code removed

- Standardised the visible labels on every tab so non-technical users can read them (the full old → new table is in
  `docs/metrics.md` under "Screen wording"):
  - Case/Task → **Job**; Stage / Case Status / Task Status → **Status**; Open → **In Progress**; Service Engineer(s)
    → **Engineer(s)**.
  - Logged / Logging / Report Rate → **With / Without Worksheet**, **Worksheet Rate**; Unlogged Backlog →
    **In-Progress Jobs Without Worksheet**; Last Logged (In) → **Last Worksheet**.
  - Flagged → **Paperwork Issues**.
  - MoM / Comm. / Cert. / Docs / Hrs / Avg / OT are spelled out.
  - Hours and days wording is unified (Working Hours, Travel Days, Visit Length).
  - Hint headings are plain English (Click for details, Summary, Segments, Age groups, Box …).
- Only visible text changed. Data keys, filter values, Excel file names and saved column widths are untouched. Hints
  still name the Odoo fields (e.g. Service Engineers) so users can find them in Odoo.
- Kept on purpose: **Logged Worksheet** / **Unlogged Worksheet** in Engineer Ranking (names you chose earlier).
- Removed the hidden Problem Types / Service Type donuts on the Report tab (`SHOW_TYPE_DONUTS` was always off), along
  with their helpers: −27 lines.
- Verified with `npm run build` and the dev server compiling every tab. The renames were done by a script that only
  edits text strings and printed every change for review.

## 2026-10-09 — Manager View: "Jobs Created" trend title

- Report tab: **Monthly Trend · Cases Created** renamed **Monthly Trend · Jobs Created**, to match the tab's "jobs"
  wording. The Overview tab's chart is unchanged. Verified with `npm run build`.

## 2026-10-09 — Engineer Schedule: "Total visits per day" label

- The Gantt's **Total** row is renamed **Total visits per day** (**Total visits per month** in the Year view, where
  each column is a month). The ⓘ hint is renamed to match. Verified with `npm run build`.

## 2026-10-09 — Engineer Schedule: monthly columns in the Year view

- With **Year** picked, the Gantt now shows 12 month columns (January–December under a 2026-style year header) instead
  of 365 day columns, like Odoo's Year scale. Each bar spans its start month to its end month. Visits for the same
  customer in the same month stack into lanes, and the Total row counts visits active in each month. Day, Week, Month,
  Quarter and custom From/To ranges still use day columns. Verified with `npm run build`.

## 2026-10-09 — Engineer Schedule: Odoo-style date navigation, moved to the top

- Moved the Engineer Schedule panel from after Engineer Ranking & Workload to right after the KPI row — first
  thing a manager sees, per the user's request.
- Added date navigation matching Odoo's own Gantt toolbar (per the user's reference screenshot): ← / → step by
  the picked period, a **Day / Week / Month / Quarter / Year** picker (`FilterSelect`, reused as-is), a **Today**
  button, and an explicit From/To range with an **Apply** button that overrides the period/anchor until ←, →,
  Today or the period picker is used again. New state: `ganttPeriod`, `ganttAnchor`, `ganttCustomRange`, plus
  `ganttFrom`/`ganttTo` for the two (native `<input type="date">`, no new dependency) range fields.
- `gantt`'s useMemo, and `EngineerGantt`'s props, generalized from "the current calendar month" to an arbitrary
  day range: `ganttPeriodRange(period, anchor)` computes day-number bounds for day/week/month/quarter/year,
  `ganttShiftAnchor` moves the anchor by one period for ←/→. The day header now zero-pads and additionally shows
  a small month label at each month boundary when the visible range spans more than one calendar month (e.g. a
  Quarter or Year view, or a custom range crossing months) — a bare day-of-month number alone would be ambiguous
  there. A custom/period range is capped at 400 days as a defensive guard against a reversed or huge picked
  range.
- Verified live via Playwright (clock faked to 2026-09-15, matching the reference screenshot's data): Quarter
  view showed 13 engineers across Jul–Sep with "Jul 01"/"Aug 01" month markers; → advanced to Oct–Dec (1
  engineer, matching the already-verified October data); Today returned to the quarter containing the fake
  "now"; a manual 01/08/2026 → 31/10/2026 range + Apply showed 9 engineers across the custom 92-day span. No
  console errors in any state.

## 2026-10-09 — Engineer Schedule: restyled as an Odoo-style grouped Gantt

- Restructured `EngineerGantt` to match the grouped layout of Odoo's own Gantt view (per the user's reference
  screenshot): a collapsible group row per engineer (▾/▶ toggle, name bold), with one sub-row underneath per
  customer they're visiting this month — instead of every visit crammed into a single per-engineer row needing
  lane-stacking for every overlap. A visit still gets its own lane within its customer sub-row if two visits for
  the same engineer+customer overlap in days (rare, but `packLanes` still guards it).
  Collapse state lives in a new `ganttCollapsed` (Set of engineer ids) + `toggleGanttEngineer`.
- Added a **Total** row at the bottom: count of visits active on each day across every engineer, deduplicated
  per worksheet (a 2-engineer visit counts once, not twice) — computed from a flat `allBars` list built
  alongside the per-engineer/per-customer grouping, not by re-summing the (duplicated) per-row bars.
- Day header now zero-pads ("01", "02", …) and the row-label column is headed "Workload per person", matching
  the reference. Kept the app's own light theme/tokens throughout rather than copying Odoo's dark admin chrome,
  per this app's "same UI/UX as the CRM app" rule.
- Verified live via Playwright with the browser's `Date` temporarily faked to mid-September 2026 (the richer
  month shown in the user's reference screenshot, from the same live Odoo instance): 2 engineers rendered as
  collapsible groups (Sentu Samanta → Jindal Steel Limited (JSL) + TLT Engineering India Pvt. Ltd.; Utpal Kumar
  Singha → Jindal Steel Limited (JSL)), Total row showing 1 under each active day, and collapsing "Sentu
  Samanta" correctly hid only its two sub-rows while leaving the Total row and the other engineer's row
  untouched. No console errors.

## 2026-10-09 — Engineer's Dashboard: Engineer Schedule Gantt chart

- New **Engineer Schedule** panel (`EngineerGantt` in ReportTab.jsx), below Engineer Ranking & Workload: one row
  per service engineer, one bar per worksheet visit, spanning Actual Visit Start Date → Actual Visit End Date,
  clipped to the current calendar month. The bar shows the customer (`caseCustomer`); click it to open the job
  in Odoo (same `openCase` as every other drill-down). Today's column is highlighted.
- Whose row a visit counts on follows the same rule as Visit Analysis by Engineer (`wsEngineerIds`: the
  worksheet's Assigned Service Engineer, else the job's Service Engineers) — a visit with two engineers appears
  on both rows. Visits without a start date aren't plotted; a visit missing only its end date, or a same-day
  visit, draws as one day.
- Two visits for the same engineer that overlap in days stack into separate lanes instead of overlapping
  visually — a small greedy interval-packing helper (`packLanes`), the standard algorithm for this (sort by
  start, reuse the first lane whose last bar ends before the new one starts).
- Reused existing building blocks rather than inventing new ones: `dayNum` (now exported from derive.js, was
  already used internally there for date-only fields) for the month-clipping math, and `hashColor` (now exported
  from shared.jsx, already used for the Problem/Call Type pills) so a customer gets the same colour here as
  elsewhere in the app.
- Verified live via Playwright: October 2026 (the live "today"), 1 engineer has a visit this month ("GAUTAMEE
  PANDURANG NAIK", Kuantum Papers, 2–6 Oct); clicking the bar opened `project.task/3071` in Odoo with the
  tooltip's dates matching exactly. No console errors.

## 2026-10-09 — Engineer's Dashboard: fixed summary text, customer/engineer drill-down

- **"All X" summary text was wrong.** Grouped by engineer, the aggregate line summed each tile's job count
  (`tmItems`), but a job with two engineers is counted once per engineer tile — so it read "27 of 144 cases
  completed" against a real total of 127/22. Now shows roster utilization instead: "44 of 106 service engineers
  are assigned" (same numbers as the KPI row), with the meter/pointer repurposed to the assignment rate for this
  level only — a hovered/selected tile still shows its own real completed/total/rate, unchanged. Grouped by
  customer or region, the aggregate line no longer claims a (double-counted) completion rate either — it now
  says "N customers shown" / "N regions shown".
- **Clicking a tile now drills into a breakdown, not straight to a flat job list.** Grouped by engineer, clicking
  an engineer tile shows the customers they serve (jobs/completed/hours-worksheets hint per customer); grouped
  by customer or region, it shows the engineers involved. A "View all N jobs" button (and clicking a breakdown
  row) still gets to the actual job list, reusing the existing jobs table and Odoo links. New `drillBy`/
  `drillItems`/`drillColumns` in `ReportTab.jsx`, reusing the same `tile()` shape as the top-level treemap items.
  `DataTable` needed an explicit `rowKey={(d) => d.key}` here since these rows don't have Odoo `.id`s.
- Tile hint text (hours worked · worksheets) bumped from 11.5px/16px (huge tiles) to 13px/18px and bolded, and
  the big-tile number line now reads "N / M jobs completed · R%" instead of "N / M completed · R%".
- Verified live via Playwright against Odoo: engineer grouping shows "44 of 106 service engineers are assigned";
  customer grouping shows "102 customers shown"; clicking an engineer tile lists 12 customers served with a
  working "View all 12 jobs" expansion; clicking a customer tile lists the 2 engineers assigned to it. No
  console errors after fixing a missing-`rowKey` React warning.

## 2026-10-09 — Engineer's Dashboard: Unassigned Service Engineers view

- `App.jsx` now fetches the full roster (`hr.employee` reporting to Samaresh Dey, id 184) as `{id, name}` pairs
  instead of just a count, and excludes archived employees (dropped `active_test: false` from that one fetch —
  the employee-name-resolution fetch used elsewhere keeps it, since historic records can reference former
  employees). Passed down to `ReportTab` as `serviceEngineers`.
- The treemap panel (grouped by Service Engineer) gets an **All Engineers / Unassigned Service Engineers (N)**
  pill pair beside the breadcrumb. Unassigned = roster employees with zero live, non-cancelled jobs — computed
  as `serviceEngineers` minus the ids in `r.engineers` (which only ever contains engineers with ≥ 1 case).
  Only shown when grouped by Service Engineer; switching the Group by dropdown away resets back to the normal
  view.
- Unassigned engineers render as a new `UnassignedGrid`: equal-size grey tiles, name only (no rate/size/hours,
  since there's nothing to compute). The completion-rate meter above the treemap shows an empty/neutral bar
  instead of 0% or 100% in this view, and the job filters (Year/Month/Customer/Problem Type) are hidden since
  they don't apply. Verified in headless-free Chrome via Playwright: 105 roster engineers, 44 assigned, 63 shown
  as unassigned tiles with no console errors; switching back to All Engineers restores the normal treemap.

## 2026-10-09 — Engineer's Dashboard: bigger treemap, simpler tile text

- Treemap height increased from `clamp(280px, 38vw, 420px)` to `clamp(380px, 46vw, 560px)` so tiles (and their
  labels) stay readable instead of getting squeezed, especially with many engineers/customers/regions.
- Tile hint trimmed to hours worked + worksheet count only (dropped the open/late count and the
  customer/engineer breadth count — too much crammed onto one line). A tile that fills most/all of the treemap
  (e.g. only one engineer shown) now renders its text at ~2x size instead of leaving the extra space blank.
  Verified with `npm run build`.

## 2026-10-09 — Manager View: Customer Insights view switch, legend filters

- **Bar Graph / Grid** switch on the Customer Insights heading: it shows either the chart or the table, not both.
  Bar Graph is the default.
- Chart metrics are now Jobs, Visits (Worksheets), Visit Days and Working Hours. **In Progress** and **Jobs Without
  Worksheet** are removed as separate metrics and folded in as below.
- The legend items are now buttons:
  - Jobs: **Completed** or **In progress** shows and ranks only those jobs.
  - Visits (Worksheets): **With worksheet** or **Without worksheet** shows and ranks only those jobs.
  - Clicking the same item again shows both; changing the metric resets it. The chart title names the part shown.
- Verified with `npm run build`.

## 2026-10-09 — Manager View: one Top Customers bar chart

- Customer Insights: the two top-10 bar lists are replaced by one horizontal bar chart with a value axis and gridlines.
  A **By:** picker chooses the metric: Jobs (stacked completed / in progress), Visits, Visit Days, Working Hours, In
  Progress or Jobs Without Worksheet. A second picker chooses Top 10 / 15 / 20. Clicking a bar still lists that
  customer's jobs. The table gains a **Visits** column (storage key → `_cols_v2`), and `customerStats` gains
  `visits` and `unlogged`. Verified with `npm run build`.
- UX pass on that chart, using the ui-ux-pro-max chart guidance:
  - In Jobs mode the in-progress count is printed as text next to each bar ("· 3 open"), so the split isn't shown by
    colour alone. It's also included in each bar's screen-reader label.
  - The name column shrinks on narrow screens (`clamp(90px, 28%, 190px)`).
  - Axis labels are now 11 px in the secondary text colour for better contrast.

## 2026-10-09 — Manager View: Customer Insights

- New **Customer Insights** section below the Monthly Trend. It has two top-10 bar lists (customers by jobs, and by
  working hours) and a per-customer table: jobs, in progress, completed, logged worksheet %, hours, visit days, top
  problem type, region and last job. Click a bar or a row to list that customer's jobs. The numbers come from the new
  `customerStats` in derive.js. Verified with `npm run build`.

## 2026-10-09 — Manager View: more engineer ranking renames, highest rate first

- Engineer Ranking & Workload: **Worksheets · Rate** → **Logged Worksheet**, **Hours** → **Total Working Hours**,
  **Last Worksheet** → **Last Logged In** (days since their latest worksheet). Column order unchanged. The table now
  sorts by report rate high → low by default (was worst first). Verified with `npm run build`.

## 2026-10-09 — Manager View: ranking column renames, visit totals

- Engineer Ranking & Workload (and the "never reported" Next Steps table, which shares its columns): **Open** renamed
  **In Progress**, **Backlog** renamed **Unlogged Worksheet**, **Flagged** column removed.
- Visit Analysis by Engineer: **Avg Days** → **Total Days** (sum of visit days), **Avg Hours** → **Total Hours** (sum of
  Total Working Hours on the engineer's timesheets). Default sort is now total days, descending. `engineerVisitStats`
  returns `totalDays` instead of `avgDays`. Column storage keys bumped for all three tables.

## 2026-10-09 — Report tab: Total Cases KPI row, split from Engineer's Dashboard

- Added a `KpiRow` at the top of the Report tab: Total Cases, Open, Completed, Total Service Engineers,
  Assigned Engineers — reusing the same `KpiCard`/`KpiRow` components the other tabs already use.
- **Total Service Engineers** = `hr.employee` records whose manager (`parent_id`) is Samaresh Dey, employee id
  184. Fetched once in `App.jsx` (`serviceEngineerCount` state, `hr.employee` search_read on
  `[["parent_id", "=", 184]]`) and passed down as a prop, since it's the full engineer roster, not derivable
  from case data like the rest of the model. **Assigned Engineers** = `r.engineers.length` (engineers with
  ≥ 1 case assigned), already computed by `engineerStats`.
- Added a new `SectionLabel` ("Engineer's Dashboard") above the regions/engineers treemap so it reads as a
  separate section from the Total Cases row, per a flowchart the user provided.
- Verified with `npm run build`.

## 2026-10-09 — Problems & Resolutions: Year / Month / Customer / Problem Type filters

- The Problems & Resolutions table gets the treemap's four filters (with chips, Clear all and "N worksheets shown"),
  matched on the worksheet's job: Created On year / month, customer, Problem Type. Independent of the treemap filters.
- New `FilterBar` component and shared `matchesJob` / `jobFilters` helpers in ReportTab.jsx; the treemap now uses them too
  (same look and behaviour as before).
- An **Engineer** filter (searchable) comes first in that row: it matches the worksheet's engineer (Assigned Service
  Engineer, else the job's Service Engineers); options are the engineers on worksheets with a problem or resolution.
  Verified: Engineer = ADESH KUMAR narrows 21 → 4 worksheets with an "Engineer: ADESH KUMAR" chip.
- The filter row sits under the table's "Problems & Resolutions" heading, above the column headers, via a new optional
  `subheader` prop on `DataTable` (ui.jsx).
- Verified in headless Chrome: Month = Aug narrows the table from 21 to 3 worksheets with a "Month: Aug" chip, Clear all
  restores 21, the treemap stays at 127 jobs; no console errors.

## 2026-10-09 — Report tab: pie charts hidden, footer note removed

- Problem Types and Service Type pie charts are hidden for now behind `SHOW_TYPE_DONUTS = false` (set it to `true` to
  bring them back with their section heading). Next Steps now follows Problems & Resolutions directly.
- Removed the footer note ("Odoo has no due dates… Detail lives in the Overview, Worksheets, Documents and Timesheets tabs.").
  The 60-day "late" rule is still explained in the Next Steps "?".
- Verified in headless Chrome: pie charts and footer gone, Next Steps renders; no console errors.

## 2026-10-09 — Column "?" hints use the formula popover

- Every table column "?" now opens the same popover as the cards (labelled sections, formula box) instead of a plain browser
  tooltip. All 20 Report-tab column hints rewritten as `{ label, formula, text }` (e.g. Report Rate = Logged ÷ Assigned × 100,
  Avg Days = mean(Visit End − Visit Start + 1), Flagged = Worksheet AND no MoM · or · MoM / document AND no worksheet).
- `InfoDot` (ui.jsx): popover is now `position: fixed` from the button's screen position, so table headers / scrolling
  containers can't clip it; it opens upward near the bottom of the window (fixes the Next Steps "?" running off-screen),
  closes on scroll, also opens on keyboard focus, and stops clicks reaching the column's sort. `DataTable` headers use it;
  string `info` still works for the other tabs.
- `App.jsx`: the page fade-in no longer holds its last frame (`forwards`), which left a transform on the page wrapper and
  trapped fixed popovers. The fade looks the same.
- Verified in headless Chrome: all 20 column "?" and all card "?" open fully on screen next to their icon; no console errors.

## 2026-10-09 — Report tab: formula "?" on every card and table

- Every card and table on the Report tab now has a structured "?" like Engineer Ranking & Workload (labelled sections,
  formula in a highlighted box): treemap, Monthly Trend, How long open jobs have been waiting, Visit Analysis by Engineer,
  Problems & Resolutions, Problem Types and Service Type donuts, Next Steps (the four action rules), the never-reported
  engineers list, and every job drill-down list (`JOBS_INFO`). Engineer Ranking's "?" gains Backlog and Last Worksheet.
- Column-header hints rewritten to lead with the formula (e.g. "Days Open = Today − Created On", "Report Rate =
  Worksheets logged ÷ Assigned × 100"); the Worksheet column in job lists gains a hint. New `TableHint` helper.
- Verified in headless Chrome against live data: all 9 "?" popovers open with content; no console errors.

## 2026-10-09 — Treemap: second click on an engineer returns to all regions

- In the Regions → engineers treemap, clicking the selected engineer again now closes their job list and goes back to the
  regions level (before, it only closed the list). The detail strip and the "?" hint say so.
- Verified in headless Chrome against live data: NORTH/DELHI → ADESH KUMAR opens the list; clicking ADESH KUMAR again
  shows the region tiles and closes the list; no console errors.

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
