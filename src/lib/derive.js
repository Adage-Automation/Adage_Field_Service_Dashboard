// ─── Pure data shaping for the Field Service dashboard ───────────────────────
// Joins the raw Odoo reads (FSM tasks + Studio child models) into one model that
// every tab reads from. Odoo's own counters (worksheet_count, x_studio_worksheets_count)
// are non-stored computed fields, so all counts are derived here from the child rows.

const m2oId = (v) => (Array.isArray(v) ? v[0] : typeof v === "number" ? v : null);
const ids = (v) => (Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? x[0] : typeof x === "object" && x ? x.id : x)).filter((x) => Number.isFinite(x)) : []);

// "YYYY-MM-DD" → UTC day number (avoids timezone drift on date-only fields)
const dayNum = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).split(/[T ]/)[0].split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d) / 86400000;
};

/** Inclusive day span between two date strings, or null when either is missing / reversed. */
const daySpan = (start, end) => {
  const a = dayNum(start), b = dayNum(end);
  if (a === null || b === null || b < a) return null;
  return b - a + 1;
};

/** Studio stores timesheet hours as text ("64.0", sometimes "8:30"). */
const parseHours = (v) => {
  if (v === null || v === undefined || v === false || v === "") return 0;
  const s = String(v).trim();
  const hm = /^(\d+):(\d{1,2})$/.exec(s);
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// One travel leg: a start→end range counts every day in it; a single date (start, end,
// or the "Travel - To/From Site" day) counts as one day; nothing filled counts as zero.
const legDays = (start, end, single) => {
  const span = daySpan(start, end);
  if (span !== null) return span;
  return start || end || single ? 1 : 0;
};

// Document types that count as "documents" on a case (the user's definition). The MoM types also
// satisfy the "worksheet needs a MoM" check; certificates / uploaded files only count as paperwork.
const DOC_TYPES = [
  { key: "momAmc", label: "MoM (AMC)", isMom: true },
  { key: "momComm", label: "MoM Commissioning", isMom: true },
  { key: "certs", label: "Commissioning Certificate", isMom: false },
  { key: "docSection", label: "Documents section", isMom: false },
];

export const FLAG = {
  NO_MOM: "no_mom",             // worksheet filled, no MoM
  NO_WORKSHEET: "no_worksheet", // MoM / other document recorded, no worksheet
};

export function buildModel({ tasks, worksheets, timesheets, specialDates, momAmc, momComm, certs, docSection, problems, spares }) {
  const problemName = Object.fromEntries((problems || []).map((p) => [p.id, p.x_name || `Problem #${p.id}`]));
  const spareName = Object.fromEntries((spares || []).map((s) => [s.id, s.x_name || s.x_studio_item_description || s.x_studio_item_number || `Part #${s.id}`]));

  const cases = (tasks || []).map((t) => ({
    ...t,
    engineerIds: ids(t.x_studio_service_engineers),
    worksheets: [],
    momAmc: [],
    momComm: [],
    certs: [],
    docSection: [],
    timesheets: [],
  }));
  const caseById = Object.fromEntries(cases.map((c) => [c.id, c]));

  // Worksheets link via x_studio_task_id (x_project_task_id is always empty on this instance).
  const ws = (worksheets || []).map((w) => {
    const caseId = m2oId(w.x_studio_task_id);
    const problemIds = ids(w.x_studio_problems_identified);
    const spareIds = ids(w.x_studio_spare_parts_used);
    const row = {
      ...w,
      caseId,
      case: caseById[caseId] || null,
      engineerIds: ids(w.x_studio_assigned_service_engineer),
      problems: problemIds.map((id) => problemName[id] || `Problem #${id}`),
      spares: spareIds.map((id) => spareName[id] || `Part #${id}`),
      visitDays: daySpan(w.x_studio_actual_visit_start_date, w.x_studio_actual_visit_end_date),
    };
    if (row.case) row.case.worksheets.push(row);
    return row;
  });

  const linkMom = (rows, key) => (rows || []).map((r) => {
    const caseId = m2oId(r.x_project_task_id);
    const row = { ...r, caseId, case: caseById[caseId] || null, engineerIds: ids(r.x_studio_service_engineers) };
    if (row.case) row.case[key].push(row);
    return row;
  });
  const amc = linkMom(momAmc, "momAmc");
  const comm = linkMom(momComm, "momComm");
  const certRows = linkMom(certs, "certs");
  const docRows = linkMom(docSection, "docSection");

  const ts = (timesheets || []).map((t) => {
    const caseId = m2oId(t.x_project_task_id);
    const travelTo = legDays(t.x_studio_travel_to_start_date, t.x_studio_travel_to_end_date, t.x_studio_travel_to_site);
    const travelFrom = legDays(t.x_studio_travel_from_start_date, t.x_studio_travel_from_end_date, t.x_studio_travel_from_site);
    const row = {
      ...t,
      caseId,
      case: caseById[caseId] || null,
      engineerIds: ids(t.x_studio_submitted_by),
      hours: parseHours(t.x_studio_total_working_hours),
      overtime: parseHours(t.x_studio_total_overtime_hours),
      travelTo,
      travelFrom,
      travelDays: travelTo + travelFrom,
      workDays: daySpan(t.x_studio_work_start_date, t.x_studio_work_end_date),
      specials: [],
    };
    if (row.case) row.case.timesheets.push(row);
    return row;
  });
  const tsById = Object.fromEntries(ts.map((t) => [t.id, t]));

  const specials = (specialDates || []).map((s) => {
    const sheet = tsById[m2oId(s.x_project_task_line_d19f2_id)] || null;
    const row = { ...s, timesheet: sheet, case: sheet?.case || null };
    if (sheet) sheet.specials.push(row);
    return row;
  });

  const now = new Date();
  const todayNum = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
  cases.forEach((c) => {
    c.hasWorksheet = c.worksheets.length > 0;
    c.hasMom = c.momAmc.length + c.momComm.length > 0;
    c.docTypes = DOC_TYPES.filter((d) => c[d.key].length > 0).map((d) => d.label);
    c.docCount = DOC_TYPES.reduce((n, d) => n + c[d.key].length, 0);
    c.hasAnyDoc = c.docCount > 0;
    c.attachedFiles = (c.attachment_ids || []).length; // task "Attachments" field
    if (c.attachedFiles) {
      c.flag = null; // files attached on the case count as its paperwork: never flagged
      c.flagReason = "";
    } else if (c.hasWorksheet && !c.hasMom) {
      c.flag = FLAG.NO_MOM;
      c.flagReason = `${c.worksheets.length} worksheet${c.worksheets.length === 1 ? "" : "s"} filled, but no MoM (AMC) or MoM Commissioning recorded`
        + (c.hasAnyDoc ? ` (has ${c.docTypes.join(", ")} only)` : "");
    } else if (!c.hasWorksheet && c.hasAnyDoc) {
      c.flag = FLAG.NO_WORKSHEET;
      c.flagReason = `${c.docTypes.join(", ")} recorded, but no worksheet filled`;
    } else {
      c.flag = null;
      c.flagReason = "";
    }
    c.flagged = !!c.flag;
    c.hours = c.timesheets.reduce((s, t) => s + t.hours, 0);
    // Business-insight helpers
    c.createdISO = String(c.x_studio_created_on || c.create_date || "").split(/[T ]/)[0];
    c.ageDays = c.createdISO ? Math.max(0, Math.floor(todayNum - dayNum(c.createdISO))) : null;
    c.isOpen = !/complet|done|cancel/i.test(c.stage_id?.[1] || "");
    c.backlog = c.isOpen && !c.hasWorksheet; // open case nobody has logged yet
    c.attachments = Number(c.message_attachment_count) || 0;
    c.hasTimesheet = c.timesheets.length > 0;
    c.momTypes = [c.momAmc.length && "AMC", c.momComm.length && "Commissioning"].filter(Boolean);
    // Marked complete but nothing to show for it: no files (chatter attachments or Documents section),
    // no MoM and no timesheet. A worksheet alone doesn't count as evidence here, by the user's definition.
    c.completedNoEvidence = !c.isOpen && c.attachments === 0 && c.docSection.length === 0 && !c.hasMom && !c.hasTimesheet;
    c.projectName = c.project_id?.[1] || "No project";
    c.lastLoggedISO = c.worksheets.map((w) => String(w.create_date || "").split(/[T ]/)[0]).filter(Boolean).sort().pop() || "";
  });

  return { cases, worksheets: ws, momAmc: amc, momComm: comm, certs: certRows, docSection: docRows, timesheets: ts, specials };
}

/**
 * Narrow the model to one service engineer. A case belongs to an engineer when they are
 * in its Service Engineers; child rows follow their case, or match on their own engineer
 * field (worksheet "Assigned Service Engineer", timesheet "Submitted By") when unlinked.
 */
export function filterModel(model, engineerId) {
  if (!engineerId) return model;
  const has = (row) => row.engineerIds?.includes(engineerId);
  const caseIds = new Set(model.cases.filter(has).map((c) => c.id));
  const follows = (row) => (row.case ? caseIds.has(row.caseId) : has(row));
  const timesheets = model.timesheets.filter(follows);
  const tsIds = new Set(timesheets.map((t) => t.id));
  return {
    cases: model.cases.filter((c) => caseIds.has(c.id)),
    worksheets: model.worksheets.filter(follows),
    momAmc: model.momAmc.filter(follows),
    momComm: model.momComm.filter(follows),
    certs: model.certs.filter(follows),
    docSection: model.docSection.filter(follows),
    timesheets,
    specials: model.specials.filter((s) => s.timesheet && tsIds.has(s.timesheet.id)),
  };
}

/** Per-engineer workload & logging stats over the given cases (Service Engineers field). */
export function engineerStats(cases, userMap) {
  const m = {};
  cases.forEach((c) => c.engineerIds.forEach((id) => {
    if (!m[id]) m[id] = { id, name: userMap[id] || `Employee #${id}`, assigned: 0, open: 0, completed: 0, logged: 0, backlog: 0, completedUnlogged: 0, flagged: 0, worksheets: 0, hours: 0, lastLogged: "", oldestBacklog: null };
    const p = m[id];
    p.assigned += 1;
    if (c.isOpen) p.open += 1; else p.completed += 1;
    if (c.hasWorksheet) p.logged += 1;
    if (c.backlog) { p.backlog += 1; p.oldestBacklog = Math.max(p.oldestBacklog ?? 0, c.ageDays ?? 0); }
    if (!c.isOpen && !c.hasWorksheet) p.completedUnlogged += 1;
    if (c.flagged) p.flagged += 1;
    p.worksheets += c.worksheets.length;
    p.hours += c.hours;
    if (c.lastLoggedISO > p.lastLogged) p.lastLogged = c.lastLoggedISO;
  }));
  return Object.values(m).map((p) => ({ ...p, rate: p.assigned ? p.logged / p.assigned : 0, lastLoggedDays: daysAgo(p.lastLogged) }));
}

/** Engineers on a worksheet: its Assigned Service Engineer, else the case's Service Engineers. */
export const wsEngineerIds = (w) => (w.engineerIds.length ? w.engineerIds : w.case?.engineerIds || []);

/**
 * Per-engineer visit stats over the given worksheets: visits, avg / min / max visit days (worksheets missing a
 * date are left out of the day stats), visits with problems identified, the distinct spare parts used and most
 * common service type.
 */
export function engineerVisitStats(worksheets, userMap) {
  const m = {};
  worksheets.forEach((w) => wsEngineerIds(w).forEach((id) => {
    if (!m[id]) m[id] = { id, name: userMap[id] || `Employee #${id}`, visits: 0, days: [], withProblems: 0, spares: new Set(), types: {} };
    const p = m[id];
    p.visits += 1;
    if (w.visitDays !== null) p.days.push(w.visitDays);
    if (w.problems.length) p.withProblems += 1;
    w.spares.forEach((s) => p.spares.add(s));
    const t = w.x_studio_service_type || "Not set";
    p.types[t] = (p.types[t] || 0) + 1;
  }));
  return Object.values(m).map(({ days, types, spares, ...p }) => ({
    ...p,
    spareParts: [...spares].sort(),
    measured: days.length,
    avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
    minDays: days.length ? Math.min(...days) : null,
    maxDays: days.length ? Math.max(...days) : null,
    problemRate: p.visits ? Math.round((p.withProblems / p.visits) * 100) : 0,
    topServiceType: Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0] || "Not set",
  }));
}

