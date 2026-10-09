import { useMemo, useState } from "react";
import { T } from "../constants/theme";
import { SERVICE_TYPE_COLORS, CHART_COLORS, colorFor } from "../constants/colors";
import { tally, engineerStats, customerStats, engineerVisitStats, engineerHoursStats, wsEngineerIds, AGE_BUCKETS, ageBucketOf } from "../lib/derive";
import { ChartRow, Panel, Pill, DataTable, MultiSelect, FilterSelect, FilterChip, TitleCell, Txt, BarList, InteractiveDonut, InfoDot, KpiCard, KpiRow, fmtNum, pct, plural } from "../components/ui";
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
const SHOW_TYPE_DONUTS = false; // Problem Types / Service Type pie charts, hidden for now
const daysSince = (dt) => (dt ? Math.floor((Date.now() - Date.parse(String(dt).replace(" ", "T") + "Z")) / 86400000) : null);
const isCompleted = (c) => /complet|done/i.test(c.stage_id?.[1] || "");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS[m - 1]} '${String(y).slice(2)}`; };
const uniqSorted = (xs) => [...new Set(xs.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

// Pie charts stay readable with ≤ 5 slices: keep the top 4, fold the rest into "Other".
// "Other" keeps the folded-in items (`others`) so the donut can expand it to show what's inside.
const topWithOther = (items, n = 4) => (items.length <= n + 1 ? items
  : [...items.slice(0, n), {
      key: "Other", value: items.slice(n).reduce((sum, x) => sum + x.value, 0), color: "#CBD5E1",
      displayKey: `Other (${items.length - n})`, others: items.slice(n).sort((a, b) => b.value - a.value),
    }]);

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
function HeatPct({ value, children }) {
  return <span style={{ display: "inline-block", minWidth: 38, textAlign: "center", fontSize: 11.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: heat(value, 90), color: heat(value, 28) }}>{children ?? `${value}%`}</span>;
}

// Table toolbar hint: short text + the "?" popover with labelled sections and formula boxes (same as Engineer Ranking).
const TableHint = ({ text, info }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.textMuted }}>{text} <InfoDot text={info} /></span>
);

