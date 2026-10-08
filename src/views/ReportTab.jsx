import { useMemo, useState } from "react";
import { T } from "../constants/theme";
import { SERVICE_TYPE_COLORS, CHART_COLORS, colorFor } from "../constants/colors";
import { tally, engineerStats, engineerVisitStats, wsEngineerIds, AGE_BUCKETS, ageBucketOf } from "../lib/derive";
import { ChartRow, Panel, Pill, DataTable, MultiSelect, FilterChip, TitleCell, Txt, BarList, InteractiveDonut, fmtNum, pct, plural } from "../components/ui";
import { SectionLabel, StagePill, YesNo, EngineerPills, caseCustomer, engineerNames, fmtDay, openCase, odooLinkCell } from "./shared";
import { TagList } from "./WorksheetsTab";
import { odooTaskUrl, odooEmployeeUrl } from "../lib/odoo";

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

// % badge on the same red (0%) → green (100%) scale as the treemap.
function HeatPct({ value }) {
  return <span style={{ display: "inline-block", minWidth: 38, textAlign: "center", fontSize: 11.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: heat(value, 90), color: heat(value, 28) }}>{value}%</span>;
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

// ─── Monthly trend: with vs without worksheet, side by side ───────────────────
const WITH_WS = T.success, WITHOUT_WS = AMBER;

function MonthlyBars({ months, activeKey, onPick, height = 190 }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...months.map((m) => Math.max(m.logged, m.unlogged)));
  const focus = months.find((m) => m.key === (hover || activeKey));
  const bar = (value, color) => (
    <div style={{ flex: 1, maxWidth: 22, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 2 }}>{value}</span>
      <div style={{ width: "100%", height: `${(value / max) * 82}%`, minHeight: value ? 3 : 0, background: color, borderRadius: "3px 3px 0 0", transition: "height 0.4s ease" }} />
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 11.5, color: T.textSecondary }}>
        {[["With worksheet", WITH_WS], ["Without worksheet", WITHOUT_WS]].map(([l, c]) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />{l}</span>
        ))}
        <span aria-live="polite" style={{ marginLeft: "auto", color: T.textPrimary }}>
          {focus
            ? <><strong>{focus.label}</strong>: {plural(focus.logged + focus.unlogged, "job")} · <span style={{ color: WITH_WS, fontWeight: 700 }}>{focus.logged} with</span> · <span style={{ color: WITHOUT_WS, fontWeight: 700 }}>{focus.unlogged} without</span> ({pct(focus.logged, focus.logged + focus.unlogged)}% with a worksheet)</>
            : <span style={{ color: T.textMuted }}>Hover a month for details; click to list its jobs.</span>}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height, borderBottom: `1px solid ${T.border}` }}>
        {months.map((m) => {
          const dim = (hover || activeKey) && (hover || activeKey) !== m.key;
          return (
            <button key={m.key} type="button" onClick={() => onPick(m.key)} onMouseEnter={() => setHover(m.key)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(m.key)} onBlur={() => setHover(null)} aria-pressed={activeKey === m.key}
              aria-label={`${m.label}: ${m.logged} with worksheet, ${m.unlogged} without`}
              style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, padding: "0 2px", border: "none",
                borderRadius: 6, background: activeKey === m.key ? T.accentBg : "transparent", cursor: "pointer", opacity: dim ? 0.45 : 1, transition: "opacity 0.15s", fontFamily: "inherit" }}>
              {bar(m.logged, WITH_WS)}
              {bar(m.unlogged, WITHOUT_WS)}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
        {months.map((m) => (
          <div key={m.key} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 11, fontWeight: activeKey === m.key ? 700 : 500, color: activeKey === m.key ? T.accent : T.textMuted, whiteSpace: "nowrap" }}>{m.label}</div>
        ))}
      </div>
    </div>
  );
}

