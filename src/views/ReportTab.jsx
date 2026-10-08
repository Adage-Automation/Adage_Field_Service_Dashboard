import { useMemo, useState } from "react";
import { T } from "../constants/theme";
import { SERVICE_TYPE_COLORS, CHART_COLORS, colorFor } from "../constants/colors";
import { tally, engineerStats, AGE_BUCKETS, ageBucketOf } from "../lib/derive";
import { ChartRow, Panel, Pill, DataTable, MultiSelect, FilterChip, TitleCell, Txt, BarList, ColumnChart, MiniStat, InteractiveDonut, fmtNum, pct, plural } from "../components/ui";
import { SectionLabel, StagePill, YesNo, EngineerPills, caseCustomer, engineerNames, fmtDay, isoDay, openCase, odooLinkCell } from "./shared";
import { DURATION_BUCKETS, TagList } from "./WorksheetsTab";
import { odooTaskUrl } from "../lib/odoo";

// ─── Manager View ─────────────────────────────────────────────────────────────
// Plain-English view for the CSD manager: regions → engineers treemap, monthly trend and waiting jobs,
// visit analysis, recurring problems and next steps.
// Follows the header engineer filter.
// Odoo has no due dates on this instance, so "late" = job age and "stuck" = days since the last stage change.

const LATE_DAYS = 60;   // open job older than this → late (amber from 31)
const STUCK_DAYS = 30;  // no stage change for this long → stuck (amber from 15)
const AMBER = "#D97706";
const daysSince = (dt) => (dt ? Math.floor((Date.now() - Date.parse(String(dt).replace(" ", "T") + "Z")) / 86400000) : null);
const isCompleted = (c) => /complet|done/i.test(c.stage_id?.[1] || "");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS[m - 1]} '${String(y).slice(2)}`; };
const uniqSorted = (xs) => [...new Set(xs.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

// Pie charts stay readable with ≤ 5 slices: keep the top 4, fold the rest into "Other".
const topWithOther = (items, n = 4) => (items.length <= n + 1 ? items
  : [...items.slice(0, n), { key: "Other", value: items.slice(n).reduce((sum, x) => sum + x.value, 0), color: "#CBD5E1", displayKey: `Other (${items.length - n})` }]);

// Completion colour: red (0%) → amber → green (100%).
const heat = (rate, l) => `hsl(${Math.round(rate * 1.4)}, 70%, ${l}%)`;

// ─── Region → engineer treemap ────────────────────────────────────────────────
// Squarified layout (Bruls et al.) in a virtual W×H box, rendered with % positions.
const TM_W = 1300, TM_H = 420;
function squarify(items, x = 0, y = 0, w = TM_W, h = TM_H) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return [];
  const rest = [...items].sort((a, b) => b.value - a.value).map((i) => ({ ...i, area: (i.value * w * h) / total }));
  const out = [];
  while (rest.length) {
    const side = Math.min(w, h);
    const worst = (row) => {
      const sum = row.reduce((a, i) => a + i.area, 0);
      return Math.max((side * side * row[0].area) / (sum * sum), (sum * sum) / (side * side * row[row.length - 1].area));
    };
    const row = [rest.shift()];
    while (rest.length && worst([...row, rest[0]]) <= worst(row)) row.push(rest.shift());
    const thick = row.reduce((a, i) => a + i.area, 0) / side;
    let off = 0;
    row.forEach((i) => {
      const len = i.area / thick;
      out.push(w >= h ? { ...i, x, y: y + off, w: thick, h: len } : { ...i, x: x + off, y, w: len, h: thick });
      off += len;
    });
    if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
  }
  return out;
}

const tileLabel = (t) => `${t.label}: ${t.completed} of ${t.value} completed (${t.rate}%)${t.hint ? ` · ${t.hint}` : ""}`;

function Treemap({ items, selectedKey, onSelect, onPeek }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "clamp(280px, 38vw, 420px)", borderRadius: 8, overflow: "hidden", background: T.bgInput }}>
      <style>{`.tm-tile:hover { filter: brightness(0.95); } .tm-tile:focus-visible { outline: 3px solid ${T.accent}; outline-offset: -3px; z-index: 1; }`}</style>
      {squarify(items).map((t) => {
        const big = t.w > 90 && t.h > 44;
        const active = t.key === selectedKey;
        return (
          <button key={t.key} type="button" className="tm-tile" onClick={() => onSelect(t.key)} title={tileLabel(t)} aria-label={tileLabel(t)} aria-pressed={active}
            onMouseEnter={() => onPeek(t)} onMouseLeave={() => onPeek(null)} onFocus={() => onPeek(t)} onBlur={() => onPeek(null)}
            style={{ position: "absolute", left: `${(t.x / TM_W) * 100}%`, top: `${(t.y / TM_H) * 100}%`, width: `${(t.w / TM_W) * 100}%`, height: `${(t.h / TM_H) * 100}%`,
              boxSizing: "border-box", margin: 0, padding: big ? "8px 10px" : 4, background: heat(t.rate, 88), border: `2px solid ${active ? T.accent : "#fff"}`,
              cursor: "pointer", overflow: "hidden", textAlign: "left", verticalAlign: "top", display: "block", fontFamily: "inherit", transition: "filter 0.15s" }}>
            {big ? (
              <span style={{ display: "block", position: "absolute", top: 8, left: 10, right: 10 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                <span style={{ display: "block", fontSize: 18, fontWeight: 800, color: heat(t.rate, 28), marginTop: 2 }}>{t.completed}<span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}> / {t.value} completed · {t.rate}%</span></span>
                <span style={{ display: "block", fontSize: 11.5, color: T.textSecondary, marginTop: 2 }}>{t.hint}</span>
              </span>
            ) : (
              <span style={{ display: "block", position: "absolute", top: 4, left: 4, right: 4 }}>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: heat(t.rate, 28) }}>{t.rate}%</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ReportTab({ model, userMap, engineerName, lastUpdated }) {
  const { cases, worksheets } = model;
  const [tmRegion, setTmRegion] = useState(null);   // treemap drill-down: region → engineer
  const [tmEngineer, setTmEngineer] = useState(null);
  const [tmPeek, setTmPeek] = useState(null);       // tile under the mouse / keyboard focus (detail strip)
  const [fYear, setFYear] = useState([]);           // treemap filters (Created On year / month, customer, problem type)
  const [fMonth, setFMonth] = useState([]);
  const [fCustomer, setFCustomer] = useState([]);
  const [fProblem, setFProblem] = useState([]);

  const r = useMemo(() => {
    const live = cases.filter((c) => !/cancel/i.test(c.stage_id?.[1] || ""));
    const open = live.filter((c) => c.isOpen);
    const idle = (c) => daysSince(c.date_last_stage_update);

    const late = open.filter((c) => (c.ageDays ?? 0) > LATE_DAYS);
    const stuck = open.filter((c) => (idle(c) ?? 0) >= STUCK_DAYS);
    const engineers = engineerStats(live, userMap);
    const silent = engineers.filter((e) => e.assigned >= 3 && e.logged === 0).sort((a, b) => b.assigned - a.assigned);

    // Monthly trend (cases created per month, with / without a service report), last 12 months with data
    const byMonth = {};
    live.forEach((c) => {
      if (!c.createdISO) return;
      const k = c.createdISO.slice(0, 7);
      byMonth[k] = byMonth[k] || { logged: 0, unlogged: 0 };
      byMonth[k][c.hasWorksheet ? "logged" : "unlogged"] += 1;
    });
    const months = Object.keys(byMonth).sort().slice(-12).map((k) => ({
      key: k, label: monthLabel(k),
      parts: [
        { key: "logged", label: "With service report", value: byMonth[k].logged, color: T.success },
        { key: "unlogged", label: "No service report", value: byMonth[k].unlogged, color: AMBER },
      ],
    }));

    // How long open jobs (no service report yet) have been waiting, by age since created
    const backlog = open.filter((c) => !c.hasWorksheet);
    const waiting = AGE_BUCKETS.map((b) => ({ key: b.key, label: b.key, color: b.color, value: backlog.filter((c) => ageBucketOf(c.ageDays) === b.key).length }));
    const oldestWaiting = [...backlog].sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))[0];

    // V3 same customer + same problem on 2+ jobs
    const liveIds = new Set(live.map((c) => c.id));
    const jobsByPair = {};
    worksheets.forEach((w) => {
      if (!w.case || !liveIds.has(w.case.id) || !caseCustomer(w.case)) return;
      w.problems.forEach((p) => { const k = `${caseCustomer(w.case)} · ${p}`; (jobsByPair[k] = jobsByPair[k] || new Set()).add(w.case.id); });
    });
    const recurring = Object.entries(jobsByPair).map(([key, ids]) => ({ key, value: ids.size }))
      .filter((x) => x.value >= 2).sort((a, b) => b.value - a.value).slice(0, 5);

    // Plain-English actions (number + what to do), most urgent first
    const names = (list) => list.slice(0, 3).map((e) => e.name).join(", ");
    const actions = [];
    if (late.length) actions.push(`${plural(late.length, "open job")} ${late.length === 1 ? "is" : "are"} older than ${LATE_DAYS} days. Review them with the team: close the finished ones and re-plan the rest.`);
    if (stuck.length) actions.push(`${plural(stuck.length, "job")} ${stuck.length === 1 ? "hasn't" : "haven't"} changed status in over ${STUCK_DAYS} days. Check whether they're blocked or already finished.`);
    if (silent.length) actions.push(`${plural(silent.length, "engineer")} with 3+ jobs ${silent.length === 1 ? "has" : "have"} never submitted a report: ${names(silent)}. Arrange a short refresher on the mobile service report.`);
    if (recurring.length) { const [cust, prob] = recurring[0].key.split(" · "); actions.push(`${cust} has had "${prob}" ${recurring[0].value} times. Consider a root-cause visit or a maintenance contract review.`); }

    // Problem Type split across jobs (case field)
    const problemTypes = tally(live.map((c) => c.x_studio_problem_type || "Not set"))
      .map((t, i) => ({ ...t, color: t.key === "Not set" ? "#94A3B8" : CHART_COLORS[i % CHART_COLORS.length] }));

    return { live, months, waiting, oldestWaiting, recurring, problemTypes, actions };
  }, [cases, worksheets, userMap]);

  // Treemap: regions (size = jobs, colour = % completed) → engineers in that region → their jobs
  const regionOf = (c) => c.x_studio_regions || "No region";
  const yearOf = (c) => (c.createdISO || "").slice(0, 4);
  const monthOf = (c) => (c.createdISO ? MONTHS[Number(c.createdISO.slice(5, 7)) - 1] : "");
  const tmCases = r.live.filter((c) =>
    (!fYear.length || fYear.includes(yearOf(c))) && (!fMonth.length || fMonth.includes(monthOf(c))) &&
    (!fCustomer.length || fCustomer.includes(caseCustomer(c))) && (!fProblem.length || fProblem.includes(c.x_studio_problem_type)));
  const yearOptions = uniqSorted(r.live.map(yearOf)).reverse();
  const monthOptions = MONTHS.filter((m) => r.live.some((c) => monthOf(c) === m));
  const customerOptions = uniqSorted(r.live.map(caseCustomer));
  const problemOptions = uniqSorted(r.live.map((c) => c.x_studio_problem_type));
  const anyFilter = fYear.length + fMonth.length + fCustomer.length + fProblem.length > 0;
  const clearFilters = () => { setFYear([]); setFMonth([]); setFCustomer([]); setFProblem([]); };
  // Tile = jobs (size) + completion (colour) + working hours, open / late jobs and service reports.
  // A job with two engineers counts (with its hours) for each of them.
  const tile = (key, label, jobs, extra = "") => {
    const completed = jobs.filter(isCompleted).length;
    const open = jobs.filter((c) => c.isOpen);
    const late = open.filter((c) => (c.ageDays ?? 0) > LATE_DAYS).length;
    const hours = jobs.reduce((s, c) => s + c.hours, 0);
    const reports = jobs.filter((c) => c.hasWorksheet).length;
    const hint = [extra, `${fmtNum(hours, 0)} h worked`, `${open.length} open${late ? ` (${late} late)` : ""}`, plural(reports, "service report")].filter(Boolean).join(" · ");
    return { key, label, value: jobs.length, completed, rate: pct(completed, jobs.length), hint };
  };
  const tmItems = !tmRegion
    ? Object.entries(tmCases.reduce((m, c) => ((m[regionOf(c)] = m[regionOf(c)] || []).push(c), m), {}))
        .map(([k, jobs]) => tile(k, k, jobs, plural(new Set(jobs.flatMap((c) => c.engineerIds)).size, "engineer")))
    : (() => {
        const jobs = tmCases.filter((c) => regionOf(c) === tmRegion);
        const ids = [...new Set(jobs.flatMap((c) => (c.engineerIds.length ? c.engineerIds : ["none"])))];
        return ids.map((id) => tile(String(id), id === "none" ? "No engineer" : userMap[id] || `Employee #${id}`, jobs.filter((c) => (id === "none" ? !c.engineerIds.length : c.engineerIds.includes(id)))));
      })();
  const tmJobs = tmRegion && tmEngineer
    ? tmCases.filter((c) => regionOf(c) === tmRegion && (tmEngineer === "none" ? !c.engineerIds.length : c.engineerIds.includes(Number(tmEngineer))))
    : [];
  const tmEngineerName = tmItems.find((t) => t.key === tmEngineer)?.label;
  const tmSelect = (key) => (!tmRegion ? setTmRegion(key) : setTmEngineer(key === tmEngineer ? null : key));
  const crumb = (label, onClick) => <button onClick={onClick} style={{ border: "none", background: "none", padding: 0, color: T.accent, fontWeight: 600, fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>{label}</button>;
  const jobsTable = (title, rows, exportName, onClose, storageKey) => (
    <div style={{ marginBottom: 10 }}>
      <DataTable
        title={title}
        columns={jobColumns}
        rows={rows}
        storageKey={storageKey}
        searchText={(c) => [c.name, caseCustomer(c), c.stage_id?.[1], c.x_studio_problem_type].join(" ")}
        searchPlaceholder="Search jobs..."
        onRowClick={openCase}
        exportName={exportName}
        defaultSort={{ key: "age", dir: "desc" }}
        maxHeight={420}
        toolbar={<button className="no-print" onClick={onClose} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>✕ Close</button>}
      />
    </div>
  );
  const jobColumns = [
    { key: "name", label: "Job", weight: 26, render: (c) => <TitleCell title={c.name} sub={c.x_studio_problem_type || null} />, sortValue: (c) => c.name || "" },
    { key: "customer", label: "Customer", weight: 22, render: (c) => <Txt>{caseCustomer(c)}</Txt>, sortValue: caseCustomer },
    { key: "stage", label: "Status", weight: 11, render: (c) => <StagePill stage={c.stage_id?.[1]} />, sortValue: (c) => c.stage_id?.[1] || "", exportValue: (c) => c.stage_id?.[1] || "" },
    { key: "created", label: "Created On", weight: 11, render: (c) => <Txt>{fmtDay(c.createdISO)}</Txt>, sortValue: (c) => c.createdISO, exportValue: (c) => c.createdISO },
    { key: "age", label: "Days Open", weight: 9, info: "Open jobs: days since the job was created. Completed jobs show —.", render: (c) => (c.isOpen ? <Txt style={{ color: (c.ageDays ?? 0) > LATE_DAYS ? T.danger : undefined, fontWeight: 600 }}>{c.ageDays}</Txt> : <Txt>{null}</Txt>), sortValue: (c) => (c.isOpen ? c.ageDays ?? 0 : -1), exportValue: (c) => (c.isOpen ? c.ageDays : "") },
    { key: "hours", label: "Hours", weight: 7, info: "Total Working Hours from the job's timesheets.", render: (c) => (c.hours ? <span className="col-value">{fmtNum(c.hours, 1)}</span> : <Txt>{null}</Txt>), sortValue: (c) => c.hours },
    { key: "report", label: "Service Report", weight: 11, render: (c) => <YesNo yes={c.hasWorksheet} />, sortValue: (c) => (c.hasWorksheet ? 1 : 0), exportValue: (c) => (c.hasWorksheet ? "Yes" : "No") },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (c) => odooLinkCell(c.id) },
  ];

  // ── Visit analysis (service report data) ──
  const wsEngineers = (w) => (w.engineerIds.length ? w.engineerIds : w.case?.engineerIds || []);
  const durations = worksheets.map((w) => w.visitDays).filter((d) => d !== null);
  const serviceTypes = tally(worksheets.map((w) => w.x_studio_service_type || "Not set"))
    .map((t, i) => ({ ...t, color: t.key === "Not set" ? "#94A3B8" : colorFor(t.key, SERVICE_TYPE_COLORS, i) }));
  const durationItems = DURATION_BUCKETS.map((b) => ({ key: b.key, label: b.key, value: durations.filter(b.test).length, color: b.color }));
  const hasResolution = (w) => !!(w.x_studio_resolution_applied || "").trim();
  const visitRows = worksheets.filter((w) => w.problems.length || hasResolution(w)); // only reports with a problem or resolution
  const visitColumns = [
    { key: "start", label: "Visit Start", weight: 8, exportWidth: 14, render: (w) => <Txt>{fmtDay(w.x_studio_actual_visit_start_date)}</Txt>, sortValue: (w) => isoDay(w.x_studio_actual_visit_start_date) },
    { key: "end", label: "Visit End", weight: 8, exportWidth: 14, render: (w) => <Txt>{fmtDay(w.x_studio_actual_visit_end_date)}</Txt>, sortValue: (w) => isoDay(w.x_studio_actual_visit_end_date) },
    { key: "days", label: "Duration (Days)", weight: 7, info: "Visit End − Visit Start + 1 (both days count). n/a = a date is missing.",
      render: (w) => (w.visitDays !== null ? <span className="col-value">{w.visitDays}</span> : <Pill color={T.warning} bg={T.warningBg} title="Start or end date missing">n/a</Pill>),
      sortValue: (w) => w.visitDays ?? -1, exportValue: (w) => w.visitDays ?? "" },
    { key: "engineer", label: "Engineer", weight: 11, exportWidth: 28,
      render: (w) => <EngineerPills ids={wsEngineers(w)} userMap={userMap} />,
      sortValue: (w) => engineerNames(wsEngineers(w), userMap).join(", "), exportValue: (w) => engineerNames(wsEngineers(w), userMap).join(", ") },
    { key: "case", label: "Job", weight: 18, exportWidth: 40,
      render: (w) => <TitleCell title={w.case?.name || w.x_studio_task_id?.[1] || "Unlinked report"} sub={caseCustomer(w.case)} />,
      sortValue: (w) => w.case?.name || "", exportValue: (w) => w.case?.name || w.x_studio_task_id?.[1] || "" },
    { key: "problems", label: "Problems Identified", weight: 16, exportWidth: 40, info: "Problems Identified tags on the service report.",
      render: (w) => <TagList items={w.problems} color="#DC2626" />, sortValue: (w) => w.problems.length, exportValue: (w) => w.problems.join(", ") },
    { key: "resolution", label: "Resolution Applied", weight: 24, exportWidth: 70, info: "What the engineer did to fix it (Resolution Applied). Hover to read it in full.",
      render: (w) => (hasResolution(w)
        ? <span title={w.x_studio_resolution_applied} style={{ fontSize: 11.5, color: T.textSecondary, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>{w.x_studio_resolution_applied.trim()}</span>
        : <Txt style={{ color: T.textMuted }}>Not recorded</Txt>),
      sortValue: (w) => (hasResolution(w) ? 1 : 0), exportValue: (w) => (w.x_studio_resolution_applied || "").trim() },
    { key: "spares", label: "Spare Parts Used", weight: 13, exportWidth: 36, info: "Spare parts listed on the service report.",
      render: (w) => <TagList items={w.spares} color="#7C3AED" />, sortValue: (w) => w.spares.length, exportValue: (w) => w.spares.join(", ") },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (w) => odooLinkCell(w.caseId), exportWidth: 14 },
  ];

  const today = (lastUpdated || new Date()).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const empty = (text) => <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0" }}>{text}</div>;

  return (
    <div className="report">
      {/* ── Header ── */}
      <div className="card" style={{ padding: "18px 22px", marginBottom: 10, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderLeft: `4px solid ${T.accent}` }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "1.4px", textTransform: "uppercase", fontWeight: 700 }}>Field Service</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, marginTop: 2 }}>Manager View</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
            As of {today} · Scope: <strong>{engineerName || "All service engineers"}</strong>
          </div>
        </div>
      </div>

      {/* ── Treemap: regions → engineers → jobs ── */}
      <SectionLabel>Regions &amp; Engineers · Who Is Completing the Work</SectionLabel>
      <Panel grow={false} style={{ marginBottom: 10 }} title="Regions → engineers · completed vs assigned"
        info="Tile size = number of jobs; colour = share completed, red (0%) to green (100%). Click a region to see its engineers, then click an engineer to list their jobs in that region. A job with two engineers counts for each.">
        <div className="no-print" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: T.textMuted, marginBottom: 10, padding: "6px 10px", borderRadius: 8, background: T.bgInput }}>
          {crumb("All regions", () => { setTmRegion(null); setTmEngineer(null); })}
          {tmRegion && <>›{crumb(tmRegion, () => setTmEngineer(null))}</>}
          {tmEngineerName && <>›<span style={{ color: T.textPrimary, fontWeight: 600 }}>{tmEngineerName}</span></>}
        </div>
        {(() => {
          const shown = tmPeek || tmItems.find((t) => t.key === tmEngineer);
          return (
            <div aria-live="polite" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10, fontSize: 12, color: T.textSecondary }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                0% completed
                <span aria-hidden="true" style={{ width: 110, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${heat(0, 55)}, ${heat(50, 55)}, ${heat(100, 45)})` }} />
                100%
              </span>
              <span style={{ flex: 1, minWidth: 240, padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard }}>
                {shown ? <><strong style={{ color: T.textPrimary }}>{shown.label}</strong>: {shown.completed} of {shown.value} completed ({shown.rate}%) · {shown.hint}</>
                  : !tmRegion ? "Hover or tab to a region for details; click or press Enter to see its engineers."
                  : "Hover or tab to an engineer for details; click or press Enter to list their jobs."}
              </span>
            </div>
          );
        })()}
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <MultiSelect label="Year" options={yearOptions} selected={fYear} onChange={setFYear} />
          <MultiSelect label="Month" options={monthOptions} selected={fMonth} onChange={setFMonth} />
          <MultiSelect label="Customer" options={customerOptions} selected={fCustomer} onChange={setFCustomer} searchable searchPlaceholder="Search customer..." />
          <MultiSelect label="Problem Type" options={problemOptions} selected={fProblem} onChange={setFProblem} searchable searchPlaceholder="Search problem..." />
          <span style={{ fontSize: 11.5, color: T.textMuted }}>{plural(tmCases.length, "job")} shown</span>
        </div>
        {anyFilter && (
          <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {fYear.length > 0 && <FilterChip label={`Year: ${fYear.join(", ")}`} onClear={() => setFYear([])} />}
            {fMonth.length > 0 && <FilterChip label={`Month: ${fMonth.join(", ")}`} onClear={() => setFMonth([])} />}
            {fCustomer.length > 0 && <FilterChip label={`Customer: ${fCustomer.join(", ")}`} onClear={() => setFCustomer([])} />}
            {fProblem.length > 0 && <FilterChip label={`Problem: ${fProblem.join(", ")}`} onClear={() => setFProblem([])} />}
            <button onClick={clearFilters} style={{ padding: "3px 10px", borderRadius: 100, border: `1px solid ${T.border}`, background: "none", color: T.textMuted, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>Clear all ✕</button>
          </div>
        )}
        {tmItems.length ? <Treemap items={tmItems} selectedKey={tmEngineer} onSelect={(k) => { setTmPeek(null); tmSelect(k); }} onPeek={setTmPeek} /> : empty("No jobs match these filters")}
      </Panel>
      {tmJobs.length > 0 && jobsTable(`${tmEngineerName} · ${tmRegion} · ${plural(tmJobs.length, "job")} (${tmJobs.filter(isCompleted).length} completed)`, tmJobs, `field-service-jobs-${tmRegion}-${tmEngineerName}`, () => setTmEngineer(null), "adage_fsm_report_engineer_jobs_cols_v2")}

      {/* ── Trends ── */}
      <ChartRow columns="minmax(0, 1.4fr) minmax(0, 1fr)">
        <Panel title="Monthly Trend · Cases Created" info="Jobs created per month (Created On), split into those with a service report and those without. Last 12 months with data.">
          <ColumnChart columns={r.months} height={200} legend={[{ label: "With service report", color: T.success }, { label: "No service report", color: AMBER }]} />
        </Panel>
        <Panel title="How long open jobs have been waiting" info="Open jobs with no service report yet, grouped by days since they were created. Older = waiting longer.">
          <BarList items={r.waiting} formatValue={(v) => plural(v, "job")} />
          {r.oldestWaiting && (
            <div style={{ marginTop: 14, padding: "8px 10px", borderRadius: 8, background: T.bgCardAlt, border: `1px solid ${T.border}`, fontSize: 11, color: T.textSecondary, lineHeight: 1.45 }}>
              Waiting longest: <a href={odooTaskUrl(r.oldestWaiting.id)} target="_blank" rel="noopener noreferrer" title="Open in Odoo" style={{ color: T.accent, fontWeight: 700, textDecoration: "none" }}>{r.oldestWaiting.name} ↗</a>
              {" · "}{r.oldestWaiting.ageDays} days · {engineerNames(r.oldestWaiting.engineerIds, userMap).join(", ") || "no engineer"}
            </div>
          )}
        </Panel>
      </ChartRow>

      {/* ── Visit analysis ── */}
      <SectionLabel>Visit Analysis</SectionLabel>
      <ChartRow columns="minmax(0, 1.3fr) minmax(0, 0.7fr) minmax(0, 1fr)">
        <Panel title="Start → End Duration" info="Service reports grouped by how many days the visit lasted (Actual Visit Start → End, counting both days).">
          <BarList items={durationItems} formatValue={(v) => plural(v, "visit")} />
        </Panel>
        <Panel title="Visit Dates" info="From Actual Visit Start / End Date on each service report (end − start + 1). Reports missing either date are left out.">
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10, height: "100%" }}>
            <MiniStat label="Shortest visit" value={durations.length ? `${Math.min(...durations)} d` : "—"} color={T.success} />
            <MiniStat label="Average visit" value={durations.length ? `${fmtNum(durations.reduce((a, b) => a + b, 0) / durations.length, 1)} d` : "—"} color={T.accent} sub={`across ${plural(durations.length, "visit")}`} />
            <MiniStat label="Longest visit" value={durations.length ? `${Math.max(...durations)} d` : "—"} color={T.danger} />
          </div>
        </Panel>
        <InteractiveDonut title="Service Type" infoText="Service Type picked on each service report." centerLabel="reports" unit="reports" segments={topWithOther(serviceTypes)} />
      </ChartRow>
      <div style={{ marginBottom: 10 }}>
        <DataTable
          title="Problems, Resolutions & Visit Duration"
          columns={visitColumns}
          rows={visitRows}
          storageKey="adage_fsm_report_visits_cols_v2"
          searchText={(w) => [w.case?.name, caseCustomer(w.case), ...w.problems, ...w.spares, w.x_studio_resolution_applied, engineerNames(wsEngineers(w), userMap).join(" ")].join(" ")}
          searchPlaceholder="Search problems, resolutions..."
          onRowClick={(w) => openCase(w.case || { id: w.caseId })}
          exportName="field-service-visit-analysis"
          defaultSort={{ key: "start", dir: "desc" }}
          maxHeight={420}
          emptyText="No service report has a problem or resolution recorded."
        />
      </div>

      {/* ── Recurring problems & actions ── */}
      <SectionLabel>Recurring Problems &amp; Next Steps</SectionLabel>
      <ChartRow columns="minmax(0, 1fr) minmax(0, 1fr)">
        <Panel title="Recurring problems" info="The same customer with the same Problems Identified tag on the service reports of 2 or more jobs.">
          {r.recurring.length === 0 ? empty("No customer has the same problem twice") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {r.recurring.map((x) => {
                const [cust, prob] = x.key.split(" · ");
                return (
                  <div key={x.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cust}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{prob}</div>
                    </div>
                    <Pill color={x.value >= 3 ? T.danger : AMBER} bg={x.value >= 3 ? T.dangerBg : T.warningBg}>{x.value} jobs</Pill>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <InteractiveDonut title="Problem Types" infoText="Jobs per Problem Type (the job's Problem Type field)." centerLabel="jobs" unit="jobs" segments={topWithOther(r.problemTypes)} />
      </ChartRow>
      {/* ── Next steps ── */}
      <div className="card report-avoid-break" style={{ padding: "14px 18px", marginBottom: 10, background: T.accentBg, border: `1px solid ${T.accentBdr}` }}>
        <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Next Steps</div>
        {r.actions.length === 0 ? <div style={{ fontSize: 13, color: T.textPrimary }}>Nothing needs action right now.</div> : (
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {r.actions.slice(0, 3).map((t, i) => <li key={i} style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}>{t}</li>)}
          </ol>
        )}
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, margin: "4px 2px 0", lineHeight: 1.5 }}>
        Odoo has no due dates for these jobs, so "late" means older than {LATE_DAYS} days. Most records are entered under one shared Odoo login, so "who entered it" isn't shown.
        Detail lives in the Overview, Worksheets, Documents and Timesheets tabs.
      </div>
    </div>
  );
}
