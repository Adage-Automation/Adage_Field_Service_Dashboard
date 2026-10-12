# Metric definitions

How every number on the dashboard is calculated. The logic lives in `src/lib/derive.js` (joins, flags) and
in each `src/views/*Tab.jsx`. The same wording appears in the UI's "?" tooltips, so keep both in sync.

**Global engineer filter.** A case belongs to an engineer when they are in its **Service Engineers**. Worksheets,
MoMs and timesheets follow their case. A child row with no case matches on its own engineer field
(worksheet Assigned Service Engineer / timesheet Submitted By).

**Screen wording (2026-10-09).** The UI uses plain-English labels. Some sections below still use the older names:

| Older name (and in Odoo) | On screen now |
|---|---|
| Case / Task | Job |
| Stage, Case Status, Task Status | Status |
| Open (as a label) | In Progress |
| Service Engineer(s) | Engineer(s). Hints still name the Odoo fields (Service Engineers, Assigned Service Engineer) |
| Logged / Not logged, Logging Rate, Report Rate | With / Without Worksheet, Worksheet Rate |
| Unlogged Backlog, Last Logged (In) | In-Progress Jobs Without Worksheet, Last Worksheet |
| Flagged, Flag & Reason, Flagged Records | Paperwork Issues, Issue & Reason |
| MoM, MoM (AMC), MoM Comm., Comm. Cert. | Minutes of Meeting (MoM), Minutes of Meeting (AMC) / (Commissioning), Commissioning Certificate |
| Docs, Doc Files, Hrs, Avg | Documents, Document Files, Hours, Average |
| Hours, Total Hours, Hours Taken, Hours Worked | Working Hours, Total Working Hours |
| Travelling Days, Time Taken (Days), Start → End Duration | Travel Days, Visit Length |
| Hint headings: Drill in, Read-out, Slices, Bands, Tile … | Click for details, Summary, Segments, Age groups, Box … |

## Overview

| Metric | Definition |
|---|---|
| Total Cases | FSM tasks (`project.task`, `is_fsm = True`), with a breakdown by stage |
| Logged Cases | cases with **≥ 1 worksheet**; % = logged ÷ total |
| Not Logged | total − logged |
| Assigned Engineers | distinct people across all cases' Service Engineers |
| Total assignments | sum of (case × engineer) pairs; a case with 2 engineers counts twice |
| Assignments per Engineer | cases per engineer, split into logged / not logged |
| **Logging Ranking** | per engineer: **assigned cases with a worksheet ÷ assigned cases**. Ties go to more worksheets, then more assigned cases |
| Unlogged Backlog | open cases (stage not Completed/Done/Cancelled) with no worksheet; note = oldest one's age |
| Done, No Worksheet | cases in a Completed stage with no worksheet; % of completed cases |
| Case age | today − Created On (fallback: Odoo create date), in days |
| Backlog Aging | unlogged backlog grouped by age: 0–30, 31–60, 61–90, 90+ days |
| Monthly Trend | cases per month of Created On (last 12 months with data), split into logged / not logged |
| Cases by Region | cases per region; colour = logging rate (green ≥ 50%, amber 25–49%, red < 25%) |
| Engineer Workload table | per engineer: assigned, open, completed, logging rate, unlogged backlog (+ oldest age), done-without-worksheet, flagged, timesheet hours, Last Logged (create date of their most recent worksheet) |
| Key Insights | rule-based findings computed from the numbers above (thresholds: zero-logging engineers need ≥ 3 cases; "old" backlog = > 60 days; regions need ≥ 5 cases) |
| Flagged Records (KPI + table) | cases flagged ⚑ No MoM or ⚑ No Worksheet (see Documents below), each with its reason |
| Case Status | cases per Odoo stage (the Stage column): split bar plus a bar per stage |
| Doc Check column | see the Documents flags below |

## Report tab (Manager View)

Plain-English, one-screen view for the CSD manager. Cancelled jobs are excluded. "Completed" = stage name contains
Completed/Done. Odoo has **no due dates** on this instance (`date_deadline`, `date_end`, `planned_date_begin` are empty),
so lateness uses job age and days since the last stage change (`date_last_stage_update`). Colour = status only.

