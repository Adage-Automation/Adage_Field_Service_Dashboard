# Metric definitions

How every number on the dashboard is calculated. The logic lives in `src/lib/derive.js` (joins, flags) and
in each `src/views/*Tab.jsx`. The same wording appears in the UI's "?" tooltips, so keep both in sync.

**Global engineer filter.** A case belongs to an engineer when they are in its **Service Engineers**. Worksheets,
MoMs and timesheets follow their case. A child row with no case matches on its own engineer field
(worksheet Assigned Service Engineer / timesheet Submitted By).

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
| Done, No Worksheet | cases in a Completed stage with no worksheet (missing service report); % of completed cases |
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

| Item | Definition | Green / Amber / Red |
|---|---|---|
$1
| Regions → engineers treemap | Tiles are keyboard buttons (Tab, Enter); a strip under the breadcrumb shows the hovered/focused tile in full plus a 0–100% colour key; small tiles always show their %. Section heading "Regions & Engineers". Each tile also shows hours worked (timesheet Total Working Hours on its jobs), open jobs (late = open > 60 d) and service reports. **top of the page.** Filters (treemap only): Year and Month of Created On, Customer, Problem Type; "N jobs shown" counts the filtered jobs. level 1: one tile per region, size = jobs, colour = % completed (red 0% → green 100%), note = engineers in the region. Click a region → level 2: its engineers, size = their jobs in that region (a job with 2 engineers counts for each; jobs without an engineer show as "No engineer"). Click an engineer → their jobs in that region (job, customer, status, created on, days open, service report; rows open Odoo; Excel export). Breadcrumb returns to higher levels | |
| Monthly Trend · Cases Created | jobs per month of Created On (last 12 months with data), split into with / without a service report | |
| How long open jobs have been waiting | open jobs **with no service report**, by days since created: 0–30 / 31–60 / 61–90 / 90+; note = the job waiting longest (links to the case in Odoo) | |
| Visit Analysis | Start → End Duration buckets (1 / 2–3 / 4–7 / 8+ days); Visit Dates: shortest, average, longest visit (reports missing a date are left out); Service Type donut (service reports per Service Type; top 4 + Other); table of service reports that have a problem **or** a resolution recorded, columns: visit start, visit end, duration (end − start + 1), engineer, job, problems identified, resolution applied, spare parts used | |
| Recurring problems | same customer + same **Problems Identified tag** (service reports) on 2+ jobs, top 5; amber 2 jobs, red ≥ 3 | |
| Problem Types (donut) | jobs per case Problem Type ("Not set" when empty; top 4 + Other), beside Recurring problems | |
| Next Steps | up to 3 plain-English actions, most urgent first, each with a number | |

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
