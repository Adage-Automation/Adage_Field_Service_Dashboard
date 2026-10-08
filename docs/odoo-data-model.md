# Odoo data model

Everything the dashboard reads, with how records link together. Verified against the schema PDFs in the
repo root and the live instance (Odoo 19, `fieldservicedashboard`) on 2026-10-07.

All reads are `search_read` through `/api/odoo` and are issued in one `Promise.all` in `App.jsx` `loadData()`.

## Relationship map

```
project.task  (is_fsm = True)  ── "case"
 ├─ x_project_task_worksheet_template_4   Service Call Worksheet   via x_studio_task_id   (NOT x_project_task_id)
 │    ├─ x_studio_problems_identified  → x_problems     (m2m)
 │    └─ x_studio_spare_parts_used     → x_spare_parts  (m2m)
 ├─ x_project_task_line_34995             MoM (AMC)                via x_project_task_id
 ├─ x_project_task_line_12c3e             MoM Commissioning        via x_project_task_id
 ├─ x_project_task_line_3517d             Commissioning Certificate via x_project_task_id
 ├─ x_project_task_line_04bec             Documents section (files) via x_project_task_id
 └─ x_project_task_line_d19f2             Timesheets               via x_project_task_id  (some rows unlinked)
      └─ x_project_task_line_d19f2_line_1c99e   Special Dates      via x_project_task_line_d19f2_id
hr.employee — names for every person field (service engineers, assigned engineer, submitted by)
```

## project.task — case

Domain: `[["is_fsm", "=", true]]`. Fields read:

| Field | Type | Used for |
|---|---|---|
| `name` | char | case title |
| `partner_id` | m2o res.partner | Customer |
| `x_studio_end_user` | m2o res.partner | End User |
| `x_studio_regions` | selection | Region filter / pill |
| `x_studio_call_type` | selection | Call Type |
| `x_studio_problem_type` | selection | Problem Type |
| **`x_studio_service_engineers`** | m2m hr.employee | **the assigned persons**: every per-engineer metric and the header filter |
| `stage_id` | m2o project.task.type | Stage (In Progress / Completed) |
| `x_studio_task_status` | selection | Task Status |
| `x_studio_created_on` (fallback `create_date`) | date | Created On |
| `x_studio_control_no`, `x_studio_scrn` | char / selection | identifiers, search |

Not used: `user_ids` and `x_studio_assigned_persons` (empty on this instance), and `worksheet_count` /
`x_studio_worksheets_count` (non-stored, so they can't be filtered on).

## x_project_task_worksheet_template_4 — Service Call Worksheet

| Field | Type | Notes |
|---|---|---|
| `x_studio_task_id` | m2o project.task | **link to the case** |
| `x_studio_service_type` | selection | AMC, CAMC, Pre-commissioning, Commissioning, Post-commissioning, Troubleshooting, Service |
| `x_studio_problems_identified` | m2m x_problems (`x_name`) | problem tags |
| `x_studio_problems_found_` | selection Yes/No | |
| `x_studio_spare_parts_used` | m2m x_spare_parts (`x_name`, `x_studio_item_description`, `x_studio_item_number`) | |
| `x_studio_spare_parts_was_used_` | selection Yes/No | |
| `x_studio_actual_visit_start_date`, `x_studio_actual_visit_end_date` | date | visit duration |
| `x_studio_assigned_service_engineer` | m2m hr.employee | worksheet owner (falls back to the case engineers) |
| `x_studio_customer_requirement` | | read for search/context |

## Documents

| Model | Label | Link | Fields read | Counts as MoM? |
|---|---|---|---|---|
| `x_project_task_line_34995` | MoM (AMC) | `x_project_task_id` | `x_name`, `x_studio_date`, `x_studio_service_engineers`, `x_studio_minutes_recorded_by` | yes |
| `x_project_task_line_12c3e` | MoM Commissioning | `x_project_task_id` | same as above | yes |
| `x_project_task_line_3517d` | Commissioning Certificate | `x_project_task_id` | `x_name`, `x_studio_date_of_commissioning` | no (document only) |
| `x_project_task_line_04bec` | Documents section | `x_project_task_id` | `x_name`, `x_studio_uploaded_by`, `x_studio_revision_number` | no (document only) |

Chatter attachments (`ir.attachment`) are **not** counted as documents, by the user's decision. But a case whose
**Attachments** field (`project.task.attachment_ids`, non-stored, readable) holds any file is never flagged.

## x_project_task_line_d19f2 — Timesheets

| Field | Type | Notes |
|---|---|---|
| `x_project_task_id` | m2o project.task | link to case (**can be empty**) |
| `x_name` | char | WORK DONE |
| `x_studio_total_working_hours`, `x_studio_total_overtime_hours` | **char** | parsed with `parseHours()` (accepts "64.0" or "8:30") |
| `x_studio_travel_to_start_date` / `_end_date`, `x_studio_travel_to_site` | date | travel to site |
| `x_studio_travel_from_start_date` / `_end_date`, `x_studio_travel_from_site` | date | travel back |
| `x_studio_work_start_date`, `x_studio_work_end_date`, `x_studio_dated` | date | |
| `x_studio_submitted_by` | m2m hr.employee | usually empty, so ownership falls back to the case engineers |
| `x_studio_plant_site`, `x_studio_plant_section` | char | search |

## x_project_task_line_d19f2_line_1c99e — Special Dates

`x_studio_type` (selection: Site Holiday / Casual Leave / Overtime), `x_studio_date`, `x_studio_hours` (int),
`x_project_task_line_d19f2_id` (m2o to the timesheet).