Every card and table has a "?" that opens labelled sections with the formula in a highlighted box (`InfoDot` with
`{ label, formula, text }[]`): treemap, Engineer Ranking & Workload, Monthly Trend, Pending Worksheet Entries,
Visit Analysis by Engineer, Problems & Resolutions, both donuts, Next Steps, and every job / engineer drill-down list.
Column-header "?" hints use the same popover (a column's `info` can be a string or that array). Keep this file and those hints in sync.

| Item | Definition | Green / Amber / Red |
|---|---|---|
$1
| Engineer Schedule (Gantt) | **Top of the page**, right after the KPI row. Odoo-style grouped Gantt, date-navigable like Odoo's own Gantt toolbar: ← / → step by the picked period (**Day / Week / Month / Quarter / Year**, default Month), a **Today** button resets to now, or pick an explicit From/To and click **Apply** — that custom range stays active until ←/→/Today/the period picker is used again (`ganttPeriodRange`/`ganttShiftAnchor` in ReportTab.jsx; a custom or period range is capped at 400 days). A collapsible group row per engineer who has a worksheet visit in the shown range (click the name or ▾ to collapse), with one sub-row underneath per customer they're visiting — a visit with two engineers appears under both. Bar = Actual Visit Start Date → Actual Visit End Date, clipped to the range (no start date = not shown; missing only an end date, or a same-day visit, draws as one day). Whose group: the worksheet's Assigned Service Engineer, else the job's Service Engineers (same rule as Visit Analysis by Engineer). Two overlapping visits for the same engineer **and** customer stack into separate lanes within that sub-row (`packLanes`, greedy interval packing). Bar label = the job's Customer, coloured by `hashColor(customer)` (the same stable per-string colour used for pills elsewhere); click a bar to open the job in Odoo. The day header zero-pads and adds a small month label at each month boundary when the range spans more than one month. A **Total visits per day** row (**Total visits per month** in the Year view) at the bottom counts visits active per day across every engineer, each worksheet counted once even with two engineers. Today's column is highlighted **Year view** shows one column per month (January–December under a year header, like Odoo): bars span start month → end month, visits in the same month for the same customer stack into lanes, and Total counts visits active in each month. | |
| Engineer's Dashboard treemap | Tiles are keyboard buttons (Tab, Enter); one tile per Service Engineer, Customer or Region (picked with the Group by dropdown — a job with two engineers counts once per engineer tile when grouped by engineer), size = jobs, colour = % completed (red 0% → green 100%). Filters (treemap only): Year and Month of Created On, Customer, Problem Type; "N jobs shown" counts the filtered jobs. A 0–100% meter above the tiles has a pointer that moves to the hovered / focused / selected tile's own completed/total/rate; at the unselected "All X" level it instead shows roster utilization when grouped by engineer (Assigned Engineers ÷ Total Service Engineers — not a jobs tally, since summing each tile's job count double-counts multi-engineer jobs), or just the tile count ("N customers shown" / "N regions shown") when grouped by customer or region. Click a tile to drill in: **the same box swaps to the other dimension's tiles**, in place — grouped by engineer, you now see the customers that engineer serves; grouped by customer or region, you now see the engineers involved (same `tile()` shape and hover meter, computed only within the clicked tile's jobs; the breadcrumb above the box gains the clicked name). Click one of those tiles (or "View all N jobs") to list the actual jobs below (job, customer, status, created on, days open, worksheet; rows open Odoo; Excel export). Click the breadcrumb name to go back up a level (swaps the box back to the top-level tiles) | |
| &nbsp;&nbsp;Unassigned Service Engineers | Grouped by Service Engineer only: an **All Engineers / Unassigned Service Engineers (N)** pill pair beside the breadcrumb. Unassigned = active roster employees (`hr.employee` reporting to Samaresh Dey, id 184, archived excluded) with zero live, non-cancelled jobs — i.e. roster minus everyone in the Engineer Ranking table. Renders as equal-size grey name-only tiles (no rate, size or hours to show); the completion meter above shows an empty bar instead of 0%/100%, and the job filters are hidden | |
| Engineer Ranking & Workload | table, one row per engineer (`engineerStats` over non-cancelled jobs): Assigned (lifetime workload), In Progress (today's workload), Completed, Logged Worksheet (jobs with ≥ 1 worksheet ÷ assigned; red → amber → green), Unlogged Worksheet (in progress, no worksheet), Total Working Hours (timesheet hours on their jobs), Last Logged In (days since their latest worksheet; red when never or > 30 days). Default sort: report rate descending (highest first); every column sortable; clicking an engineer lists their jobs below (rows open the case in Odoo); the export keeps the Odoo employee link | |
| Monthly Trend · Jobs Created | jobs per month of Created On (last 12 months with data): two bars per month, with worksheet vs without worksheet, count on each bar; hover for the split and % with a worksheet; click a month to list its jobs | |
| Pending Worksheet Entries | open jobs **with no worksheet**, by days since created: 0–30 / 31–60 / 61–90 / 90+; note = the job waiting longest (links to the case in Odoo). Click a band to list its jobs (rows open Odoo) | |
| Customer Insights | section below the monthly trend. Customer = the job's Customer (`partner_id`); jobs without one are grouped as "No customer"; cancelled jobs excluded (`customerStats` in derive.js). A **Bar Graph / Grid** switch on the section heading shows either the chart (default) or the table; both read from the same date-filtered data. **Date filter** (applies to both views): **All Time** (default, no filter) · **Month wise** / **Week wise** — ← / → steps a calendar month or week, **Today** resets to the one containing today, shown range + job count printed alongside — · **Custom range** — explicit From/To + **Apply**, same pattern as the Engineer Schedule toolbar (`ganttPeriodRange`/`ganttShiftAnchor` in ReportTab.jsx, reused here). Filters on the job's Created On. **Top Customers chart**: one horizontal bar chart (customer names on the left, gridlines and a value axis) with a **By:** picker: Jobs (stacked completed green / in progress amber), Visits (Worksheets) (jobs with a worksheet green / without amber), Visit Days, Working Hours (Σ Total Working Hours on their jobs' timesheets); and a Top 10 / 15 / 20 picker. On the two split metrics, clicking a legend item (Completed, In progress, With worksheet, Without worksheet) ranks and draws only that part; clicking it again shows both. Customers with 0 on what's shown are left out; hovering shows the customer's jobs (completed / in progress), worksheets and hours. **Customer Insights table** (Grid view), one row per customer: Jobs, In Progress, Completed, Logged Worksheet (jobs with ≥ 1 worksheet ÷ jobs), Total Working Hours, Visits, Visit Days (Σ visit end − start + 1 over the jobs' worksheets, missing dates skipped), Top Problem Type (most frequent case Problem Type), Region(s), Last Job (days since their newest job's Created On). Default sort: jobs descending. Clicking a bar or row lists that customer's jobs within the active date filter (rows open Odoo) | Logged Worksheet red → green |
| Visit Analysis | Visit Analysis by Engineer table, then the Problems & Resolutions table of worksheets that have a problem **or** a resolution recorded, columns: engineer, job, problems identified, resolution applied, spare parts used. Its own Engineer filter (the worksheet's Assigned Service Engineer, else the job's Service Engineers), then Year / Month / Customer / Problem Type filters (same as the treemap's, matched on the worksheet's job: Created On, customer, Problem Type; independent of the treemap filters); "N worksheets shown" | |
| Visit Analysis by Engineer | per engineer: visits, total visit days, total hours, Spare Parts Used (the distinct spare parts on the engineer's worksheets, listed by name), main Service Type. Default sort: total days descending. Shown above Problems & Resolutions; clicking an engineer lists the jobs assigned to them (rows open the case in Odoo) | |
| &nbsp;&nbsp;Total Days | `engineerVisitStats` in derive.js (engineer = the worksheet's Assigned Service Engineer, else the job's Service Engineers). For each of the engineer's visits, Actual Visit End Date − Actual Visit Start Date + 1 (both days count, so same-day = 1 day); summed across visits that have both dates. A visit missing either date counts toward Visits but is skipped here | |
| &nbsp;&nbsp;Total Hours | `engineerHoursStats` in derive.js (engineer = the timesheet's Submitted By, else the job's Service Engineers) — a different source than Total Days: sum of Total Working Hours across the engineer's timesheets. Blank when the engineer has no timesheets | |
| Problem Types + Service Type (donuts) | **Hidden for now** (`SHOW_TYPE_DONUTS = false` in ReportTab.jsx). Jobs per case Problem Type ("Not set" when empty; top 4 + Other) ; Service Type = worksheets per Service Type (top 4 + Other), side by side | |
| Next Steps | up to 3 plain-English actions (the engineers-with-no-reports action points to the ranking table instead of listing names), most urgent first, each with a number. Each action has a **Take Action →** button that opens the jobs behind it inline (late: open > 60 days; stuck: no stage change 30+ days; never-reported engineers: a table of those engineers (same columns as the ranking table), click one to list their assigned jobs; recurring: the jobs of the top customer + problem pair), with sort, search and Excel export, same as the other drill-downs | |

Removed from the report (still available in the other tabs): hours, overtime, special dates, spare parts, service
types, visit duration, module adoption, MoM counts and "who entered the data" (unreliable: shared Odoo login).

## Worksheets

| Metric | Definition |
|---|---|
| Worksheets | count of Service Call Worksheets, and the number of distinct cases they cover |
| Problems Identified | total problem tags (m2m) across worksheets; note = worksheets with "Problems found? = Yes", and distinct problems |
| Spare Parts Used | total spare-part entries (m2m); note = worksheets with "Spare parts was used? = Yes", and distinct parts |
| Avg Visit Duration | mean of **Actual Visit End − Actual Visit Start + 1** (both days count). Worksheets missing either date are excluded and counted as "missing a date" |
| Duration buckets | 1 day / 2–3 / 4–7 / 8+ days |
| Service Type | worksheets per `x_studio_service_type` |
| Visit Dates | shortest / longest visit (days), and worksheets missing a start or end date |
| Engineer Answers | Yes / No / Blank split of "Problems found?" and "Spare parts was used?" across worksheets |
| Time Taken (Days) column | per worksheet: Actual Visit End − Actual Visit Start + 1; "n/a" when a date is missing |
| Problems & Resolutions table | worksheets with a problem tag, spare part or Resolution Applied text; columns include Problems Identified and Spare Parts Used (moved here from the worksheet records table) |

## Documents

"Documents" = **MoM (AMC), MoM Commissioning, Commissioning Certificate, Documents section**.

| Flag | Condition | Reason text |
|---|---|---|
| ⚑ **No MoM** | worksheet filled **and** no MoM (AMC) or MoM Commissioning | "N worksheet(s) filled, but no MoM (AMC) or MoM Commissioning recorded" (plus "has … only" when a certificate or file exists) |
| ⚑ **No Worksheet** | any document (MoM, certificate or file) recorded **and** no worksheet | "<document types> recorded, but no worksheet filled" |
| ✓ Attached | the case's **Attachments** field (`attachment_ids`) has at least one file: **never flagged** | — |
| ✓ OK | worksheet + at least one MoM | — |
| Not started | no worksheet and no documents | — |

A Commissioning Certificate or Documents-section file does **not** satisfy the "needs a MoM" rule, but it does
trigger the "No Worksheet" flag.

| Metric | Definition |
|---|---|
| Cases with Worksheet | cases with ≥ 1 worksheet |
| Documented | cases with a worksheet + ≥ 1 MoM |
| Worksheet · No MoM | count of ⚑ No MoM; % of cases with a worksheet |
| Docs · No Worksheet | count of ⚑ No Worksheet |
| Key Insights · Flagged Records | flagged total and share of checked cases; why (No MoM split by worksheet Service Type, No Worksheet split by document type); engineer with most flags; cases cleared by attachments |
| Flagged by Engineer | flagged cases ÷ the engineer's cases that have a worksheet or document |

## Timesheets

| Metric | Definition |
|---|---|
| Total Working Hours | Σ Total Working Hours (text field, parsed); averages per timesheet and per linked case |
| Overtime Hours | Σ Total Overtime Hours; average per timesheet |
| **Travelling Days** | per timesheet: Travel To days + Travel From days. Each leg = End − Start + 1 when both dates exist, 1 when only one date (or the single "Travel - To/From Site" date) exists, else 0. Averages per timesheet and per trip (timesheets with any travel) |
| Special Dates | count by type (Site Holiday, Casual Leave, Overtime), plus the dated list with hours |
| Time Summary | regular hours (working − overtime) vs overtime; average hours and travel days per timesheet; Σ work days (Work Start → End + 1) |
| Timesheet owner | Submitted By, else the case's Service Engineers |
| Unlinked timesheets | no case: included in the unfiltered totals, excluded when an engineer is selected |