// Year / Month / Customer / Problem Type pickers + chips + Clear all (treemap and Problems & Resolutions).
// filters: [{ key, label, options, selected, onChange, searchable? }]
function FilterBar({ filters, count, noun }) {
  const active = filters.filter((f) => f.selected.length);
  return (
    <div className="no-print" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {filters.map((f) => (
          <MultiSelect key={f.key} label={f.label} options={f.options} selected={f.selected} onChange={f.onChange}
            searchable={f.searchable} searchPlaceholder={`Search ${f.label.toLowerCase()}...`} />
        ))}
        <span style={{ fontSize: 11.5, color: T.textMuted }}>{plural(count, noun)} shown</span>
      </div>
      {active.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {active.map((f) => <FilterChip key={f.key} label={`${f.label}: ${f.selected.join(", ")}`} onClear={() => f.onChange([])} />)}
          <button onClick={() => filters.forEach((f) => f.onChange([]))} style={{ padding: "3px 10px", borderRadius: 100, border: `1px solid ${T.border}`, background: "none", color: T.textMuted, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>Clear all ✕</button>
        </div>
      )}
    </div>
  );
}

// "?" content shared by every job list (treemap, ranking, trend, waiting, visit and Next Steps drill-downs).
const JOBS_INFO = [
  { label: "Days Open", formula: "Days Open = Today − Created On", text: "Open jobs only; red when over 60 days (late). Completed jobs show —." },
  { label: "Hours", formula: "Hours = Σ Total Working Hours on the job's timesheets", text: "Timesheet hours are stored as text in Odoo and parsed to numbers." },
  { label: "Worksheet", text: "Yes when the job has at least one Service Call Worksheet. Click a row to open the job in Odoo." },
];

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

// ─── Top customers: horizontal bar chart, metric picked by the user ───────────
// Each metric plots a customerStats field. Split metrics stack two parts; clicking a legend item shows only that part.
const CUSTOMER_METRICS = [
  { value: "jobs", label: "Jobs", unit: "job", parts: [
    { key: "completed", label: "Completed", short: "done", color: T.success },
    { key: "open", label: "In progress", short: "open", color: AMBER },
  ] },
  { value: "visits", label: "Visits (Worksheets)", unit: "job", parts: [
    { key: "logged", label: "With worksheet", short: "with", color: T.success },
    { key: "unlogged", label: "Without worksheet", short: "without", color: AMBER },
  ] },
  { value: "visitDays", label: "Visit Days", unit: "day" },
  { value: "hours", label: "Working Hours", unit: "h" },
];
const fmtMetric = (v, unit) => (unit === "h" ? `${fmtNum(v, 0)} h` : plural(Math.round(v), unit));
// Round the axis up to a 1 / 2 / 5 × 10ⁿ step so the gridlines land on readable numbers.
const niceAxis = (max, ticks = 4) => {
  const raw = Math.max(1, max) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return { step, top: Math.ceil(Math.max(1, max) / step) * step };
};

function CustomerBars({ customers, metric, part, onPart, top, activeKey, onPick }) {
  const [hover, setHover] = useState(null);
  const m = CUSTOMER_METRICS.find((x) => x.value === metric) || CUSTOMER_METRICS[0];
  const shown = m.parts ? m.parts.filter((p) => !part || p.key === part) : null; // parts on the bars (one when a legend item is picked)
  const val = (c) => (shown ? shown.reduce((s, p) => s + c[p.key], 0) : c[m.value]);
  const rows = [...customers].filter((c) => val(c) > 0).sort((a, b) => val(b) - val(a)).slice(0, top);
  const { step, top: axisTop } = niceAxis(rows[0] ? val(rows[0]) : 0);
  const ticks = Array.from({ length: Math.round(axisTop / step) + 1 }, (_, i) => i * step);
  const focus = rows.find((c) => c.name === (hover || activeKey));
  const LABEL_W = "clamp(90px, 28%, 190px)";   // shrinks on narrow screens
  const VALUE_W = shown?.length > 1 ? 104 : 56; // a split bar also prints its second part, so it needs more room
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 11.5, color: T.textSecondary, minHeight: 18 }}>
        {m.parts && m.parts.map((p) => {
          const on = !part || part === p.key;
          return (
            <button key={p.key} type="button" onClick={() => onPart(part === p.key ? null : p.key)} aria-pressed={part === p.key}
              title={part === p.key ? "Click again to show both" : `Show only ${p.label.toLowerCase()}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: part === p.key ? 700 : 500, fontFamily: "inherit", cursor: "pointer",
                border: `1px solid ${part === p.key ? p.color : T.border}`, background: part === p.key ? T.bgInput : T.bgCard, color: on ? T.textPrimary : T.textMuted, opacity: on ? 1 : 0.6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color }} />{p.label}
            </button>
          );
        })}
        <span aria-live="polite" style={{ marginLeft: "auto", color: T.textPrimary }}>
          {focus
            ? <><strong>{focus.name}</strong>: {plural(focus.jobs, "job")} ({focus.completed} completed, {focus.open} in progress) · {plural(focus.visits, "worksheet")} · {fmtNum(focus.hours, 0)} h</>
            : <span style={{ color: T.textMuted }}>{m.parts ? "Click a legend item to show only that part. " : ""}Hover a customer for details; click to list their jobs.</span>}
        </span>
      </div>
      {!rows.length ? <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0" }}>No customer has any {(shown?.length === 1 ? shown[0].label : m.label).toLowerCase()} yet</div> : <>
        <div style={{ position: "relative" }}>
          {/* gridlines behind the bars */}
          <div aria-hidden="true" style={{ position: "absolute", top: 0, bottom: 0, left: LABEL_W, right: VALUE_W, pointerEvents: "none" }}>
            {ticks.map((t) => <div key={t} style={{ position: "absolute", top: 0, bottom: 0, left: `${(t / axisTop) * 100}%`, borderLeft: `1px ${t ? "dashed" : "solid"} ${T.border}` }} />)}
          </div>
          {rows.map((c, i) => {
            const v = val(c);
            const parts = shown ? shown.map((p) => ({ ...p, value: c[p.key] })) : [{ key: m.value, label: m.label, value: v, color: CHART_COLORS[i % CHART_COLORS.length] }];
            const isActive = activeKey === c.name;
            const dim = (hover || activeKey) && (hover || activeKey) !== c.name;
            const second = shown?.length > 1 ? parts[1] : null;
            return (
              <button key={c.name} type="button" onClick={() => onPick(c.name)} onMouseEnter={() => setHover(c.name)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(c.name)} onBlur={() => setHover(null)} aria-pressed={isActive}
                aria-label={`${c.name}: ${fmtMetric(v, m.unit)}${shown ? ` (${parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(", ")})` : ""}`}
                style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", height: 26, padding: 0, border: "none", borderRadius: 6,
                  background: isActive ? T.accentBg : "transparent", cursor: "pointer", opacity: dim ? 0.45 : 1, transition: "opacity 0.15s", fontFamily: "inherit" }}>
                <span title={c.name} style={{ width: LABEL_W, flexShrink: 0, paddingRight: 10, textAlign: "right", fontSize: 11.5, fontWeight: isActive ? 700 : 500,
                  color: isActive ? T.accent : T.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                <span style={{ flex: 1, height: 16, display: "flex" }}>
                  <span style={{ width: `${(v / axisTop) * 100}%`, minWidth: 3, height: "100%", display: "flex", borderRadius: "0 4px 4px 0", overflow: "hidden", transition: "width 0.4s ease" }}>
                    {parts.map((p) => <span key={p.key} title={`${p.label}: ${fmtMetric(p.value, m.unit)}`} style={{ width: v ? `${(p.value / v) * 100}%` : 0, background: p.color }} />)}
                  </span>
                </span>
                <span style={{ width: VALUE_W, flexShrink: 0, paddingLeft: 6, textAlign: "left", fontSize: 11, fontWeight: 700, color: T.textSecondary, whiteSpace: "nowrap" }}>
                  {m.unit === "h" ? fmtNum(v, 0) : v}{second?.value > 0 && <span style={{ fontWeight: 500, color: second.color }}> · {second.value} {second.short}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {/* x-axis */}
        <div style={{ position: "relative", height: 16, marginLeft: LABEL_W, marginRight: VALUE_W, marginTop: 4, borderTop: `1px solid ${T.border}` }}>
          {ticks.map((t) => <span key={t} style={{ position: "absolute", left: `${(t / axisTop) * 100}%`, transform: "translateX(-50%)", top: 2, fontSize: 11, color: T.textSecondary }}>{fmtNum(t, 0)}</span>)}
        </div>
        <div style={{ textAlign: "center", fontSize: 10.5, color: T.textMuted, marginTop: 2 }}>{shown?.length === 1 ? `${m.label} · ${shown[0].label}` : m.label}</div>
      </>}
    </div>
  );
}

// Grid / Bar Graph switch for Customer Insights (pill pair, same look as the header pills).
function ViewSwitch({ value, onChange, options }) {
  return (
    <div role="group" aria-label="View" className="no-print" style={{ display: "inline-flex", padding: 3, borderRadius: 999, background: T.bgInput, border: `1px solid ${T.border}` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          style={{ padding: "4px 14px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
            background: value === o.value ? T.accent : "transparent", color: value === o.value ? "#fff" : T.textSecondary }}>
          {o.label}
        </button>
      ))}
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

export function ReportTab({ model, userMap, serviceEngineerCount }) {
  const { cases, worksheets, timesheets } = model;
  const [tmGroupBy, setTmGroupBy] = useState("engineer"); // treemap grouping: engineer (default) | customer | region
  const [tmKey, setTmKey] = useState(null);         // clicked tile within the current grouping
  const [tmPeek, setTmPeek] = useState(null);       // tile under the mouse / keyboard focus (detail strip)
  const [fYear, setFYear] = useState([]);           // treemap filters (Created On year / month, customer, problem type)
  const [fMonth, setFMonth] = useState([]);
  const [fCustomer, setFCustomer] = useState([]);
  const [fProblem, setFProblem] = useState([]);
  const [pYear, setPYear] = useState([]);           // Problems & Resolutions filters (same four, on the worksheet's job)
  const [pMonth, setPMonth] = useState([]);
  const [pCustomer, setPCustomer] = useState([]);
  const [pProblem, setPProblem] = useState([]);
  const [pEngineer, setPEngineer] = useState([]);   // Problems & Resolutions: engineer names
  const [waitBucket, setWaitBucket] = useState(null);  // clicked age band in "How long open jobs have been waiting"
  const [trendMonth, setTrendMonth] = useState(null);   // clicked month in the monthly trend ("YYYY-MM")
  const [rankEngineer, setRankEngineer] = useState(null); // clicked row in Engineer Ranking & Workload (employee id)
  const [visitEngineer, setVisitEngineer] = useState(null); // clicked row in Visit Analysis by Engineer (employee id)
  const [custPick, setCustPick] = useState(null);         // clicked customer in Customer Insights (name)
  const [custMetric, setCustMetric] = useState("jobs");   // what the top-customers chart ranks by
  const [custTop, setCustTop] = useState(10);
  const [custPart, setCustPart] = useState(null);       // legend item picked in the chart (e.g. "completed"); null = both
  const [custView, setCustView] = useState("bar");      // Customer Insights: "bar" graph or "grid" table
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

    // Monthly trend (cases created per month, with / without a worksheet), last 12 months with data
    const byMonth = {};
    live.forEach((c) => {
      if (!c.createdISO) return;
      const k = c.createdISO.slice(0, 7);
      byMonth[k] = byMonth[k] || { logged: 0, unlogged: 0 };
      byMonth[k][c.hasWorksheet ? "logged" : "unlogged"] += 1;
    });
    const months = Object.keys(byMonth).sort().slice(-12).map((k) => ({ key: k, label: monthLabel(k), ...byMonth[k] }));

    // How long open jobs (no worksheet yet) have been waiting, by age since created
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
        text: `${plural(silent.length, "engineer")} ${silent.length === 1 ? "has" : "have"} 3 or more jobs but ${silent.length === 1 ? "has" : "have"} never submitted a worksheet (${plural(silentJobs.length, "job")} between them). Arrange a short refresher on the mobile worksheet.` });
    }
    if (recurring.length) { const [cust, prob] = recurring[0].key.split(" · "); actions.push({ id: "recurring", rows: live.filter((c) => recurring[0].ids.has(c.id)), text: `${cust} has had "${prob}" ${recurring[0].value} times. Consider a root-cause visit or a maintenance contract review.` }); }

    // Problem Type split across jobs (case field)
    const problemTypes = tally(live.map((c) => c.x_studio_problem_type || "Not set"))
      .map((t, i) => ({ ...t, color: t.key === "Not set" ? "#94A3B8" : CHART_COLORS[i % CHART_COLORS.length] }));

    return { live, open, engineers, customers: customerStats(live), backlog, months, waiting, oldestWaiting, recurring, problemTypes, actions };
  }, [cases, worksheets, userMap]);

  // Treemap: tiles = jobs grouped by engineer (default), customer or region; size = jobs, colour = % completed.
  const GROUP_OPTIONS = [
    { value: "engineer", label: "Service Engineer" },
    { value: "customer", label: "Customer" },
    { value: "region", label: "Region" },
  ];
  const regionOf = (c) => c.x_studio_regions || "No region";
  const yearOf = (c) => (c.createdISO || "").slice(0, 4);
  const monthOf = (c) => (c.createdISO ? MONTHS[Number(c.createdISO.slice(5, 7)) - 1] : "");
  // Job filters (Created On year / month, customer, Problem Type), shared by the treemap and Problems & Resolutions.
  // Each filter is a [selected, setSelected] pair; an empty selection means "all".
  const matchesJob = (c, y, m, cu, p) => (!y.length && !m.length && !cu.length && !p.length) || (!!c &&
    (!y.length || y.includes(yearOf(c))) && (!m.length || m.includes(monthOf(c))) &&
    (!cu.length || cu.includes(caseCustomer(c))) && (!p.length || p.includes(c.x_studio_problem_type)));
  const jobOptions = {
    year: uniqSorted(r.live.map(yearOf)).reverse(),
    month: MONTHS.filter((mo) => r.live.some((c) => monthOf(c) === mo)),
    customer: uniqSorted(r.live.map(caseCustomer)),
    problem: uniqSorted(r.live.map((c) => c.x_studio_problem_type)),
  };
  // Returns a keyed map rather than a fixed array so each panel can order the filters it shows.
  const jobFilters = (y, m, cu, p) => ({
    year: { key: "year", label: "Year", options: jobOptions.year, selected: y[0], onChange: y[1] },
    month: { key: "month", label: "Month", options: jobOptions.month, selected: m[0], onChange: m[1] },
    customer: { key: "customer", label: "Customer", options: jobOptions.customer, selected: cu[0], onChange: cu[1], searchable: true },
    problem: { key: "problem", label: "Problem Type", options: jobOptions.problem, selected: p[0], onChange: p[1], searchable: true },
  });
  const tmCases = r.live.filter((c) => matchesJob(c, fYear, fMonth, fCustomer, fProblem));
  // Tile = jobs (size) + completion (colour) + working hours, open / late jobs and worksheets.
  // A job with two engineers counts (with its hours) for each of them.
  const tile = (key, label, jobs, extra = "") => {
    const completed = jobs.filter(isCompleted).length;
    const open = jobs.filter((c) => c.isOpen);
    const late = open.filter((c) => (c.ageDays ?? 0) > LATE_DAYS).length;
    const hours = jobs.reduce((s, c) => s + c.hours, 0);
    const reports = jobs.filter((c) => c.hasWorksheet).length;
    const hint = [extra, `${fmtNum(hours, 0)} h worked`, `${open.length} open${late ? ` (${late} late)` : ""}`, plural(reports, "worksheet")].filter(Boolean).join(" · ");
    return { key, label, value: jobs.length, completed, rate: pct(completed, jobs.length), hint };
  };
  // A job groups under each of its engineers when grouping by engineer; one key otherwise.
  const tmGroupKeys = (c) => (tmGroupBy === "engineer" ? (c.engineerIds.length ? c.engineerIds.map(String) : ["none"])
    : tmGroupBy === "customer" ? [caseCustomer(c) || "No customer"] : [regionOf(c)]);
  const tmKeyLabel = (key) => (tmGroupBy === "engineer" ? (key === "none" ? "No engineer" : userMap[Number(key)] || `Employee #${key}`) : key);
  const tmExtra = (jobs) => (tmGroupBy === "engineer" ? plural(new Set(jobs.map(caseCustomer).filter(Boolean)).size, "customer")
    : plural(new Set(jobs.flatMap((c) => c.engineerIds)).size, "engineer"));
  const tmItems = Object.entries(tmCases.reduce((m, c) => (tmGroupKeys(c).forEach((k) => (m[k] = m[k] || []).push(c)), m), {}))
    .map(([k, jobs]) => tile(k, tmKeyLabel(k), jobs, tmExtra(jobs)));
  const tmJobs = tmKey ? tmCases.filter((c) => tmGroupKeys(c).includes(tmKey)) : [];
  const tmSelectedLabel = tmItems.find((t) => t.key === tmKey)?.label;
  const tmSelect = (key) => setTmKey((v) => (v === key ? null : key));
  const tmGroupLabel = GROUP_OPTIONS.find((o) => o.value === tmGroupBy).label;
  const tmGroupPlural = tmGroupBy === "region" ? "regions" : tmGroupBy === "customer" ? "customers" : "engineers";
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
        toolbar={<>
          <TableHint text="Click a job to open it in Odoo" info={JOBS_INFO} />
          <button className="no-print" onClick={onClose} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>✕ Close</button>
        </>}
      />
    </div>
  );
  const jobColumns = [
    { key: "name", label: "Job", weight: 26, render: (c) => <TitleCell title={c.name} sub={c.x_studio_problem_type || null} />, sortValue: (c) => c.name || "" },
    { key: "customer", label: "Customer", weight: 22, render: (c) => <Txt>{caseCustomer(c)}</Txt>, sortValue: caseCustomer },
    { key: "stage", label: "Status", weight: 11, render: (c) => <StagePill stage={c.stage_id?.[1]} />, sortValue: (c) => c.stage_id?.[1] || "", exportValue: (c) => c.stage_id?.[1] || "" },
    { key: "created", label: "Created On", weight: 11, render: (c) => <Txt>{fmtDay(c.createdISO)}</Txt>, sortValue: (c) => c.createdISO, exportValue: (c) => c.createdISO },
    { key: "age", label: "Days Open", weight: 9, info: [{ label: "Days Open", formula: "Days Open = Today − Created On", text: `Open jobs only; red when over ${LATE_DAYS} days (late). Completed jobs show —.` }], render: (c) => (c.isOpen ? <Txt style={{ color: (c.ageDays ?? 0) > LATE_DAYS ? T.danger : undefined, fontWeight: 600 }}>{c.ageDays}</Txt> : <Txt>{null}</Txt>), sortValue: (c) => (c.isOpen ? c.ageDays ?? 0 : -1), exportValue: (c) => (c.isOpen ? c.ageDays : "") },
    { key: "hours", label: "Hours", weight: 7, info: [{ label: "Hours", formula: "Hours = Σ Total Working Hours (job's timesheets)", text: "Blank when the job has no timesheet." }], render: (c) => (c.hours ? <span className="col-value">{fmtNum(c.hours, 1)}</span> : <Txt>{null}</Txt>), sortValue: (c) => c.hours },
    { key: "report", label: "Worksheet", weight: 11, info: [{ label: "Worksheet", formula: "Yes = job has ≥ 1 Service Call Worksheet", text: "No means the visit hasn't been written up in Odoo yet." }], render: (c) => <YesNo yes={c.hasWorksheet} />, sortValue: (c) => (c.hasWorksheet ? 1 : 0), exportValue: (c) => (c.hasWorksheet ? "Yes" : "No") },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (c) => odooLinkCell(c.id) },
  ];

  // ── Engineer ranking & workload ──
  // Report rate = worksheets logged ÷ jobs assigned (lifetime); highest first by default.
  const engineerColumns = [
    { key: "name", label: "Engineer", weight: 18, exportWidth: 30, render: (e) => <TitleCell title={e.name} />, sortValue: (e) => e.name, exportValue: (e) => e.name },
    { key: "assigned", label: "Assigned", weight: 7, info: [{ label: "Assigned", formula: "Assigned = jobs with this engineer in Service Engineers", text: "Lifetime workload; cancelled jobs excluded. A job with two engineers counts for each." }],
      render: (e) => <span className="col-value">{e.assigned}</span>, sortValue: (e) => e.assigned },
    { key: "open", label: "In Progress", weight: 7, info: [{ label: "In Progress", formula: "In Progress = Assigned jobs not Completed / Done", text: "The engineer's workload right now." }],
      render: (e) => <Txt>{e.open}</Txt>, sortValue: (e) => e.open },
    { key: "completed", label: "Completed", weight: 7, info: [{ label: "Completed", formula: "Completed = Assigned − In Progress", text: "Assigned jobs whose stage name contains Completed or Done." }], render: (e) => <Txt>{e.completed}</Txt>, sortValue: (e) => e.completed },
    { key: "rate", label: "Logged Worksheet", weight: 14, exportWidth: 16,
      info: [
        { label: "Worksheets logged", formula: "Logged = Assigned jobs with ≥ 1 worksheet", text: "Shown first as Logged / Assigned." },
        { label: "Report Rate", formula: "Rate = Logged ÷ Assigned × 100", text: "Colour runs red (0%) → amber → green (100%). The table sorts by this, highest first." },
      ],
      render: (e) => {
        const p = pct(e.logged, e.assigned);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, color: T.textSecondary, whiteSpace: "nowrap" }}>{e.logged}/{e.assigned}</span>
            <div style={{ flex: 1, height: 9, borderRadius: 5, background: T.bgInput, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(p, p > 0 ? 4 : 0)}%`, height: "100%", borderRadius: 5, background: heat(p, 45), transition: "width 0.2s ease" }} />
            </div>
            <HeatPct value={p} />
          </div>
        );
      },
      sortValue: (e) => e.rate, exportValue: (e) => `${e.logged} of ${e.assigned} (${pct(e.logged, e.assigned)}%)` },
    { key: "backlog", label: "Unlogged Worksheet", weight: 9, info: [{ label: "Unlogged Worksheet", formula: "Unlogged Worksheet = In Progress jobs with no worksheet", text: "Work done or in progress that hasn't been written up yet." }],
      render: (e) => (e.backlog ? <Pill color={T.warning} bg={T.warningBg}>{e.backlog}</Pill> : <Txt>{0}</Txt>), sortValue: (e) => e.backlog, exportValue: (e) => e.backlog },
    { key: "hours", label: "Total Working Hours", weight: 9, info: [{ label: "Total Working Hours", formula: "Total Working Hours = Σ Total Working Hours (timesheets of their jobs)", text: "A job with two engineers counts its hours for each." }],
      render: (e) => (e.hours ? <span className="col-value">{fmtNum(e.hours, 0)}</span> : <Txt>{null}</Txt>), sortValue: (e) => e.hours, exportValue: (e) => Math.round(e.hours) },
    { key: "last", label: "Last Logged In", weight: 9, exportWidth: 16, info: [{ label: "Last Logged In", formula: "Last Logged In = Today − date of latest worksheet", text: `Red when the engineer has never filed one, or the last was more than ${STUCK_DAYS} days ago.` }],
      render: (e) => (e.lastLoggedDays === null
        ? <span style={{ fontSize: 11.5, fontWeight: 700, color: T.danger }}>Never</span>
        : <span style={{ fontSize: 11.5, fontWeight: e.lastLoggedDays > STUCK_DAYS ? 700 : 500, color: e.lastLoggedDays > STUCK_DAYS ? T.danger : T.textSecondary }}>{e.lastLoggedDays}d ago</span>),
      sortValue: (e) => e.lastLoggedDays ?? Infinity, exportValue: (e) => (e.lastLoggedDays === null ? "Never" : e.lastLoggedDays) },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportWidth: 14, exportValue: (e) => ({ text: "Open in Odoo", hyperlink: odooEmployeeUrl(e.id) }) },
  ];

  // ── Visit analysis (worksheet data) ──
  const wsEngineers = wsEngineerIds;
  const serviceTypes = tally(worksheets.map((w) => w.x_studio_service_type || "Not set"))
    .map((t, i) => ({ ...t, color: t.key === "Not set" ? "#94A3B8" : colorFor(t.key, SERVICE_TYPE_COLORS, i) }));
  const hasResolution = (w) => !!(w.x_studio_resolution_applied || "").trim();
  const problemRows = worksheets.filter((w) => w.problems.length || hasResolution(w)); // only worksheets with a problem or resolution
  const wsEngineerNames = (w) => engineerNames(wsEngineers(w), userMap);
  const visitRows = problemRows.filter((w) => matchesJob(w.case, pYear, pMonth, pCustomer, pProblem)
    && (!pEngineer.length || wsEngineerNames(w).some((n) => pEngineer.includes(n))));
  const pJobFilters = jobFilters([pYear, setPYear], [pMonth, setPMonth], [pCustomer, setPCustomer], [pProblem, setPProblem]);
  const visitFilters = [
    { key: "engineer", label: "Engineer", options: uniqSorted(problemRows.flatMap(wsEngineerNames)), selected: pEngineer, onChange: setPEngineer, searchable: true },
    pJobFilters.customer,
    pJobFilters.problem,
    pJobFilters.month,
    pJobFilters.year,
  ];
  const visitColumns = [
    { key: "engineer", label: "Engineer", weight: 11, exportWidth: 28,
      render: (w) => <EngineerPills ids={wsEngineers(w)} userMap={userMap} />,
      sortValue: (w) => engineerNames(wsEngineers(w), userMap).join(", "), exportValue: (w) => engineerNames(wsEngineers(w), userMap).join(", ") },
    { key: "case", label: "Job", weight: 18, exportWidth: 40,
      render: (w) => <TitleCell title={w.case?.name || w.x_studio_task_id?.[1] || "Unlinked worksheet"} sub={caseCustomer(w.case)} />,
      sortValue: (w) => w.case?.name || "", exportValue: (w) => w.case?.name || w.x_studio_task_id?.[1] || "" },
    { key: "problems", label: "Problems Identified", weight: 16, exportWidth: 40, info: [{ label: "Problems Identified", formula: "Tags in the worksheet's Problems Identified field", text: "What the engineer found wrong on this visit." }],
      render: (w) => <TagList items={w.problems} color="#DC2626" />, sortValue: (w) => w.problems.length, exportValue: (w) => w.problems.join(", ") },
    { key: "resolution", label: "Resolution Applied", weight: 24, exportWidth: 70, info: [{ label: "Resolution Applied", formula: "The worksheet's Resolution Applied text", text: "What the engineer did to fix it. Hover a cell to read it in full; \"Not recorded\" when empty." }],
      render: (w) => (hasResolution(w)
        ? <span title={w.x_studio_resolution_applied} style={{ fontSize: 11.5, color: T.textSecondary, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>{w.x_studio_resolution_applied.trim()}</span>
        : <Txt style={{ color: T.textMuted }}>Not recorded</Txt>),
      sortValue: (w) => (hasResolution(w) ? 1 : 0), exportValue: (w) => (w.x_studio_resolution_applied || "").trim() },
    { key: "spares", label: "Spare Parts Used", weight: 13, exportWidth: 36, info: [{ label: "Spare Parts Used", formula: "Parts in the worksheet's Spare Parts Used field", text: "— when no part was recorded." }],
      render: (w) => <TagList items={w.spares} color="#7C3AED" />, sortValue: (w) => w.spares.length, exportValue: (w) => w.spares.join(", ") },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (w) => odooLinkCell(w.caseId), exportWidth: 14 },
  ];
  // Per-engineer visit stats: most visit days first
  const hoursByEngineer = Object.fromEntries(engineerHoursStats(timesheets).map((h) => [h.id, h]));
  const visitByEngineer = engineerVisitStats(worksheets, userMap).map((e) => ({ ...e, totalHours: hoursByEngineer[e.id]?.totalHours ?? null }));
  const dayCell = (v) => (v === null ? <Txt>{null}</Txt> : <span className="col-value">{Number.isInteger(v) ? v : fmtNum(v, 1)}</span>);
  const visitEngineerColumns = [
    { key: "name", label: "Engineer", weight: 18, exportWidth: 30, render: (e) => <TitleCell title={e.name} />, sortValue: (e) => e.name, exportValue: (e) => e.name },
    { key: "visits", label: "Visits", weight: 6, info: [{ label: "Visits", formula: "Visits = number of the engineer's worksheets", text: "A worksheet counts for its Assigned Service Engineer, else the job's Service Engineers." }],
      render: (e) => <span className="col-value">{e.visits}</span>, sortValue: (e) => e.visits },
    { key: "days", label: "Total Days", weight: 8,
      info: [
        { label: "Total Days", formula: "Total Days = Σ (Visit End − Visit Start + 1)", text: "Both days count, so a same-day visit is 1 day." },
        { label: "Missing dates", text: "A visit without a start or end date is left out of the total but still counts in Visits." },
      ],
      render: (e) => dayCell(e.totalDays), sortValue: (e) => e.totalDays ?? -1, exportValue: (e) => e.totalDays ?? "" },
    { key: "hours", label: "Total Hours", weight: 8,
      info: [
        { label: "Total Hours", formula: "Total Hours = Σ Total Working Hours", text: "From the engineer's own timesheets, not the visit dates." },
        { label: "Whose timesheets", text: "The timesheet's Submitted By, else the job's Service Engineers. Blank when the engineer has none." },
      ],
      render: (e) => dayCell(e.totalHours), sortValue: (e) => e.totalHours ?? -1, exportValue: (e) => (e.totalHours === null ? "" : Number(e.totalHours.toFixed(1))) },
    { key: "problems", label: "Problems Identified", weight: 9, info: [{ label: "Problems Identified", formula: "Visits with ≥ 1 problem tag, of all Visits", text: "Shown as “N of Visits”. Colour: red (none) → green (all)." }],
      render: (e) => <HeatPct value={e.problemRate}>{e.withProblems} of {e.visits}</HeatPct>, sortValue: (e) => e.withProblems, exportValue: (e) => e.withProblems },
    { key: "spares", label: "Spare Parts Used", weight: 16, exportWidth: 50, info: [{ label: "Spare Parts Used", formula: "Distinct parts across the engineer's worksheets", text: "Each part listed once; sorting uses how many different parts." }],
      render: (e) => <TagList items={e.spareParts} color="#7C3AED" />, sortValue: (e) => e.spareParts.length, exportValue: (e) => e.spareParts.join(", ") },
    { key: "type", label: "Main Service Type", weight: 11, exportWidth: 20, info: [{ label: "Main Service Type", formula: "Most frequent Service Type on their worksheets", text: "Shows what kind of work the engineer mostly does." }],
      render: (e) => <Pill color={colorFor(e.topServiceType, SERVICE_TYPE_COLORS)}>{e.topServiceType}</Pill>, sortValue: (e) => e.topServiceType, exportValue: (e) => e.topServiceType },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportWidth: 14, exportValue: (e) => ({ text: "Open in Odoo", hyperlink: odooEmployeeUrl(e.id) }) },
  ];

  // ── Customer insights (customer = the job's Customer field) ──
  const customerColumns = [
    { key: "name", label: "Customer", weight: 22, exportWidth: 40, render: (c) => <TitleCell title={c.name} />, sortValue: (c) => c.name, exportValue: (c) => c.name },
    { key: "jobs", label: "Jobs", weight: 6, info: [{ label: "Jobs", formula: "Jobs = cases with this Customer", text: "Cancelled jobs excluded. The table sorts by this, highest first." }],
      render: (c) => <span className="col-value">{c.jobs}</span>, sortValue: (c) => c.jobs },
    { key: "open", label: "In Progress", weight: 7, info: [{ label: "In Progress", formula: "In Progress = jobs not Completed / Done" }], render: (c) => <Txt>{c.open}</Txt>, sortValue: (c) => c.open },
    { key: "completed", label: "Completed", weight: 7, info: [{ label: "Completed", formula: "Completed = Jobs − In Progress" }], render: (c) => <Txt>{c.completed}</Txt>, sortValue: (c) => c.completed },
    { key: "rate", label: "Logged Worksheet", weight: 9, exportWidth: 16, info: [{ label: "Logged Worksheet", formula: "Logged ÷ Jobs × 100 (Logged = jobs with ≥ 1 worksheet)", text: "Red (0%) → green (100%)." }],
      render: (c) => <HeatPct value={pct(c.logged, c.jobs)}>{c.logged}/{c.jobs}</HeatPct>, sortValue: (c) => c.rate, exportValue: (c) => `${c.logged} of ${c.jobs} (${pct(c.logged, c.jobs)}%)` },
    { key: "hours", label: "Total Working Hours", weight: 9, info: [{ label: "Total Working Hours", formula: "Σ Total Working Hours (timesheets of this customer's jobs)" }],
      render: (c) => (c.hours ? <span className="col-value">{fmtNum(c.hours, 0)}</span> : <Txt>{null}</Txt>), sortValue: (c) => c.hours, exportValue: (c) => Math.round(c.hours) },
    { key: "visits", label: "Visits", weight: 6, info: [{ label: "Visits", formula: "Visits = worksheets on this customer's jobs" }],
      render: (c) => (c.visits ? <span className="col-value">{c.visits}</span> : <Txt>{null}</Txt>), sortValue: (c) => c.visits },
    { key: "days", label: "Visit Days", weight: 7, info: [{ label: "Visit Days", formula: "Σ (Visit End − Visit Start + 1) over the jobs' worksheets", text: "Visits missing a date are left out." }],
      render: (c) => (c.visitDays ? <span className="col-value">{c.visitDays}</span> : <Txt>{null}</Txt>), sortValue: (c) => c.visitDays },
    { key: "problem", label: "Top Problem Type", weight: 12, exportWidth: 24, info: [{ label: "Top Problem Type", formula: "Most frequent Problem Type on this customer's jobs" }],
      render: (c) => <Txt>{c.topProblem}</Txt>, sortValue: (c) => c.topProblem },
    { key: "regions", label: "Region", weight: 10, exportWidth: 24, render: (c) => <Txt>{c.regions.join(", ")}</Txt>, sortValue: (c) => c.regions.join(", "), exportValue: (c) => c.regions.join(", ") },
    { key: "last", label: "Last Job", weight: 8, info: [{ label: "Last Job", formula: "Last Job = Today − Created On of their newest job" }],
      render: (c) => <Txt>{c.lastJobDays === null ? null : `${c.lastJobDays}d ago`}</Txt>, sortValue: (c) => c.lastJobDays ?? Infinity, exportValue: (c) => c.lastJobDays ?? "" },
  ];

  const empty = (text) => <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0" }}>{text}</div>;

  return (
    <div className="report">
      {/* ── Total cases overview ── */}
      <KpiRow>
        <KpiCard label="Total Cases" value={fmtNum(r.live.length)} tone="accent" info="Live jobs (is_fsm), cancelled excluded." />
        <KpiCard label="Open" value={fmtNum(r.open.length)} info="Open jobs: not in a Completed / Done stage." />
        <KpiCard label="Completed" value={fmtNum(r.live.length - r.open.length)} tone="success" info="Live jobs whose stage is Completed / Done." />
        <KpiCard label="Total Service Engineers" value={fmtNum(serviceEngineerCount)} tone="warning" info="hr.employee records reporting to Samaresh Dey (the Service Manager)." />
        <KpiCard label="Assigned Engineers" value={fmtNum(r.engineers.length)} info="Of those, engineers with at least one case assigned to them." />
      </KpiRow>

      {/* ── Engineer's dashboard: treemap, ranking & visit analysis ── */}
      <SectionLabel>Engineer's Dashboard</SectionLabel>
      <Panel grow={false} style={{ marginBottom: 10 }} title={`${tmGroupLabel} · completed vs assigned`}
        info={[
          { label: "Tile size", formula: "Size = number of jobs (cancelled jobs excluded)", text: "Tiles group jobs by the picked dimension — Service Engineer, Customer or Region. A job with two engineers counts for each when grouped by engineer." },
          { label: "Tile colour & pointer", formula: "Completion % = Completed jobs / All jobs × 100", text: "Red at 0% → amber → green at 100%. Completed = stage name contains Completed or Done." },
          { label: "Tile details", formula: "Hours = Σ Total Working Hours on the tile's jobs", text: `Open = not completed; late = open and created more than ${LATE_DAYS} days ago; worksheets = jobs with at least one worksheet.` },
          { label: "Navigate", text: "Click a tile to list its jobs; click it again to go back to all. Switch the grouping with the dropdown. Year / Month / Customer / Problem Type filters apply to the treemap only." },
        ]}>
        <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <FilterSelect value={tmGroupBy} onChange={(v) => { setTmGroupBy(v); setTmKey(null); setTmPeek(null); }} options={GROUP_OPTIONS} prefix="Group by: " width={200} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: T.textMuted, padding: "6px 10px", borderRadius: 8, background: T.bgInput }}>
            {crumb(`All ${tmGroupPlural}`, () => setTmKey(null))}
            {tmSelectedLabel && <>›<span style={{ color: T.textPrimary, fontWeight: 600 }}>{tmSelectedLabel}</span></>}
          </div>
        </div>
        {(() => {
          const shown = tmPeek || tmItems.find((t) => t.key === tmKey);
          const levelJobs = tmItems.reduce((sum, t) => sum + t.value, 0);
          const levelDone = tmItems.reduce((sum, t) => sum + t.completed, 0);
          const point = shown || { label: `All ${tmGroupPlural}`, rate: pct(levelDone, levelJobs), completed: levelDone, value: levelJobs };
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
                {shown ? <><strong style={{ color: T.textPrimary }}>{shown.label}</strong>: {shown.completed} of {shown.value} completed ({shown.rate}%) · {shown.hint}{!tmPeek && tmKey ? " · Click this tile again to go back to all." : ""}</>
                  : <><strong style={{ color: T.textPrimary }}>{point.label}</strong>: {point.completed} of {point.value} cases completed ({point.rate}%). Hover or tab to a tile to move the pointer; click or press Enter to list its jobs.</>}
              </span>
            </div>
          );
        })()}
        <FilterBar count={tmCases.length} noun="job" filters={Object.values(jobFilters([fYear, setFYear], [fMonth, setFMonth], [fCustomer, setFCustomer], [fProblem, setFProblem]))} />
        {tmItems.length ? <Treemap items={tmItems} selectedKey={tmKey} onSelect={(k) => { setTmPeek(null); tmSelect(k); }} onPeek={setTmPeek} /> : empty("No jobs match these filters")}
      </Panel>
      {tmJobs.length > 0 && jobsTable(`${tmSelectedLabel} · ${plural(tmJobs.length, "job")} (${tmJobs.filter(isCompleted).length} completed)`, tmJobs, `field-service-jobs-${tmGroupBy}-${tmSelectedLabel}`, () => setTmKey(null), "adage_fsm_report_engineer_jobs_cols_v2")}

      {/* ── Engineer ranking & workload ── */}
      <div style={{ marginBottom: 10, marginTop: 18 }}>
        <DataTable
          title="Engineer Ranking & Workload"
          columns={engineerColumns}
          rows={r.engineers}
          storageKey="adage_fsm_report_engineer_ranking_cols_v2"
          defaultSort={{ key: "rate", dir: "desc" }}
          searchText={(e) => e.name}
          searchPlaceholder="Search engineer..."
          onRowClick={(e) => setRankEngineer((v) => (v === e.id ? null : e.id))}
          rowStyle={(e) => (e.id === rankEngineer ? { background: T.accentBg } : null)}
          exportName="field-service-engineer-ranking"
          maxHeight={420}
          emptyText="No engineers assigned."
          toolbar={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.textMuted }}>Click an engineer to see their jobs <InfoDot text={[
            { label: "Ranking", formula: "Report Rate = Worksheets logged / Jobs assigned", text: "Sorted highest rate first (lifetime); click the header again to see the lowest first." },
            { label: "Workload", formula: "Assigned = lifetime jobs · In Progress = jobs in flight now", text: "Assigned is their total-ever caseload; In Progress is what's actually on their plate today." },
            { label: "Unlogged Worksheet", formula: "Unlogged Worksheet = In Progress jobs with no worksheet", text: "Work done or in progress that hasn't been written up yet." },
            { label: "Last Logged In", formula: "Last Logged In = Today − date of latest worksheet", text: `Red when the engineer has never filed one, or the last was more than ${STUCK_DAYS} days ago.` },
            { label: "Sort & drill in", text: "Click any column header to re-sort, or click an engineer's row to list their jobs below." },
          ]} /></span>}
        />
      </div>
      {rankEngineer !== null && (() => {
        const e = r.engineers.find((x) => x.id === rankEngineer);
        if (!e) return null;
        const rows = r.live.filter((c) => c.engineerIds.includes(e.id));
        return jobsTable(`${e.name} · ${plural(rows.length, "job")} (${e.completed} completed, ${e.open} open, ${e.logged} with a worksheet)`, rows, `field-service-jobs-${e.name}`, () => setRankEngineer(null), "adage_fsm_report_engineer_jobs_cols_v2");
      })()}

      {/* ── Trends ── */}
      <ChartRow columns="minmax(0, 1.4fr) minmax(0, 1fr)">
        <Panel title="Monthly Trend · Cases Created" info={[
          { label: "Bars", formula: "Per month: jobs with ≥ 1 worksheet vs jobs with none", text: "Month = the job's Created On (else Odoo's create date). Last 12 months with data; cancelled jobs excluded." },
          { label: "Read-out", formula: "With-worksheet % = With / (With + Without) × 100", text: "Hover a month for its split; click it to list that month's jobs." },
        ]}>
          <MonthlyBars months={r.months} activeKey={trendMonth} onPick={(k) => setTrendMonth((v) => (v === k ? null : k))} />
        </Panel>
        <Panel title="How long open jobs have been waiting" info={[
          { label: "Who's counted", formula: "Open jobs with no worksheet yet", text: "Open = not in a Completed / Done / Cancelled stage." },
          { label: "Bands", formula: "Days waiting = Today − Created On", text: "Grouped 0–30, 31–60, 61–90 and 90+ days. Click a band to list its jobs." },
          { label: "Waiting longest", text: "The open job without a worksheet that was created earliest. Click its name to open it in Odoo." },
        ]}>
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

      {/* ── Customer insights ── */}
      <SectionLabel right={<ViewSwitch value={custView} onChange={setCustView} options={[{ value: "bar", label: "Bar Graph" }, { value: "grid", label: "Grid" }]} />}>Customer Insights</SectionLabel>
      {custView === "bar" && (() => {
        const m = CUSTOMER_METRICS.find((x) => x.value === custMetric);
        const partLabel = m.parts?.find((p) => p.key === custPart)?.label;
        return (
          <Panel grow={false} style={{ marginBottom: 10 }} title={`Top ${custTop} Customers · ${m.label}${partLabel ? ` · ${partLabel}` : ""}`}
            right={<div className="no-print" style={{ display: "flex", gap: 6 }}>
              <FilterSelect value={custMetric} onChange={(v) => { setCustMetric(v); setCustPart(null); }} options={CUSTOMER_METRICS} prefix="By: " width={200} />
              <FilterSelect value={custTop} onChange={setCustTop} options={[10, 15, 20].map((n) => ({ value: n, label: `Top ${n}` }))} width={90} />
            </div>}
            info={[
              { label: "Bars", text: "One bar per customer (the job's Customer field), largest first. Pick what to rank by and how many to show. Cancelled jobs excluded." },
              { label: "Jobs", formula: "Jobs = Completed + In Progress", text: "Click Completed or In progress above the bars to rank by only that; click it again for both." },
              { label: "Visits (Worksheets)", formula: "Jobs with ≥ 1 worksheet + jobs without one", text: "Click With worksheet or Without worksheet to rank by only that." },
              { label: "Visit Days", formula: "Σ (Visit End − Visit Start + 1) over the jobs' worksheets" },
              { label: "Working Hours", formula: "Σ Total Working Hours (timesheets of their jobs)" },
              { label: "Drill in", text: "Hover a bar for the customer's summary; click it to list their jobs." },
            ]}>
            <CustomerBars customers={r.customers} metric={custMetric} part={custPart} onPart={setCustPart} top={custTop} activeKey={custPick} onPick={(k) => setCustPick((v) => (v === k ? null : k))} />
          </Panel>
        );
      })()}
      {custView === "grid" && <div style={{ marginBottom: 10 }}>
        <DataTable
          title="Customer Insights"
          columns={customerColumns}
          rows={r.customers}
          storageKey="adage_fsm_report_customers_cols_v2"
          defaultSort={{ key: "jobs", dir: "desc" }}
          searchText={(c) => [c.name, c.topProblem, ...c.regions].join(" ")}
          searchPlaceholder="Search customer..."
          onRowClick={(c) => setCustPick((v) => (v === c.name ? null : c.name))}
          rowStyle={(c) => (c.name === custPick ? { background: T.accentBg } : null)}
          exportName="field-service-customers"
          maxHeight={420}
          emptyText="No jobs."
          toolbar={<TableHint text="Click a customer to see their jobs" info={[
            { label: "Customer", text: "The job's Customer field; jobs without one are grouped as No customer. Cancelled jobs excluded." },
            { label: "Sort", text: "Most jobs first; click any header to re-sort (e.g. by hours or Logged Worksheet)." },
          ]} />}
        />
      </div>}
      {custPick && (() => {
        const rows = r.live.filter((c) => (caseCustomer(c) || "No customer") === custPick);
        const done = rows.filter(isCompleted).length;
        return jobsTable(`${custPick} · ${plural(rows.length, "job")} (${done} completed, ${rows.length - done} open)`, rows, `field-service-customer-${custPick}`, () => setCustPick(null), "adage_fsm_report_engineer_jobs_cols_v2");
      })()}

      {/* ── Visit analysis ── */}
      <div style={{ marginBottom: 10, marginTop: 18 }}>
        <DataTable
          title="Visit Analysis by Engineer · most visit days first"
          columns={visitEngineerColumns}
          rows={visitByEngineer}
          storageKey="adage_fsm_report_visit_by_engineer_cols_v3"
          defaultSort={{ key: "days", dir: "desc" }}
          searchText={(e) => e.name}
          searchPlaceholder="Search engineer..."
          onRowClick={(e) => setVisitEngineer((v) => (v === e.id ? null : e.id))}
          rowStyle={(e) => (e.id === visitEngineer ? { background: T.accentBg } : null)}
          exportName="field-service-visits-by-engineer"
          maxHeight={420}
          emptyText="No worksheets yet."
          toolbar={<TableHint text="Click an engineer to see their jobs" info={[
            { label: "Total Days", formula: "Total Days = Σ (Visit End − Visit Start + 1)", text: "Per worksheet, both days counted. Visits missing a date are left out of the total." },
            { label: "Total Hours", formula: "Total Hours = Σ Total Working Hours", text: "From the engineer's own timesheets (Submitted By, else the job's Service Engineers)." },
            { label: "Problems Identified", formula: "Visits with ≥ 1 problem tag, of all Visits", text: "Red when none of their visits record a problem, green when all do." },
            { label: "Who a visit counts for", text: "The worksheet's Assigned Service Engineer, else the job's Service Engineers. Sorted most total visit days first; click a header to re-sort." },
          ]} />}
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
          subheader={<FilterBar count={visitRows.length} noun="worksheet" filters={visitFilters} />}
          columns={visitColumns}
          rows={visitRows}
          storageKey="adage_fsm_report_visits_cols_v3"
          searchText={(w) => [w.case?.name, caseCustomer(w.case), ...w.problems, ...w.spares, w.x_studio_resolution_applied, engineerNames(wsEngineers(w), userMap).join(" ")].join(" ")}
          searchPlaceholder="Search problems, resolutions..."
          onRowClick={(w) => openCase(w.case || { id: w.caseId })}
          exportName="field-service-problems-resolutions"
          maxHeight={420}
          emptyText="No worksheet has a problem or resolution recorded."
          toolbar={<TableHint text="Click a row to open the job in Odoo" info={[
            { label: "Rows shown", formula: "Worksheets with ≥ 1 problem tag OR a Resolution Applied", text: "Worksheets with neither are hidden." },
            { label: "Filters", text: "Engineer matches the worksheet's engineer (Assigned Service Engineer, else the job's Service Engineers). Year, Month, Customer and Problem Type work like the treemap's: they match the worksheet's job (its Created On, customer and Problem Type)." },
            { label: "Columns", text: "Problems Identified and Spare Parts Used are the worksheet's tags; Resolution Applied is the engineer's own text (hover to read it in full)." },
            { label: "Engineer", text: "The worksheet's Assigned Service Engineer, else the job's Service Engineers." },
          ]} />}
        />
      </div>

      {/* ── Problem & service types (hidden for now: set SHOW_TYPE_DONUTS = true to bring back), next steps ── */}
      {SHOW_TYPE_DONUTS && <SectionLabel>Problem Types &amp; Service Types</SectionLabel>}
      {SHOW_TYPE_DONUTS && <ChartRow columns="minmax(0, 1fr) minmax(0, 1fr)">
        <InteractiveDonut title="Problem Types" infoText={[
          { label: "Slices", formula: "Slice = jobs with that Problem Type", text: "From the job's Problem Type field; empty = Not set. Cancelled jobs excluded." },
          { label: "Other", text: "The top 4 types are shown; the rest are grouped as Other. Click Other to see what's inside." },
        ]} centerLabel="jobs" unit="jobs" segments={topWithOther(r.problemTypes)} />
        <InteractiveDonut title="Service Type" infoText={[
          { label: "Slices", formula: "Slice = worksheets with that Service Type", text: "The Service Type picked on each Service Call Worksheet; empty = Not set." },
          { label: "Other", text: "The top 4 types are shown; the rest are grouped as Other. Click Other to see what's inside." },
        ]} centerLabel="worksheets" unit="worksheets" segments={topWithOther(serviceTypes)} />
      </ChartRow>}
      {/* ── Next steps ── */}
      <div className="card report-avoid-break" style={{ padding: "14px 18px", marginBottom: 10, marginTop: 18, background: T.accentBg, border: `1px solid ${T.accentBdr}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.accent, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
          Next Steps
          <InfoDot text={[
            { label: "Late jobs", formula: `Open AND Today − Created On > ${LATE_DAYS} days` },
            { label: "Stuck jobs", formula: `Open AND Today − Last stage change ≥ ${STUCK_DAYS} days` },
            { label: "Never-reported engineers", formula: "Assigned ≥ 3 AND Worksheets logged = 0" },
            { label: "Recurring problem", formula: "Same customer + same problem tag on ≥ 2 jobs" },
            { label: "Order", text: "Most urgent first; the top 3 are shown. Take Action lists the jobs (or engineers) behind each line." },
          ]} />
        </div>
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
                  title={`Next step · ${plural(a.engineers.length, "engineer")} with 3+ jobs and no worksheet`}
                  columns={engineerColumns}
                  rows={a.engineers}
                  storageKey="adage_fsm_report_action_silent_cols_v3"
                  defaultSort={{ key: "assigned", dir: "desc" }}
                  searchText={(e) => e.name}
                  searchPlaceholder="Search engineer..."
                  onRowClick={(e) => setActionEngineer((v) => (v === e.id ? null : e.id))}
                  rowStyle={(e) => (e.id === actionEngineer ? { background: T.accentBg } : null)}
                  exportName="field-service-action-silent"
                  maxHeight={360}
                  toolbar={<>
                    <TableHint text="Click an engineer to see their jobs" info={[
                      { label: "Who's listed", formula: "Assigned ≥ 3 AND Worksheets logged = 0", text: "Engineers with three or more jobs who have never filed a worksheet." },
                      { label: "Columns", text: "Same as Engineer Ranking & Workload: Assigned = lifetime jobs, Open = jobs in flight, Backlog = open jobs with no worksheet." },
                    ]} />
                    <button className="no-print" onClick={() => setExpandedAction(null)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>✕ Close</button>
                  </>}
                />
              </div>
              {picked && jobsTable(`${picked.name} · ${plural(pickedJobs.length, "assigned job")} (${picked.open} open, no worksheet filed)`, pickedJobs, `field-service-jobs-${picked.name}`, () => setActionEngineer(null), "adage_fsm_report_engineer_jobs_cols_v2")}
            </>
          );
        }
        return a && jobsTable(`Next step · ${plural(a.rows.length, "job")} to act on`, a.rows, `field-service-action-${a.id}`, () => setExpandedAction(null), `adage_fsm_report_action_${a.id}_cols_v1`);
      })()}
    </div>
  );
}