/** Engineers on a timesheet: its Submitted By, else the case's Service Engineers. */
export const tsEngineerIds = (t) => (t.engineerIds.length ? t.engineerIds : t.case?.engineerIds || []);

/**
 * Per-engineer average hours per timesheet entry: Total Working Hours summed across the engineer's
 * timesheets, divided by how many timesheets they have (not by visit count — one visit can have several
 * timesheet entries, e.g. one per day worked).
 */
export function engineerHoursStats(timesheets) {
  const m = {};
  timesheets.forEach((t) => tsEngineerIds(t).forEach((id) => {
    if (!m[id]) m[id] = { id, timesheets: 0, totalHours: 0 };
    m[id].timesheets += 1;
    m[id].totalHours += t.hours;
  }));
  return Object.values(m).map((p) => ({ ...p, avgHours: p.timesheets ? p.totalHours / p.timesheets : null }));
}

/** Days between an ISO date and today (null when missing). */
const daysAgo = (iso) => {
  const d = dayNum(iso);
  if (d === null) return null;
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000 - d);
};

/** Age buckets for the unlogged backlog. */
export const AGE_BUCKETS = [
  { key: "0–30 days", min: 0, max: 30, color: "#059669" },
  { key: "31–60 days", min: 31, max: 60, color: "#D97706" },
  { key: "61–90 days", min: 61, max: 90, color: "#EA580C" },
  { key: "90+ days", min: 91, max: Infinity, color: "#DC2626" },
];
export const ageBucketOf = (days) => (days === null ? null : AGE_BUCKETS.find((b) => days >= b.min && days <= b.max)?.key || null);

/** Count occurrences of string keys → [{ key, value }] sorted desc. */
export const tally = (keys) => {
  const m = {};
  keys.forEach((k) => { if (k) m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
};
