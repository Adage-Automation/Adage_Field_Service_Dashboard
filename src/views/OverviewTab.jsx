import { useMemo, useState, useRef } from "react";
import { T } from "../constants/theme";
import { PERSON_COLORS, STAGE_PILL } from "../constants/colors";
import { FLAG, tally, AGE_BUCKETS, ageBucketOf, engineerStats } from "../lib/derive";
import {
  KpiCard, KpiRow, BarList, InteractiveDonut, DataTable, ChartRow, Stack, Panel, SplitBar, InsightsCard, ColumnChart, MiniStack,
  Avatar, Pill, pct, plural, MultiSelect, FilterSelect, FilterChip, TitleCell, Txt, fmtNum,
} from "../components/ui";
import {
  caseCustomer, caseEndUser, engineerNames, EngineerPills, StagePill, TagPill, CountBadge, FlagCell, flagExport,
  FLAG_META, flagCaseColumns, openCase, odooLinkCell, fmtDay, isoDay, SectionLabel,
} from "./shared";

const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS[m - 1]} '${String(y).slice(2)}`; };
const LOGGED = T.success;
const UNLOGGED = "#F59E0B";

// ─── Overview tab ─────────────────────────────────────────────────────────────
export function OverviewTab({ model, userMap }) {
  const { cases, worksheets } = model;
  const [loggedFilter, setLoggedFilter] = useState("all");
  const [filterRegion, setFilterRegion] = useState([]);
  const [filterStage, setFilterStage] = useState([]);
  const [filterCallType, setFilterCallType] = useState([]);
  const [filterEngineer, setFilterEngineer] = useState(null);
  const [filterMonth, setFilterMonth] = useState(null);
  const [filterAge, setFilterAge] = useState(null);
  const flaggedRef = useRef(null);
  const recordsRef = useRef(null);
  const scrollTo = (ref) => setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);

  // ── Headline numbers ──
  const logged = cases.filter((c) => c.hasWorksheet).length;
  const loggedPct = pct(logged, cases.length);
  const openCases = cases.filter((c) => c.isOpen);
  const backlog = cases.filter((c) => c.backlog);
  const completedUnlogged = cases.filter((c) => !c.isOpen && !c.hasWorksheet);
  const flagged = useMemo(() => cases.filter((c) => c.flagged), [cases]);
  const flaggedNoMom = flagged.filter((c) => c.flag === FLAG.NO_MOM).length;
  const flaggedNoWs = flagged.length - flaggedNoMom;
  const stageCounts = useMemo(() => {
    const m = {};
    cases.forEach((c) => { const s = c.stage_id?.[1] || "No Stage"; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [cases]);

  // ── Per-engineer workload & compliance ──
  const people = useMemo(() => engineerStats(cases, userMap), [cases, userMap]);
  const colorOf = useMemo(() => {
    const byAssigned = [...people].sort((a, b) => b.assigned - a.assigned);
    return Object.fromEntries(byAssigned.map((p, i) => [p.id, PERSON_COLORS[i % PERSON_COLORS.length]]));
  }, [people]);
  const totalAssignments = people.reduce((s, p) => s + p.assigned, 0);

  // ── Monthly trend (cases created per month, logged vs not) — last 12 months with data ──
  const months = useMemo(() => {
    const m = {};
    cases.forEach((c) => {
      if (!c.createdISO) return;
      const k = c.createdISO.slice(0, 7);
      if (!m[k]) m[k] = { logged: 0, unlogged: 0 };
      if (c.hasWorksheet) m[k].logged += 1; else m[k].unlogged += 1;
    });
    return Object.keys(m).sort().slice(-12).map((k) => ({
      key: k, label: monthLabel(k),
      parts: [
        { key: "logged", label: "Logged", value: m[k].logged, color: LOGGED },
        { key: "unlogged", label: "Not logged", value: m[k].unlogged, color: UNLOGGED },
      ],
    }));
  }, [cases]);

  // ── Backlog aging (open cases with no worksheet, by age since created) ──
  const agingItems = AGE_BUCKETS.map((b) => ({
    key: b.key, label: b.key, color: b.color,
    value: backlog.filter((c) => ageBucketOf(c.ageDays) === b.key).length,
  }));
  const oldestBacklog = [...backlog].sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))[0];

  // ── Region logging ──
  const regionItems = useMemo(() => {
    const m = {};
    cases.forEach((c) => {
      const r = c.x_studio_regions || "No region";
      if (!m[r]) m[r] = { total: 0, logged: 0 };
      m[r].total += 1;
      if (c.hasWorksheet) m[r].logged += 1;
    });
    return Object.entries(m)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([r, v]) => ({
        key: r, label: r, value: v.total,
        color: pct(v.logged, v.total) >= 50 ? LOGGED : pct(v.logged, v.total) >= 25 ? UNLOGGED : T.danger,
        sub: `${v.logged} logged · ${v.total - v.logged} not logged · ${pct(v.logged, v.total)}% logging rate`,
        rate: v.total ? v.logged / v.total : 0, total: v.total,
      }));
  }, [cases]);

  const rankingItems = [...people]
    .sort((a, b) => b.rate - a.rate || b.worksheets - a.worksheets || b.assigned - a.assigned || a.name.localeCompare(b.name))
    .map((p) => ({
      key: p.id, label: p.name, value: p.rate, max: 1, color: colorOf[p.id],
      sub: `${p.logged} of ${p.assigned} cases logged · ${plural(p.worksheets, "worksheet")}${p.lastLogged ? ` · last ${p.lastLoggedDays}d ago` : ""}`,
    }));

  // ── Key insights (generated from the numbers above) ──
  const insights = useMemo(() => {
    const out = [];
    if (cases.length) {
      out.push({
        tone: loggedPct >= 70 ? "good" : loggedPct >= 40 ? "warn" : "bad",
        title: `${loggedPct}% of cases have a worksheet`,
        text: `${logged} of ${cases.length} cases are logged in Odoo. ${backlog.length} open and ${completedUnlogged.length} completed cases have none.`,
        onClick: () => { setLoggedFilter("not_logged"); scrollTo(recordsRef); },
      });
    }
    if (completedUnlogged.length) {
      out.push({
        tone: "bad",
        title: `${plural(completedUnlogged.length, "completed case")} never logged`,
        text: "The work is marked completed but there's no service worksheet. These reports are missing for the customer and for billing.",
        onClick: () => { setLoggedFilter("not_logged"); setFilterStage(uniq(completedUnlogged.map((c) => c.stage_id?.[1]))); scrollTo(recordsRef); },
      });
    }
    const topBacklog = [...people].sort((a, b) => b.backlog - a.backlog)[0];
    if (topBacklog?.backlog > 0) {
      out.push({
        tone: "warn",
        title: `Largest unlogged backlog: ${topBacklog.name}`,
        text: `${plural(topBacklog.backlog, "open case")} with no worksheet${topBacklog.oldestBacklog ? `, the oldest ${topBacklog.oldestBacklog} days old` : ""}. ${topBacklog.logged} of ${topBacklog.assigned} assigned cases logged.`,
        onClick: () => { setFilterEngineer(topBacklog.id); setLoggedFilter("not_logged"); scrollTo(recordsRef); },
      });
    }
    const zero = people.filter((p) => p.assigned >= 3 && p.logged === 0).sort((a, b) => b.assigned - a.assigned);
    if (zero.length) {
      out.push({
        tone: "bad",
        title: `${plural(zero.length, "engineer")} with 3+ cases ${zero.length === 1 ? "has" : "have"} logged nothing`,
        text: zero.slice(0, 4).map((p) => `${p.name} (${p.assigned})`).join(", ") + (zero.length > 4 ? ` and ${zero.length - 4} more` : "") + ".",
      });
    }
    const old = backlog.filter((c) => (c.ageDays ?? 0) > 60);
    if (old.length && oldestBacklog) {
      out.push({
        tone: "warn",
        title: `${plural(old.length, "open case")} unlogged for 60+ days`,
        text: `Oldest: “${oldestBacklog.name}” (${caseCustomer(oldestBacklog) || "no customer"}), ${oldestBacklog.ageDays} days since it was created.`,
        onClick: () => { setFilterAge("61–90 days"); setLoggedFilter("all"); scrollTo(recordsRef); },
      });
    }
    if (flagged.length) {
      out.push({
        tone: "bad",
        title: `${plural(flagged.length, "record")} with mismatched paperwork`,
        text: `${flaggedNoMom} have a worksheet but no MoM; ${flaggedNoWs} have a MoM / document but no worksheet.`,
        onClick: () => scrollTo(flaggedRef),
      });
    }
    const best = [...people].filter((p) => p.assigned >= 3).sort((a, b) => b.rate - a.rate || b.worksheets - a.worksheets)[0];
    if (best && best.rate > 0) {
      out.push({
        tone: "good",
        title: `Best logging discipline: ${best.name}`,
        text: `${best.logged} of ${best.assigned} cases logged (${Math.round(best.rate * 100)}%), ${plural(best.worksheets, "worksheet")} filed${best.lastLogged ? `, last one ${best.lastLoggedDays} days ago` : ""}.`,
        onClick: () => { setFilterEngineer(best.id); scrollTo(recordsRef); },
      });
    }
    const weakRegion = regionItems.filter((r) => r.total >= 5).sort((a, b) => a.rate - b.rate)[0];
    if (weakRegion) {
      out.push({
        tone: weakRegion.rate < 0.25 ? "bad" : "info",
        title: `Lowest logging region: ${weakRegion.key}`,
        text: `${Math.round(weakRegion.rate * 100)}% of its ${weakRegion.total} cases have a worksheet.`,
        onClick: () => { setFilterRegion([weakRegion.key]); scrollTo(recordsRef); },
      });
    }
    return out.slice(0, 6);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, people, regionItems, flagged]);

  // ── All-records list filters ──
  const regionOptions = useMemo(() => uniq(cases.map((c) => c.x_studio_regions)), [cases]);
  const stageOptions = useMemo(() => uniq(cases.map((c) => c.stage_id?.[1])), [cases]);
  const callTypeOptions = useMemo(() => uniq(cases.map((c) => c.x_studio_call_type)), [cases]);

  const rows = useMemo(() => cases.filter((c) => {
    if (loggedFilter === "logged" && !c.hasWorksheet) return false;
    if (loggedFilter === "not_logged" && c.hasWorksheet) return false;
    if (loggedFilter === "backlog" && !c.backlog) return false;
    if (filterRegion.length && !filterRegion.includes(c.x_studio_regions)) return false;
    if (filterStage.length && !filterStage.includes(c.stage_id?.[1])) return false;
    if (filterCallType.length && !filterCallType.includes(c.x_studio_call_type)) return false;
    if (filterEngineer && !c.engineerIds.includes(filterEngineer)) return false;
    if (filterMonth && c.createdISO.slice(0, 7) !== filterMonth) return false;
    if (filterAge && !(c.backlog && ageBucketOf(c.ageDays) === filterAge)) return false;
    return true;
  }), [cases, loggedFilter, filterRegion, filterStage, filterCallType, filterEngineer, filterMonth, filterAge]);

  const columns = [
    { key: "created", label: "Created On", weight: 9, exportWidth: 14,
      info: "The case's Created On date (or Odoo's creation date when empty). The grey line underneath shows the case's age in days.",
      render: (c) => (
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Txt>{fmtDay(c.createdISO)}</Txt>
          {c.ageDays !== null && <span style={{ fontSize: 10, color: c.backlog && c.ageDays > 60 ? T.danger : T.textMuted }}>{c.ageDays} days old</span>}
        </div>
      ),
      sortValue: (c) => c.createdISO, exportValue: (c) => c.createdISO },
    { key: "case", label: "Case", weight: 22, exportWidth: 44,
      info: "Field Service task title. The grey line underneath shows Control No. · SCRN.",
      render: (c) => <TitleCell title={c.name} sub={[c.x_studio_control_no, c.x_studio_scrn].filter(Boolean).join(" · ") || null} />,
      sortValue: (c) => c.name, exportValue: (c) => c.name },
    { key: "customer", label: "Customer", weight: 13, exportWidth: 32, render: (c) => <Txt>{caseCustomer(c)}</Txt>, sortValue: caseCustomer },
    { key: "enduser", label: "End User", weight: 11, exportWidth: 28, render: (c) => <Txt>{caseEndUser(c)}</Txt>, sortValue: caseEndUser },
    { key: "region", label: "Region", weight: 9, render: (c) => <TagPill value={c.x_studio_regions} />, sortValue: (c) => c.x_studio_regions || "" },
    { key: "problem", label: "Problem Type", weight: 10, exportWidth: 22, render: (c) => <Txt>{c.x_studio_problem_type}</Txt>, sortValue: (c) => c.x_studio_problem_type || "" },
    { key: "engineers", label: "Service Engineers", weight: 13, exportWidth: 32,
      info: "People in the case's Service Engineers field. These are the assigned persons used for every per-engineer count.",
      render: (c) => <EngineerPills ids={c.engineerIds} userMap={userMap} />,
      sortValue: (c) => engineerNames(c.engineerIds, userMap).join(", "), exportValue: (c) => engineerNames(c.engineerIds, userMap).join(", ") },
    { key: "stage", label: "Stage", weight: 9, info: "Odoo stage of the task (In Progress / Completed).",
      render: (c) => <StagePill stage={c.stage_id?.[1]} />, sortValue: (c) => c.stage_id?.[1] || "" },
    { key: "ws", label: "Worksheets", weight: 7,
      info: "Number of Service Call Worksheets on the case. 1 or more means the case is logged.",
      render: (c) => <CountBadge n={c.worksheets.length} />, sortValue: (c) => c.worksheets.length },
    { key: "mom", label: "MoM", weight: 8, exportWidth: 22,
      info: "Type of MoM recorded on the case: AMC = MoM (AMC), C = MoM Commissioning. Hover a tag for the number of entries.",
      render: (c) => (c.momTypes.length ? (
        <div style={{ display: "flex", gap: 3 }}>
          {c.momAmc.length > 0 && <Pill color="#02818A" title={`${c.momAmc.length} MoM (AMC) entr${c.momAmc.length === 1 ? "y" : "ies"}`}>AMC</Pill>}
          {c.momComm.length > 0 && <Pill color="#7C3AED" title={`${c.momComm.length} MoM Commissioning entr${c.momComm.length === 1 ? "y" : "ies"}`}>C</Pill>}
        </div>
      ) : <Txt>{null}</Txt>),
      sortValue: (c) => c.momTypes.join(" + "), exportValue: (c) => c.momTypes.join(" + ") },
    { key: "hours", label: "Hours", weight: 6,
      info: "Sum of Total Working Hours across the case's timesheets.",
      render: (c) => (c.hours ? <span className="col-value">{fmtNum(c.hours, 1)}</span> : <Txt>{null}</Txt>), sortValue: (c) => c.hours },
    { key: "flag", label: "Doc Check", weight: 12, exportWidth: 60,
      info: "⚑ No MoM: a worksheet is filled but no MoM is recorded.\n⚑ No Worksheet: a MoM or other document (Commissioning Certificate, Documents section) is recorded but no worksheet.\n✓ OK: consistent.\nNot started: neither yet. Hover a flag to see the reason.",
      render: (c) => <FlagCell c={c} showReason={false} />,
      sortValue: (c) => (c.flag === "no_mom" ? 0 : c.flag === "no_worksheet" ? 1 : c.hasWorksheet ? 3 : 2), exportValue: flagExport },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (c) => odooLinkCell(c.id), exportWidth: 14 },
  ];

  // ── Engineer workload table ──
  const workloadColumns = [
    { key: "name", label: "Service Engineer", weight: 20, exportWidth: 30,
      render: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Avatar name={p.name} color={colorOf[p.id]} size={26} />
          <span className="opp-title" title={p.name}>{p.name}</span>
        </div>
      ),
      sortValue: (p) => p.name },
    { key: "assigned", label: "Assigned", weight: 7, info: "Cases where this person is in Service Engineers.",
      render: (p) => <span className="col-value">{p.assigned}</span>, sortValue: (p) => p.assigned },
    { key: "open", label: "Open", weight: 6, info: "Assigned cases not yet in a Completed stage.",
      render: (p) => <Txt>{p.open}</Txt>, sortValue: (p) => p.open },
    { key: "completed", label: "Completed", weight: 7, info: "Assigned cases in a Completed stage.",
      render: (p) => <Txt>{p.completed}</Txt>, sortValue: (p) => p.completed },
    { key: "rate", label: "Logging Rate", weight: 15, exportWidth: 14,
      info: "Share of assigned cases that have at least one worksheet. Green = logged, amber = not logged.",
      render: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1 }}><MiniStack parts={[{ label: "Logged", value: p.logged, color: LOGGED }, { label: "Not logged", value: p.assigned - p.logged, color: UNLOGGED }]} /></div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: p.rate >= 0.7 ? T.success : p.rate >= 0.4 ? T.warning : T.danger, width: 34, textAlign: "right" }}>{Math.round(p.rate * 100)}%</span>
        </div>
      ),
      sortValue: (p) => p.rate, exportValue: (p) => `${Math.round(p.rate * 100)}%` },
    { key: "backlog", label: "Unlogged Backlog", weight: 10,
      info: "Open cases with no worksheet yet: the engineer's to-do list. The grey line shows the oldest one's age.",
      render: (p) => (p.backlog ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span><Pill color={T.warning} bg={T.warningBg}>{p.backlog} open</Pill></span>
          {p.oldestBacklog !== null && <span style={{ fontSize: 10, color: p.oldestBacklog > 60 ? T.danger : T.textMuted }}>oldest {p.oldestBacklog}d</span>}
        </div>
      ) : <Pill color={T.success} bg={T.successBg}>clear</Pill>),
      sortValue: (p) => p.backlog, exportValue: (p) => p.backlog },
    { key: "doneUnlogged", label: "Done, No Worksheet", weight: 9,
      info: "Cases already Completed that never got a worksheet: missing service reports.",
      render: (p) => (p.completedUnlogged ? <Pill color={T.danger} bg={T.dangerBg}>{p.completedUnlogged}</Pill> : <Txt>{0}</Txt>),
      sortValue: (p) => p.completedUnlogged },
    { key: "flagged", label: "Flagged", weight: 6, info: "Cases with a paperwork mismatch (worksheet without MoM, or MoM/document without worksheet).",
      render: (p) => (p.flagged ? <Pill color={T.danger} bg={T.dangerBg}>⚑ {p.flagged}</Pill> : <Txt>{0}</Txt>), sortValue: (p) => p.flagged },
    { key: "hours", label: "Hours", weight: 6, info: "Timesheet working hours on the engineer's cases.",
      render: (p) => (p.hours ? <span className="col-value">{fmtNum(p.hours, 0)}</span> : <Txt>{null}</Txt>), sortValue: (p) => p.hours },
    { key: "last", label: "Last Logged", weight: 9, exportWidth: 14,
      info: "When the engineer's most recent worksheet was created in Odoo. A recent date means they log regularly.",
      render: (p) => (p.lastLogged ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Txt>{fmtDay(p.lastLogged)}</Txt>
          <span style={{ fontSize: 10, color: p.lastLoggedDays > 60 ? T.danger : T.textMuted }}>{p.lastLoggedDays}d ago</span>
        </div>
      ) : <span style={{ fontSize: 11, color: T.danger, fontWeight: 600 }}>Never</span>),
      sortValue: (p) => p.lastLogged, exportValue: (p) => p.lastLogged || "Never" },
  ];

  // ── Flagged table ──
  const flaggedColumns = [
    ...flagCaseColumns(userMap),
    { key: "ws", label: "Worksheets", weight: 8, info: "Number of Service Call Worksheets on the case.",
      render: (c) => <CountBadge n={c.worksheets.length} />, sortValue: (c) => c.worksheets.length },
    { key: "docs", label: "MoM / Docs", weight: 10,
      info: "MoM (AMC) + MoM Commissioning rows. \"+N other\" counts other documents (Commissioning Certificate, Documents section).",
      render: (c) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CountBadge n={c.momAmc.length + c.momComm.length} color="#7C3AED" bg="#EDE9FE" />
          {c.certs.length + c.docSection.length > 0 && <span style={{ fontSize: 10, color: T.textMuted }}>+{c.certs.length + c.docSection.length} other</span>}
        </div>
      ),
      sortValue: (c) => c.docCount, exportValue: (c) => c.docTypes.join(", ") },
    { key: "created", label: "Created On", weight: 9, exportWidth: 14,
      render: (c) => <Txt>{fmtDay(c.createdISO)}</Txt>, sortValue: (c) => c.createdISO },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (c) => odooLinkCell(c.id), exportWidth: 14 },
  ];

  const statusItems = useMemo(
    () => stageCounts.map(([s, n]) => ({ key: s, label: s, value: n, color: STAGE_PILL[s]?.color || "#94A3B8" })),
    [stageCounts],
  );

  const anyFilter = loggedFilter !== "all" || filterRegion.length || filterStage.length || filterCallType.length || filterEngineer || filterMonth || filterAge;
  const clearAll = () => { setLoggedFilter("all"); setFilterRegion([]); setFilterStage([]); setFilterCallType([]); setFilterEngineer(null); setFilterMonth(null); setFilterAge(null); };

  return (
    <div>
      <KpiRow>
        <KpiCard label="Total Cases" value={fmtNum(cases.length)} tone="accent"
          info="Every Field Service task (project.task with Field Service enabled) recorded in Odoo."
          sub={stageCounts.map(([s, n]) => `${s} ${n}`).join(" · ") || null} />
        <KpiCard label="Logged Cases" value={`${fmtNum(logged)}`} tone="success"
          info="Cases with at least one Service Call Worksheet filled in by the service engineer. Click to filter the list."
          sub={`${loggedPct}% logging rate · ${fmtNum(worksheets.length)} worksheets`}
          onClick={() => { setLoggedFilter((v) => (v === "logged" ? "all" : "logged")); scrollTo(recordsRef); }} active={loggedFilter === "logged"} />
        <KpiCard label="Unlogged Backlog" value={fmtNum(backlog.length)} tone="warning"
          info="Open cases (not completed) with no worksheet yet. This is the work still to be reported. Click to list them."
          sub={`of ${openCases.length} open cases${oldestBacklog?.ageDays != null ? ` · oldest ${oldestBacklog.ageDays}d` : ""}`}
          onClick={() => { setLoggedFilter((v) => (v === "backlog" ? "all" : "backlog")); scrollTo(recordsRef); }} active={loggedFilter === "backlog"} />
        <KpiCard label="Done, No Worksheet" value={fmtNum(completedUnlogged.length)} tone="danger"
          info="Completed cases that never got a worksheet. The service report is missing. Click to list them."
          sub={`${pct(completedUnlogged.length, cases.length - openCases.length)}% of completed cases`}
          onClick={() => { setLoggedFilter("not_logged"); setFilterStage(uniq(completedUnlogged.map((c) => c.stage_id?.[1]))); scrollTo(recordsRef); }} />
        <KpiCard label="Flagged Records" value={fmtNum(flagged.length)} tone="danger"
          info="Cases whose paperwork doesn't match: a worksheet without a MoM, or a MoM / document without a worksheet. Click to jump to the flagged table."
          sub={`${flaggedNoMom} no MoM · ${flaggedNoWs} no worksheet`}
          onClick={() => scrollTo(flaggedRef)} />
        <KpiCard label="Engineers" value={fmtNum(people.length)}
          info="Distinct people in the cases' Service Engineers field."
          sub={`${fmtNum(totalAssignments)} assignments · ${fmtNum(people.length ? totalAssignments / people.length : 0, 1)} cases each`} />
      </KpiRow>

      <InsightsCard insights={insights} />

      <ChartRow columns="minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr)">
        <Panel title="Monthly Trend · Cases Created" info="Cases per month (by Created On), split into logged (worksheet filed) and not logged. Click a month to filter the list; click again to clear.">
          <ColumnChart
            columns={months}
            height={200}
            legend={[{ label: "Logged", color: LOGGED }, { label: "Not logged", color: UNLOGGED }]}
            activeKey={filterMonth}
            onColumnClick={(k) => { setFilterMonth((v) => (v === k ? null : k)); scrollTo(recordsRef); }}
          />
        </Panel>
        <Panel title="Unlogged Backlog · Aging" info="Open cases with no worksheet, grouped by how long ago they were created. Older = more overdue reporting. Click a bar to list those cases.">
          <BarList items={agingItems} formatValue={(v) => plural(v, "case")}
            onItemClick={(k) => { setFilterAge((v) => (v === k ? null : k)); scrollTo(recordsRef); }} activeKey={filterAge} />
          {oldestBacklog && (
            <div style={{ marginTop: 14, padding: "8px 10px", borderRadius: 8, background: T.bgCardAlt, border: `1px solid ${T.border}`, fontSize: 11, color: T.textSecondary, lineHeight: 1.45 }}>
              Oldest open case without a worksheet: <strong style={{ color: T.textPrimary }}>{oldestBacklog.name}</strong>
              {" · "}{oldestBacklog.ageDays} days · {engineerNames(oldestBacklog.engineerIds, userMap).join(", ") || "unassigned"}
            </div>
          )}
        </Panel>
        <Stack>
          <InteractiveDonut
            grow={false}
            title="Worksheet Logging"
            infoText="Logged = the case has at least one worksheet. Click a segment to filter the list below."
            centerLabel="cases"
            unit="cases"
            segments={[
              { key: "logged", displayKey: "Logged", value: logged, color: LOGGED },
              { key: "not_logged", displayKey: "Not logged", value: cases.length - logged, color: UNLOGGED },
            ]}
            activeKey={loggedFilter === "logged" || loggedFilter === "not_logged" ? loggedFilter : null}
            onSegmentClick={(k) => { setLoggedFilter((v) => (v === k ? "all" : k)); scrollTo(recordsRef); }}
          />
          <Panel title="Case Status" info="Cases per Odoo stage (the Stage column).">
            <SplitBar parts={statusItems} />
            <div style={{ height: 10 }} />
            <BarList items={statusItems} maxHeight={90} formatValue={(v) => `${v}`} />
          </Panel>
        </Stack>
      </ChartRow>

      <SectionLabel>Engineer Workload &amp; Logging Compliance</SectionLabel>
      <DataTable
        title="Engineers"
        columns={workloadColumns}
        rows={people}
        defaultSort={{ key: "backlog", dir: "desc" }}
        storageKey="adage_fsm_workload_cols_v1"
        searchText={(p) => p.name}
        searchPlaceholder="Search engineer..."
        onRowClick={(p) => { setFilterEngineer((v) => (v === p.id ? null : p.id)); scrollTo(recordsRef); }}
        rowStyle={(p) => (filterEngineer === p.id ? { background: T.accentBg } : null)}
        exportName="field-service-engineer-workload"
        maxHeight={360}
      />

      <ChartRow columns="minmax(0, 1fr) minmax(0, 1fr)" style={{ marginTop: 10 }}>
        <Panel title="Logging Ranking · Worksheets on Odoo" info="Ranked by logging rate: the share of an engineer's assigned cases that have at least one worksheet in Odoo. Ties go to whoever filed more worksheets. The note shows how recently they last logged.">
          <BarList items={rankingItems} showRank maxHeight={330} formatValue={(v) => `${Math.round(v * 100)}%`}
            onItemClick={(id) => { setFilterEngineer((v) => (v === id ? null : id)); scrollTo(recordsRef); }} activeKey={filterEngineer} />
        </Panel>
        <Panel title="Cases by Region · Logging Rate" info="Cases per region. Bar colour shows the logging rate: green ≥ 50%, amber 25–49%, red < 25%. Click a region to filter the list.">
          <BarList items={regionItems} maxHeight={330} formatValue={(v) => plural(v, "case")}
            onItemClick={(k) => { setFilterRegion((v) => (v.length === 1 && v[0] === k ? [] : [k])); scrollTo(recordsRef); }}
            activeKey={filterRegion.length === 1 ? filterRegion[0] : null} />
        </Panel>
      </ChartRow>

      <div ref={flaggedRef} style={{ scrollMarginTop: 72 }}>
        <SectionLabel right={
          <span style={{ display: "flex", gap: 6 }}>
            <span className="pill" style={{ background: FLAG_META.no_mom.bg, color: FLAG_META.no_mom.color }}>⚑ No MoM {flaggedNoMom}</span>
            <span className="pill" style={{ background: FLAG_META.no_worksheet.bg, color: FLAG_META.no_worksheet.color }}>⚑ No Worksheet {flaggedNoWs}</span>
          </span>
        }>
          Flagged Records
        </SectionLabel>
      </div>
      <DataTable
        title="Flagged · Paperwork Mismatch"
        columns={flaggedColumns}
        rows={flagged}
        storageKey="adage_fsm_overview_flagged_cols_v1"
        searchText={(c) => [c.name, caseCustomer(c), c.flagReason, engineerNames(c.engineerIds, userMap).join(" ")].join(" ")}
        searchPlaceholder="Search flagged..."
        onRowClick={openCase}
        exportName="field-service-flagged"
        rowStyle={(c) => ({ boxShadow: `inset 3px 0 0 ${FLAG_META[c.flag].color}` })}
        emptyText="No flagged records. Every case's worksheet and MoM line up 🎉"
        maxHeight={340}
      />

      <div ref={recordsRef} style={{ scrollMarginTop: 72 }}>
        <SectionLabel>All Records</SectionLabel>
      </div>
      {anyFilter ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textMuted }}>Filtered by:</span>
          {loggedFilter !== "all" && <FilterChip label={{ logged: "Logged", not_logged: "Not logged", backlog: "Unlogged backlog (open)" }[loggedFilter]} color={loggedFilter === "logged" ? T.success : T.warning} onClear={() => setLoggedFilter("all")} />}
          {filterEngineer && <FilterChip label={`Engineer: ${userMap[filterEngineer] || filterEngineer}`} onClear={() => setFilterEngineer(null)} />}
          {filterMonth && <FilterChip label={`Created: ${monthLabel(filterMonth)}`} onClear={() => setFilterMonth(null)} />}
          {filterAge && <FilterChip label={`Backlog age: ${filterAge}`} color={T.warning} onClear={() => setFilterAge(null)} />}
          {filterRegion.length > 0 && <FilterChip label={`Region: ${filterRegion.join(", ")}`} onClear={() => setFilterRegion([])} />}
          {filterStage.length > 0 && <FilterChip label={`Stage: ${filterStage.join(", ")}`} onClear={() => setFilterStage([])} />}
          {filterCallType.length > 0 && <FilterChip label={`Call Type: ${filterCallType.join(", ")}`} onClear={() => setFilterCallType([])} />}
          <button onClick={clearAll} style={{ padding: "3px 10px", borderRadius: 100, border: `1px solid ${T.border}`, background: "none", color: T.textMuted, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>
            Clear all ✕
          </button>
        </div>
      ) : null}
      <DataTable
        title="Field Service Cases"
        columns={columns}
        rows={rows}
        storageKey="adage_fsm_overview_cols_v5"
        searchText={(c) => [c.name, caseCustomer(c), caseEndUser(c), c.x_studio_control_no, c.x_studio_scrn, c.x_studio_problem_type, engineerNames(c.engineerIds, userMap).join(" ")].join(" ")}
        searchPlaceholder="Search cases..."
        onRowClick={openCase}
        exportName="field-service-cases"
        toolbar={
          <>
            <div style={{ width: 1, height: 20, background: "#e5e7eb", flexShrink: 0 }} />
            <FilterSelect value={loggedFilter} onChange={setLoggedFilter} prefix="Worksheet: " width={190}
              options={[{ value: "all", label: "All" }, { value: "logged", label: "Logged" }, { value: "not_logged", label: "Not logged" }, { value: "backlog", label: "Open, not logged" }]} />
            <MultiSelect label="Region" options={regionOptions} selected={filterRegion} onChange={setFilterRegion} searchable searchPlaceholder="Search region..." />
            <MultiSelect label="Stage" options={stageOptions} selected={filterStage} onChange={setFilterStage} />
            <MultiSelect label="Call Type" options={callTypeOptions} selected={filterCallType} onChange={setFilterCallType} />
          </>
        }
      />
    </div>
  );
}