export function ReportTab({ model, userMap }) {
  const { cases, worksheets } = model;
  const [tmRegion, setTmRegion] = useState(null);   // treemap drill-down: region → engineer
  const [tmEngineer, setTmEngineer] = useState(null);
  const [tmPeek, setTmPeek] = useState(null);       // tile under the mouse / keyboard focus (detail strip)
  const [fYear, setFYear] = useState([]);           // treemap filters (Created On year / month, customer, problem type)
  const [fMonth, setFMonth] = useState([]);
  const [fCustomer, setFCustomer] = useState([]);
  const [fProblem, setFProblem] = useState([]);
  const [waitBucket, setWaitBucket] = useState(null);  // clicked age band in "How long open jobs have been waiting"
  const [trendMonth, setTrendMonth] = useState(null);   // clicked month in the monthly trend ("YYYY-MM")
  const [rankEngineer, setRankEngineer] = useState(null); // clicked row in Engineer Ranking & Workload (employee id)
  const [visitEngineer, setVisitEngineer] = useState(null); // clicked row in Visit Analysis by Engineer (employee id)
  const [expandedAction, setExpandedAction] = useState(null); // Next Steps bullet whose job list is open
  const [actionEngineer, setActionEngineer] = useState(null);  // engineer picked inside the "never reported" action

  const r = useMemo(() => {
    const live = cases.filter((c) => !/cancel/i.test(c.stage_id?.[1] || ""));
    const open = live.filter((c) => c.isOpen);
    const idle = (c) => daysSince(c.date_last_stage_update);

    const late = open.filter((c) => (c.ageDays ?? 0) > LATE_DAYS);
    const stuck = open.filter((c) => (idle(c) ?? 0) >= STUCK_DAYS);
    const engineers = engineerStats(live, userMap);
    const silent = engineers.filter((e) => e.assigned >= 3 && e.logged === 0).sort((a, b) => b.assigned - a.assigned);
    const silentIds = new Set(silent.map((e) => e.id));

    // Monthly trend (cases created per month, with / without a service report), last 12 months with data
    const byMonth = {};
    live.forEach((c) => {
      if (!c.createdISO) return;
      const k = c.createdISO.slice(0, 7);
      byMonth[k] = byMonth[k] || { logged: 0, unlogged: 0 };
      byMonth[k][c.hasWorksheet ? "logged" : "unlogged"] += 1;
    });
    const months = Object.keys(byMonth).sort().slice(-12).map((k) => ({ key: k, label: monthLabel(k), ...byMonth[k] }));

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
    const recurring = Object.entries(jobsByPair).map(([key, ids]) => ({ key, value: ids.size, ids }))
      .filter((x) => x.value >= 2).sort((a, b) => b.value - a.value).slice(0, 5);

    // Plain-English actions (number + what to do), most urgent first; each carries the jobs behind it
    const actions = [];
    if (late.length) actions.push({ id: "late", rows: late, text: `${plural(late.length, "open job")} ${late.length === 1 ? "is" : "are"} older than ${LATE_DAYS} days. Review them with the team: close the finished ones and re-plan the rest.` });
    if (stuck.length) actions.push({ id: "stuck", rows: stuck, text: `${plural(stuck.length, "job")} ${stuck.length === 1 ? "hasn't" : "haven't"} changed status in over ${STUCK_DAYS} days. Check whether they're blocked or already finished.` });
    if (silent.length) {
      const silentJobs = live.filter((c) => c.engineerIds.some((id) => silentIds.has(id)));
      actions.push({ id: "silent", rows: silentJobs, engineers: silent,
        text: `${plural(silent.length, "engineer")} ${silent.length === 1 ? "has" : "have"} 3 or more jobs but ${silent.length === 1 ? "has" : "have"} never submitted a service report (${plural(silentJobs.length, "job")} between them). Arrange a short refresher on the mobile service report.` });
    }
    if (recurring.length) { const [cust, prob] = recurring[0].key.split(" · "); actions.push({ id: "recurring", rows: live.filter((c) => recurring[0].ids.has(c.id)), text: `${cust} has had "${prob}" ${recurring[0].value} times. Consider a root-cause visit or a maintenance contract review.` }); }

    // Problem Type split across jobs (case field)
    const problemTypes = tally(live.map((c) => c.x_studio_problem_type || "Not set"))
      .map((t, i) => ({ ...t, color: t.key === "Not set" ? "#94A3B8" : CHART_COLORS[i % CHART_COLORS.length] }));

    return { live, engineers, backlog, months, waiting, oldestWaiting, recurring, problemTypes, actions };
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

  // ── Engineer ranking & workload ──
  // Report rate = service reports logged ÷ jobs assigned (lifetime); worst first by default.
  const engineerColumns = [
    { key: "name", label: "Engineer", weight: 18, exportWidth: 30, render: (e) => <TitleCell title={e.name} />, sortValue: (e) => e.name, exportValue: (e) => e.name },
    { key: "assigned", label: "Assigned", weight: 7, info: "All jobs ever assigned to the engineer (Service Engineers field): their total workload.",
      render: (e) => <span className="col-value">{e.assigned}</span>, sortValue: (e) => e.assigned },
    { key: "open", label: "Open", weight: 6, info: "Jobs not yet completed or cancelled: the engineer's workload right now.",
      render: (e) => <Txt>{e.open}</Txt>, sortValue: (e) => e.open },
    { key: "completed", label: "Completed", weight: 7, info: "Assigned jobs in a Completed stage.", render: (e) => <Txt>{e.completed}</Txt>, sortValue: (e) => e.completed },
    { key: "rate", label: "Reports · Rate", weight: 14, exportWidth: 16,
      info: "Service reports logged (jobs with at least one worksheet) and report rate = logged ÷ assigned. Colour runs red (0%) → amber → green (100%).",
      render: (e) => {
        const p = pct(e.logged, e.assigned);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, color: T.textSecondary, whiteSpace: "nowrap" }}>{e.logged}/{e.assigned}</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.bgInput, overflow: "hidden" }}>
              <div style={{ width: `${p}%`, height: "100%", background: heat(p, 45) }} />
            </div>
            <HeatPct value={p} />
          </div>
        );
      },
      sortValue: (e) => e.rate, exportValue: (e) => `${e.logged} of ${e.assigned} (${pct(e.logged, e.assigned)}%)` },
    { key: "backlog", label: "Backlog", weight: 7, info: "Open jobs with no service report yet.",
      render: (e) => (e.backlog ? <Pill color={T.warning} bg={T.warningBg}>{e.backlog}</Pill> : <Txt>{0}</Txt>), sortValue: (e) => e.backlog, exportValue: (e) => e.backlog },
    { key: "flagged", label: "Flagged", weight: 6, info: "Jobs with a paperwork mismatch (worksheet without MoM, or MoM / document without worksheet).",
      render: (e) => (e.flagged ? <Pill color={T.danger} bg={T.dangerBg}>{e.flagged}</Pill> : <Txt>{0}</Txt>), sortValue: (e) => e.flagged, exportValue: (e) => e.flagged },
    { key: "hours", label: "Hours", weight: 6, info: "Total Working Hours from the timesheets on the engineer's jobs (a job with two engineers counts for each).",
      render: (e) => (e.hours ? <span className="col-value">{fmtNum(e.hours, 0)}</span> : <Txt>{null}</Txt>), sortValue: (e) => e.hours, exportValue: (e) => Math.round(e.hours) },
    { key: "last", label: "Last Report", weight: 9, exportWidth: 16, info: `Days since the engineer's most recent service report was created. Red when never, or more than ${STUCK_DAYS} days ago.`,
      render: (e) => (e.lastLoggedDays === null
        ? <span style={{ fontSize: 11.5, fontWeight: 700, color: T.danger }}>Never</span>
        : <span style={{ fontSize: 11.5, fontWeight: e.lastLoggedDays > STUCK_DAYS ? 700 : 500, color: e.lastLoggedDays > STUCK_DAYS ? T.danger : T.textSecondary }}>{e.lastLoggedDays}d ago</span>),
      sortValue: (e) => e.lastLoggedDays ?? Infinity, exportValue: (e) => (e.lastLoggedDays === null ? "Never" : e.lastLoggedDays) },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportWidth: 14, exportValue: (e) => ({ text: "Open in Odoo", hyperlink: odooEmployeeUrl(e.id) }) },
  ];

  // ── Visit analysis (service report data) ──
  const wsEngineers = wsEngineerIds;
  const serviceTypes = tally(worksheets.map((w) => w.x_studio_service_type || "Not set"))
    .map((t, i) => ({ ...t, color: t.key === "Not set" ? "#94A3B8" : colorFor(t.key, SERVICE_TYPE_COLORS, i) }));
  const hasResolution = (w) => !!(w.x_studio_resolution_applied || "").trim();
  const visitRows = worksheets.filter((w) => w.problems.length || hasResolution(w)); // only reports with a problem or resolution
  const visitColumns = [
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
  // Per-engineer visit stats: slowest average visit first
  const visitByEngineer = engineerVisitStats(worksheets, userMap);
  const dayCell = (v) => (v === null ? <Txt>{null}</Txt> : <span className="col-value">{Number.isInteger(v) ? v : fmtNum(v, 1)}</span>);
  const visitEngineerColumns = [
    { key: "name", label: "Engineer", weight: 18, exportWidth: 30, render: (e) => <TitleCell title={e.name} />, sortValue: (e) => e.name, exportValue: (e) => e.name },
    { key: "visits", label: "Visits", weight: 6, info: "Service reports attributed to the engineer (Assigned Service Engineer, else the job's Service Engineers).",
      render: (e) => <span className="col-value">{e.visits}</span>, sortValue: (e) => e.visits },
    { key: "avg", label: "Avg Days", weight: 7, info: "Average days per visit (Actual Visit End − Start + 1). Visits missing a date are left out.",
      render: (e) => dayCell(e.avgDays), sortValue: (e) => e.avgDays ?? -1, exportValue: (e) => (e.avgDays === null ? "" : Number(e.avgDays.toFixed(1))) },
    { key: "min", label: "Shortest", weight: 6, render: (e) => dayCell(e.minDays), sortValue: (e) => e.minDays ?? -1, exportValue: (e) => e.minDays ?? "" },
    { key: "max", label: "Longest", weight: 6, render: (e) => dayCell(e.maxDays), sortValue: (e) => e.maxDays ?? -1, exportValue: (e) => e.maxDays ?? "" },
    { key: "resolution", label: "Resolution Recorded", weight: 9, info: "Share of the engineer's visits with Resolution Applied filled in. Red (0%) → green (100%).",
      render: (e) => <HeatPct value={e.resolutionRate} />, sortValue: (e) => e.resolutionRate, exportValue: (e) => `${e.resolutionRate}%` },
    { key: "problems", label: "Problems Identified", weight: 9, info: "Share of the engineer's visits with at least one Problems Identified tag. Red (0%) → green (100%).",
      render: (e) => <HeatPct value={e.problemRate} />, sortValue: (e) => e.problemRate, exportValue: (e) => `${e.problemRate}%` },
    { key: "type", label: "Main Service Type", weight: 11, exportWidth: 20, info: "The engineer's most common Service Type across their visits.",
      render: (e) => <Pill color={colorFor(e.topServiceType, SERVICE_TYPE_COLORS)}>{e.topServiceType}</Pill>, sortValue: (e) => e.topServiceType, exportValue: (e) => e.topServiceType },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportWidth: 14, exportValue: (e) => ({ text: "Open in Odoo", hyperlink: odooEmployeeUrl(e.id) }) },
  ];

  const empty = (text) => <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0" }}>{text}</div>;

  return (
    <div className="report">
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
          const levelJobs = tmItems.reduce((sum, t) => sum + t.value, 0);
          const levelDone = tmItems.reduce((sum, t) => sum + t.completed, 0);
          const point = shown || { label: tmRegion || "All regions", rate: pct(levelDone, levelJobs), completed: levelDone, value: levelJobs };
          return (
            <div aria-live="polite" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 10, fontSize: 12, color: T.textSecondary }}>
              <div style={{ width: 260, flexShrink: 0 }}>
                <div style={{ position: "relative", height: 22 }}>
                  <div style={{ position: "absolute", left: `clamp(16px, ${point.rate}%, calc(100% - 16px))`, bottom: 0, transform: "translateX(-50%)", transition: "left 0.25s ease", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: heat(point.rate, 30), whiteSpace: "nowrap" }}>{point.rate}%</span>
                    <span aria-hidden="true" style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `6px solid ${T.textPrimary}` }} />
                  </div>
                </div>
                <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={point.rate} aria-label={`${point.label}: ${point.rate}% of cases completed`}
                  style={{ height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${heat(0, 55)}, ${heat(50, 55)}, ${heat(100, 45)})` }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted, marginTop: 3 }}>
                  <span>0%</span><span>50%</span><span>100% completed</span>
                </div>
              </div>
              <span style={{ flex: 1, minWidth: 240, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard }}>
                {shown ? <><strong style={{ color: T.textPrimary }}>{shown.label}</strong>: {shown.completed} of {shown.value} completed ({shown.rate}%) · {shown.hint}</>
                  : <><strong style={{ color: T.textPrimary }}>{point.label}</strong>: {point.completed} of {point.value} cases completed ({point.rate}%). Hover or tab to a {tmRegion ? "engineer" : "region"} to move the pointer; click or press Enter to {tmRegion ? "list their jobs" : "see its engineers"}.</>}
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

      {/* ── Engineer ranking & workload ── */}
      <SectionLabel>Engineer Ranking &amp; Workload</SectionLabel>
      <div style={{ marginBottom: 10 }}>
        <DataTable
          title="Engineers · worst report rate first"
          columns={engineerColumns}
          rows={r.engineers}
          storageKey="adage_fsm_report_engineer_ranking_cols_v1"
          defaultSort={{ key: "rate", dir: "asc" }}
          searchText={(e) => e.name}
          searchPlaceholder="Search engineer..."
          onRowClick={(e) => setRankEngineer((v) => (v === e.id ? null : e.id))}
          rowStyle={(e) => (e.id === rankEngineer ? { background: T.accentBg } : null)}
          exportName="field-service-engineer-ranking"
          maxHeight={420}
          emptyText="No engineers assigned."
          toolbar={<span title="Report rate = service reports logged ÷ jobs assigned, lifetime. Open = jobs currently in flight (today's workload). Sorted worst report rate first by default; click any column header to re-sort. Click an engineer to list their jobs." style={{ fontSize: 11.5, color: T.textMuted, cursor: "help" }}>ⓘ Click an engineer to see their jobs · Report rate = reports ÷ assigned</span>}
        />
      </div>
      {rankEngineer !== null && (() => {
        const e = r.engineers.find((x) => x.id === rankEngineer);
        if (!e) return null;
        const rows = r.live.filter((c) => c.engineerIds.includes(e.id));
        return jobsTable(`${e.name} · ${plural(rows.length, "job")} (${e.completed} completed, ${e.open} open, ${e.logged} with a service report)`, rows, `field-service-jobs-${e.name}`, () => setRankEngineer(null), "adage_fsm_report_engineer_jobs_cols_v2");
      })()}

      {/* ── Trends ── */}
      <ChartRow columns="minmax(0, 1.4fr) minmax(0, 1fr)">
        <Panel title="Monthly Trend · Cases Created" info="Jobs created per month (Created On): green = has a worksheet (service report), amber = no worksheet yet. Last 12 months with data. Click a month to list its jobs.">
          <MonthlyBars months={r.months} activeKey={trendMonth} onPick={(k) => setTrendMonth((v) => (v === k ? null : k))} />
        </Panel>
        <Panel title="How long open jobs have been waiting" info="Open jobs with no service report yet, grouped by days since they were created. Older = waiting longer.">
          <BarList items={r.waiting} formatValue={(v) => plural(v, "job")}
            onItemClick={(k) => setWaitBucket((v) => (v === k ? null : k))} activeKey={waitBucket} />
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 8 }}>Click a band to list its jobs.</div>
          {r.oldestWaiting && (
            <div style={{ marginTop: 14, padding: "8px 10px", borderRadius: 8, background: T.bgCardAlt, border: `1px solid ${T.border}`, fontSize: 11, color: T.textSecondary, lineHeight: 1.45 }}>
              Waiting longest: <a href={odooTaskUrl(r.oldestWaiting.id)} target="_blank" rel="noopener noreferrer" title="Open in Odoo" style={{ color: T.accent, fontWeight: 700, textDecoration: "none" }}>{r.oldestWaiting.name} ↗</a>
              {" · "}{r.oldestWaiting.ageDays} days · {engineerNames(r.oldestWaiting.engineerIds, userMap).join(", ") || "no engineer"}
            </div>
          )}
        </Panel>
      </ChartRow>
      {trendMonth && (() => {
        const rows = r.live.filter((c) => (c.createdISO || "").slice(0, 7) === trendMonth);
        const withWs = rows.filter((c) => c.hasWorksheet).length;
        return jobsTable(`Jobs created in ${monthLabel(trendMonth)} · ${plural(rows.length, "job")} (${withWs} with worksheet, ${rows.length - withWs} without)`, rows, `field-service-month-${trendMonth}`, () => setTrendMonth(null), "adage_fsm_report_engineer_jobs_cols_v2");
      })()}
      {waitBucket && (() => {
        const rows = r.backlog.filter((c) => ageBucketOf(c.ageDays) === waitBucket);
        return jobsTable(`Open jobs waiting ${waitBucket} · ${plural(rows.length, "job")}`, rows, `field-service-waiting-${waitBucket}`, () => setWaitBucket(null), "adage_fsm_report_engineer_jobs_cols_v2");
      })()}

      {/* ── Visit analysis ── */}
      <SectionLabel>Visit Analysis</SectionLabel>
      <div style={{ marginBottom: 10 }}>
        <DataTable
          title="Visit Analysis by Engineer · slowest visits first"
          columns={visitEngineerColumns}
          rows={visitByEngineer}
          storageKey="adage_fsm_report_visit_by_engineer_cols_v1"
          defaultSort={{ key: "avg", dir: "desc" }}
          searchText={(e) => e.name}
          searchPlaceholder="Search engineer..."
          onRowClick={(e) => setVisitEngineer((v) => (v === e.id ? null : e.id))}
          rowStyle={(e) => (e.id === visitEngineer ? { background: T.accentBg } : null)}
          exportName="field-service-visits-by-engineer"
          maxHeight={420}
          emptyText="No service reports yet."
          toolbar={<span style={{ fontSize: 11.5, color: T.textMuted }}>Click an engineer to see their jobs</span>}
        />
      </div>
      {visitEngineer !== null && (() => {
        const e = visitByEngineer.find((x) => x.id === visitEngineer);
        if (!e) return null;
        const rows = r.live.filter((c) => c.engineerIds.includes(e.id));
        const done = rows.filter(isCompleted).length;
        return jobsTable(`${e.name} · ${plural(rows.length, "assigned job")} (${done} completed, ${rows.length - done} open)`, rows, `field-service-jobs-${e.name}`, () => setVisitEngineer(null), "adage_fsm_report_engineer_jobs_cols_v2");
      })()}
      <div style={{ marginBottom: 10 }}>
        <DataTable
          title="Problems & Resolutions"
          columns={visitColumns}
          rows={visitRows}
          storageKey="adage_fsm_report_visits_cols_v3"
          searchText={(w) => [w.case?.name, caseCustomer(w.case), ...w.problems, ...w.spares, w.x_studio_resolution_applied, engineerNames(wsEngineers(w), userMap).join(" ")].join(" ")}
          searchPlaceholder="Search problems, resolutions..."
          onRowClick={(w) => openCase(w.case || { id: w.caseId })}
          exportName="field-service-problems-resolutions"
          maxHeight={420}
          emptyText="No service report has a problem or resolution recorded."
        />
      </div>

      {/* ── Problem & service types, next steps ── */}
      <SectionLabel>Problem Types, Service Types &amp; Next Steps</SectionLabel>
      <ChartRow columns="minmax(0, 1fr) minmax(0, 1fr)">
        <InteractiveDonut title="Problem Types" infoText="Jobs per Problem Type (the job's Problem Type field)." centerLabel="jobs" unit="jobs" segments={topWithOther(r.problemTypes)} />
        <InteractiveDonut title="Service Type" infoText="Service Type picked on each service report." centerLabel="reports" unit="reports" segments={topWithOther(serviceTypes)} />
      </ChartRow>
      {/* ── Next steps ── */}
      <div className="card report-avoid-break" style={{ padding: "14px 18px", marginBottom: 10, background: T.accentBg, border: `1px solid ${T.accentBdr}` }}>
        <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Next Steps</div>
        {r.actions.length === 0 ? <div style={{ fontSize: 13, color: T.textPrimary }}>Nothing needs action right now.</div> : (
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {r.actions.slice(0, 3).map((a) => (
              <li key={a.id} style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}>
                {a.text}{" "}
                <button type="button" className="no-print" onClick={() => { setActionEngineer(null); setExpandedAction((v) => (v === a.id ? null : a.id)); }} aria-expanded={expandedAction === a.id}
                  style={{ marginLeft: 4, padding: "2px 10px", borderRadius: 999, border: `1px solid ${T.accent}`, background: expandedAction === a.id ? T.accent : T.bgCard,
                    color: expandedAction === a.id ? "#fff" : T.accent, fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {expandedAction === a.id ? "Hide ↑" : a.engineers ? `Take Action → (${plural(a.engineers.length, "engineer")})` : `Take Action → (${plural(a.rows.length, "job")})`}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      {(() => {
        const a = r.actions.find((x) => x.id === expandedAction);
        if (a?.engineers) {
          const picked = a.engineers.find((e) => e.id === actionEngineer);
          const pickedJobs = picked ? r.live.filter((c) => c.engineerIds.includes(picked.id)) : [];
          return (
            <>
              <div style={{ marginBottom: 10 }}>
                <DataTable
                  title={`Next step · ${plural(a.engineers.length, "engineer")} with 3+ jobs and no service report`}
                  columns={engineerColumns}
                  rows={a.engineers}
                  storageKey="adage_fsm_report_action_silent_cols_v2"
                  defaultSort={{ key: "assigned", dir: "desc" }}
                  searchText={(e) => e.name}
                  searchPlaceholder="Search engineer..."
                  onRowClick={(e) => setActionEngineer((v) => (v === e.id ? null : e.id))}
                  rowStyle={(e) => (e.id === actionEngineer ? { background: T.accentBg } : null)}
                  exportName="field-service-action-silent"
                  maxHeight={360}
                  toolbar={<>
                    <span style={{ fontSize: 11.5, color: T.textMuted }}>Click an engineer to see their jobs</span>
                    <button className="no-print" onClick={() => setExpandedAction(null)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>✕ Close</button>
                  </>}
                />
              </div>
              {picked && jobsTable(`${picked.name} · ${plural(pickedJobs.length, "assigned job")} (${picked.open} open, no service report filed)`, pickedJobs, `field-service-jobs-${picked.name}`, () => setActionEngineer(null), "adage_fsm_report_engineer_jobs_cols_v2")}
            </>
          );
        }
        return a && jobsTable(`Next step · ${plural(a.rows.length, "job")} to act on`, a.rows, `field-service-action-${a.id}`, () => setExpandedAction(null), `adage_fsm_report_action_${a.id}_cols_v1`);
      })()}
      <div style={{ fontSize: 12, color: T.textMuted, margin: "4px 2px 0", lineHeight: 1.5 }}>
        Odoo has no due dates for these jobs, so "late" means older than {LATE_DAYS} days. Most records are entered under one shared Odoo login, so "who entered it" isn't shown.
        Detail lives in the Overview, Worksheets, Documents and Timesheets tabs.
      </div>
    </div>
  );
}
