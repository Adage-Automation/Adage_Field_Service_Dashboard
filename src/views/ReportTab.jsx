import { useMemo, useState } from "react";
import { T } from "../constants/theme";
import { CHART_COLORS, SERVICE_TYPE_COLORS, colorFor } from "../constants/colors";
import { FLAG, tally, engineerStats } from "../lib/derive";
import { ChartRow, Panel, BarList, SplitBar, MiniStat, CardTitle, Pill, fmtNum, pct, plural, exportToExcel } from "../components/ui";
import { SectionLabel } from "./shared";

// ─── Utilization Report ───────────────────────────────────────────────────────
// A management-level summary of how the Field Service module is being used: what was filled,
// who used it, what was logged, how long work takes, and the problem areas, with risks and
// recommendations generated from the live numbers. Follows the header engineer filter.
// Printable (Print / Save as PDF) and exportable to Excel.

const SEVERITY = {
  High:   { color: T.danger, bg: T.dangerBg, rank: 0 },
  Medium: { color: "#B45309", bg: T.warningBg, rank: 1 },
  Low:    { color: T.accent, bg: T.accentBg, rank: 2 },
};

function Stat({ label, value, sub, color = T.textPrimary }) {
  return (
    <div className="card report-avoid-break" style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 9.5, color: T.textMuted, letterSpacing: "0.7px", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.15, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 4, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
}

function AdoptionRow({ label, value, total, color, note }) {
  const p = pct(value, total);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: T.textPrimary }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value} / {total} · {p}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: T.bgInput, overflow: "hidden" }}>
        <div className="bar-fill" style={{ width: `${p}%`, height: "100%", background: color }} />
      </div>
      {note && <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 3 }}>{note}</div>}
    </div>
  );
}

export function ReportTab({ model, userMap, engineerName, lastUpdated }) {
  const { cases, worksheets, timesheets, momAmc, momComm, specials } = model;
  const [exporting, setExporting] = useState(false);

  const r = useMemo(() => {
    const n = cases.length;
    const logged = cases.filter((c) => c.hasWorksheet);
    const completed = cases.filter((c) => !c.isOpen);
    const open = cases.filter((c) => c.isOpen);
    const backlog = cases.filter((c) => c.backlog);
    const backlog60 = backlog.filter((c) => (c.ageDays ?? 0) > 60);
    const completedNoWs = completed.filter((c) => !c.hasWorksheet);
    const noEvidence = cases.filter((c) => c.completedNoEvidence);
    const withMom = cases.filter((c) => c.hasMom);
    const withTs = cases.filter((c) => c.hasTimesheet);
    const withFiles = cases.filter((c) => c.attachments > 0 || c.docSection.length > 0);
    const noMom = cases.filter((c) => c.flag === FLAG.NO_MOM);
    const noWs = cases.filter((c) => c.flag === FLAG.NO_WORKSHEET);
    const staleNotStarted = cases.filter((c) => c.isOpen && /not started/i.test(c.x_studio_task_status || "") && (c.ageDays ?? 0) > 30);

    // engineers
    const engineers = engineerStats(cases, userMap);
    const activeEngineers = engineers.filter((e) => e.logged > 0);
    const zeroLoggers = engineers.filter((e) => e.assigned >= 3 && e.logged === 0).sort((a, b) => b.assigned - a.assigned);

    // Odoo user accounts that entered the data (create_uid)
    const users = {};
    const addUser = (rows, key) => rows.forEach((row) => {
      const u = row.create_uid?.[1] || "Unknown";
      if (!users[u]) users[u] = { user: u, worksheets: 0, timesheets: 0, moms: 0 };
      users[u][key] += 1;
    });
    addUser(worksheets, "worksheets");
    addUser(timesheets, "timesheets");
    addUser([...momAmc, ...momComm], "moms");
    const userRows = Object.values(users).map((u) => ({ ...u, total: u.worksheets + u.timesheets + u.moms })).sort((a, b) => b.total - a.total);
    const totalEntries = userRows.reduce((s, u) => s + u.total, 0);
    const sharedLogin = userRows.find((u) => /service engineer/i.test(u.user));

    // content
    const problemTags = worksheets.reduce((s, w) => s + w.problems.length, 0);
    const distinctProblems = new Set(worksheets.flatMap((w) => w.problems)).size;
    const spareUses = worksheets.reduce((s, w) => s + w.spares.length, 0);
    const spareTally = tally(worksheets.flatMap((w) => w.spares));
    const problemTypes = tally(cases.map((c) => c.x_studio_problem_type || "Not set"));
    const serviceTypes = tally(worksheets.map((w) => w.x_studio_service_type || "Not set"));
    const durations = worksheets.map((w) => w.visitDays).filter((d) => d !== null);
    const avgDays = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const missingDates = worksheets.length - durations.length;
    const missingResolution = worksheets.filter((w) => w.problems.length && !(w.x_studio_resolution_applied || "").trim()).length;
    const noResolutionAtAll = worksheets.filter((w) => !(w.x_studio_resolution_applied || "").trim()).length;
    const totalHours = timesheets.reduce((s, t) => s + t.hours, 0);
    const totalOT = timesheets.reduce((s, t) => s + t.overtime, 0);
    const unlinkedTs = timesheets.filter((t) => !t.case).length;
    const completedHours = completed.filter((c) => c.hasTimesheet);
    const avgHoursCompleted = completedHours.length ? completedHours.reduce((s, c) => s + c.hours, 0) / completedHours.length : 0;
    const topHours = [...engineers].sort((a, b) => b.hours - a.hours)[0];

    // ── risks ──
    const risks = [];
    const add = (severity, area, finding, impact, recommendation) => risks.push({ severity, area, finding, impact, recommendation });
    if (n && pct(logged.length, n) < 70) add(pct(logged.length, n) < 50 ? "High" : "Medium", "Adoption",
      `Only ${pct(logged.length, n)}% of cases (${logged.length}/${n}) have a worksheet; ${n - logged.length} cases have no service record.`,
      "Most field work isn't documented in Odoo, so reporting, billing and quality tracking rely on paper or memory.",
      "Make a worksheet mandatory before a case can move to Completed (Odoo stage rule / Studio required field), and review the unlogged list weekly.");
    if (noEvidence.length) add("High", "Closed without evidence",
      `${plural(noEvidence.length, "case")} marked Completed with no files, no MoM and no timesheet.`,
      "Completion can't be verified for the customer or for invoicing; there's an audit risk.",
      "Re-open these cases or attach the service report / MoM. Block closing a case without at least one supporting document.");
    if (completedNoWs.length) add(completedNoWs.length >= 5 ? "High" : "Medium", "Missing service reports",
      `${plural(completedNoWs.length, "completed case")} never got a worksheet (${pct(completedNoWs.length, completed.length)}% of completed cases).`,
      "Problems found, resolutions and spare parts used on these jobs are lost.",
      "Have the assigned engineers back-fill worksheets for these cases this week.");
    if (backlog60.length) add(backlog60.length >= 10 ? "High" : "Medium", "Cases left open",
      `${plural(backlog60.length, "open case")} without a worksheet ${backlog60.length === 1 ? "is" : "are"} older than 60 days (${backlog.length} open cases unlogged in total).`,
      "Stale open cases inflate the workload and hide what's really pending; customers may be waiting.",
      "Run a backlog review: close cases that are done (with a worksheet), cancel duplicates, and re-plan the rest with dates.");
    if (zeroLoggers.length) add("High", "Engineer compliance",
      `${plural(zeroLoggers.length, "engineer")} with 3+ assigned cases ${zeroLoggers.length === 1 ? "has" : "have"} never filed a worksheet: ${zeroLoggers.slice(0, 5).map((e) => `${e.name} (${e.assigned})`).join(", ")}${zeroLoggers.length > 5 ? "…" : ""}.`,
      "Logging depends on a few individuals; the rest of the team isn't using the module.",
      "Give these engineers targeted training on the Odoo mobile worksheet and track their logging rate in this dashboard.");
    if (sharedLogin && totalEntries && pct(sharedLogin.total, totalEntries) >= 50) add("Medium", "Accountability",
      `${pct(sharedLogin.total, totalEntries)}% of entries (${sharedLogin.total}/${totalEntries}) were created by the shared “${sharedLogin.user}” login.`,
      "You can't tell from Odoo who actually entered or approved a record.",
      "Give each engineer a personal Odoo user (or portal/mobile login) so entries are traceable.");
    if (noMom.length) add("Medium", "Paperwork mismatch",
      `${plural(noMom.length, "case")} ${noMom.length === 1 ? "has" : "have"} a worksheet but no MoM (AMC / Commissioning).`,
      "The customer-signed minutes are missing for completed visits.",
      "Record the MoM for these visits, or confirm a MoM isn't required for that call type.");
    if (noWs.length) add("Low", "Paperwork mismatch",
      `${plural(noWs.length, "case")} ${noWs.length === 1 ? "has" : "have"} a MoM / certificate but no worksheet.`,
      "The visit happened but the technical record is missing.",
      "Add the worksheet for these cases.");
    if (staleNotStarted.length) add("Medium", "Status hygiene",
      `${plural(staleNotStarted.length, "open case")} still say Task Status “Not Started” after 30+ days.`,
      "Status fields don't reflect reality, so planning and SLA tracking are unreliable.",
      "Update Task Status when work starts. Consider an automated action that flags cases stuck in Not Started.");
    if (unlinkedTs) add("Medium", "Data quality",
      `${plural(unlinkedTs, "timesheet")} ${unlinkedTs === 1 ? "isn't" : "aren't"} linked to any case.`,
      "Their hours can't be attributed to a job, customer or engineer.",
      "Link each timesheet to its task, and make the task field required on the timesheet form.");
    if (worksheets.length && missingResolution) add("Medium", "Data quality",
      `${plural(missingResolution, "worksheet")} list problems but have no Resolution Applied (${noResolutionAtAll}/${worksheets.length} worksheets have no resolution text).`,
      "The fix knowledge isn't captured, so repeat issues can't be learned from.",
      "Make Resolution Applied required when Problems Found = Yes.");
    if (missingDates) add("Low", "Data quality",
      `${plural(missingDates, "worksheet")} miss an Actual Visit Start or End date.`,
      "Time taken can't be measured for those visits.",
      "Make both visit dates required on the worksheet.");
    if (topHours && totalHours && topHours.hours / totalHours > 0.3) add("Low", "Resource dependency",
      `${topHours.name} accounts for ${pct(topHours.hours, totalHours)}% of all timesheet hours.`,
      "There's a key-person dependency; workload may be unbalanced.",
      "Review assignment balance and cross-train another engineer on the same sites.");
    risks.sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);

    // summary narrative
    const summary = [
      `${n} field service cases are recorded in Odoo; ${logged.length} (${pct(logged.length, n)}%) are logged with at least one worksheet (${worksheets.length} worksheets in total).`,
      `${withMom.length} cases have Minutes of Meeting (${momAmc.length} AMC and ${momComm.length} Commissioning entries). ${withTs.length} cases have timesheets, totalling ${fmtNum(totalHours, 0)} working hours.`,
      `${activeEngineers.length} of ${engineers.length} assigned engineers have filed at least one worksheet. Visits take ${avgDays === null ? "an unknown number of" : fmtNum(avgDays, 1)} days on average from start to end.`,
      risks.length ? `${risks.filter((x) => x.severity === "High").length} high-severity and ${risks.filter((x) => x.severity === "Medium").length} medium-severity issues were found. The most pressing: ${risks[0].finding}` : "No significant risks were found.",
    ];

    return {
      n, logged, completed, open, backlog, backlog60, completedNoWs, noEvidence, withMom, withTs, withFiles, noMom, noWs,
      engineers, activeEngineers, zeroLoggers, userRows, totalEntries, problemTags, distinctProblems, spareUses, spareTally,
      problemTypes, serviceTypes, avgDays, durations, missingDates, totalHours, totalOT, unlinkedTs, avgHoursCompleted, risks, summary,
    };
  }, [cases, worksheets, timesheets, momAmc, momComm, userMap]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToExcel("field-service-utilization-report", [
        { name: "Summary", columns: [{ header: "Metric", width: 40 }, { header: "Value", width: 18 }, { header: "Note", width: 60 }], rows: [
          ["Scope", engineerName || "All service engineers", ""],
          ["As of", (lastUpdated || new Date()).toLocaleString("en-IN"), "Live Odoo data"],
          ["Cases recorded", r.n, ""],
          ["Logged cases (≥1 worksheet)", r.logged.length, `${pct(r.logged.length, r.n)}%`],
          ["Worksheets filled", worksheets.length, ""],
          ["Cases with MoM", r.withMom.length, `AMC rows ${momAmc.length} · Commissioning rows ${momComm.length}`],
          ["Cases with timesheets", r.withTs.length, `${fmtNum(r.totalHours, 0)} working hours · ${fmtNum(r.totalOT, 0)} overtime`],
          ["Engineers assigned / active", `${r.engineers.length} / ${r.activeEngineers.length}`, "active = filed at least one worksheet"],
          ["Problems logged", r.problemTags, `${r.distinctProblems} distinct`],
          ["Spare parts used", r.spareUses, `${r.spareTally.length} distinct`],
          ["Avg time taken (days)", r.avgDays === null ? "" : Number(r.avgDays.toFixed(1)), `${r.durations.length} worksheets with both visit dates`],
          ["Open cases unlogged", r.backlog.length, `${r.backlog60.length} older than 60 days`],
          ["Completed without worksheet", r.completedNoWs.length, ""],
          ["Completed with no files, MoM or timesheet", r.noEvidence.length, ""],
          [],
          ...r.summary.map((t) => ["Summary", "", t]),
        ] },
        { name: "Risks & Recommendations", columns: [{ header: "Severity", width: 10 }, { header: "Area", width: 22 }, { header: "Finding", width: 70 }, { header: "Impact", width: 55 }, { header: "Recommendation", width: 70 }],
          rows: r.risks.map((x) => [x.severity, x.area, x.finding, x.impact, x.recommendation]) },
        { name: "Engineers", columns: [{ header: "Engineer", width: 32 }, { header: "Assigned", width: 10 }, { header: "Logged", width: 10 }, { header: "Logging rate", width: 12 }, { header: "Hours", width: 10 }],
          rows: [...r.engineers].sort((a, b) => b.assigned - a.assigned).map((e) => [e.name, e.assigned, e.logged, `${pct(e.logged, e.assigned)}%`, Math.round(e.hours)]) },
        { name: "Odoo Users", columns: [{ header: "Odoo user (created by)", width: 32 }, { header: "Worksheets", width: 12 }, { header: "Timesheets", width: 12 }, { header: "MoMs", width: 10 }, { header: "Total", width: 10 }],
          rows: r.userRows.map((u) => [u.user, u.worksheets, u.timesheets, u.moms, u.total]) },
        { name: "Problem Types", columns: [{ header: "Problem type (case)", width: 36 }, { header: "Cases", width: 10 }], rows: r.problemTypes.map((p) => [p.key, p.value]) },
        { name: "Spare Parts", columns: [{ header: "Spare part", width: 60 }, { header: "Times used", width: 12 }], rows: r.spareTally.map((p) => [p.key, p.value]) },
      ]);
    } catch (err) {
      console.error(err);
      alert(`Export failed: ${err.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  const today = (lastUpdated || new Date()).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const high = r.risks.filter((x) => x.severity === "High").length;
  const med = r.risks.filter((x) => x.severity === "Medium").length;

  return (
    <div className="report">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print, .tab-btn, [data-app-header] { display: none !important; }
          .report .card { box-shadow: none !important; break-inside: avoid; }
          .report-avoid-break { break-inside: avoid; }
          .report-page-break { break-before: page; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      {/* ── Report header ── */}
      <div className="card" style={{ padding: "18px 22px", marginBottom: 10, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderLeft: `4px solid ${T.accent}` }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "1.4px", textTransform: "uppercase", fontWeight: 700 }}>Field Service · Odoo</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, marginTop: 2 }}>Utilization Report</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
            As of {today} · Scope: <strong>{engineerName || "All service engineers"}</strong> · Live data from Odoo
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Pill color={T.danger} bg={T.dangerBg}>{high} high risk{high === 1 ? "" : "s"}</Pill>
          <Pill color="#B45309" bg={T.warningBg}>{med} medium</Pill>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.accentBdr}`, background: T.accentBg, color: T.accent, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>🖨 Print / Save as PDF</button>
          <button onClick={handleExport} disabled={exporting} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.accent}`, background: T.bgCard, color: T.accent, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: exporting ? "wait" : "pointer" }}>{exporting ? "Exporting…" : "⬇ Export Excel"}</button>
        </div>
      </div>

      {/* ── 1. Executive summary ── */}
      <SectionLabel>1 · Executive Summary</SectionLabel>
      <div className="card report-avoid-break" style={{ padding: "14px 18px", marginBottom: 10 }}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {r.summary.map((t, i) => <li key={i} style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>{t}</li>)}
        </ul>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, marginBottom: 10 }}>
        <Stat label="Cases recorded" value={fmtNum(r.n)} sub={`${r.open.length} open · ${r.completed.length} completed`} color={T.accent} />
        <Stat label="Logged cases" value={`${fmtNum(r.logged.length)} · ${pct(r.logged.length, r.n)}%`} sub="at least one worksheet" color={T.success} />
        <Stat label="Worksheets filled" value={fmtNum(worksheets.length)} sub={`across ${r.logged.length} cases`} />
        <Stat label="MoMs generated" value={fmtNum(momAmc.length + momComm.length)} sub={`${r.withMom.length} cases · AMC ${momAmc.length} · Comm. ${momComm.length}`} color="#7C3AED" />
        <Stat label="Hours logged" value={`${fmtNum(r.totalHours, 0)} h`} sub={`${timesheets.length} timesheets · ${fmtNum(r.totalOT, 0)} h overtime`} />
        <Stat label="Avg time taken" value={r.avgDays === null ? "—" : `${fmtNum(r.avgDays, 1)} d`} sub="visit start → end per worksheet" color={T.success} />
        <Stat label="Issues logged" value={fmtNum(r.problemTags)} sub={`${r.distinctProblems} distinct problems`} color={T.danger} />
        <Stat label="Spare parts used" value={fmtNum(r.spareUses)} sub={`${r.spareTally.length} distinct parts`} color={T.warning} />
        <Stat label="Engineers active" value={`${r.activeEngineers.length} / ${r.engineers.length}`} sub="filed ≥ 1 worksheet / assigned" />
        <Stat label="Special dates" value={fmtNum(specials.length)} sub="holidays, leave, overtime days" />
      </div>

      {/* ── 2. Utilization ── */}
      <SectionLabel>2 · Utilization: Who Is Using the Module</SectionLabel>
      <ChartRow columns="minmax(0, 1fr) minmax(0, 1fr)">
        <Panel title="Module adoption per case" info="Share of all cases that have each type of record.">
          <AdoptionRow label="Worksheet (Logged Case)" value={r.logged.length} total={r.n} color={T.success} />
          <AdoptionRow label="Minutes of Meeting" value={r.withMom.length} total={r.n} color="#7C3AED" note={`AMC on ${cases.filter((c) => c.momAmc.length).length} cases · Commissioning on ${cases.filter((c) => c.momComm.length).length}`} />
          <AdoptionRow label="Timesheet" value={r.withTs.length} total={r.n} color={T.accent} note={r.unlinkedTs ? `${r.unlinkedTs} more timesheets aren't linked to any case` : null} />
          <AdoptionRow label="Files attached" value={r.withFiles.length} total={r.n} color="#64748B" />
        </Panel>
        <Panel title="Who entered the data (Odoo login)" info="Odoo user that created each worksheet, timesheet and MoM (create_uid). A shared login hides who actually did the work.">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(4, minmax(0, 1fr))", fontSize: 11.5, rowGap: 6 }}>
            {["User", "Worksheets", "Timesheets", "MoMs", "Share"].map((h) => <div key={h} style={{ fontSize: 9.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>)}
            {r.userRows.map((u) => [
              <div key={`${u.user}-n`} style={{ fontWeight: 600, color: T.textPrimary }}>{u.user}{/service engineer/i.test(u.user) && <span style={{ marginLeft: 6 }}><Pill color="#B45309" bg={T.warningBg}>shared</Pill></span>}</div>,
              <div key={`${u.user}-w`}>{u.worksheets}</div>,
              <div key={`${u.user}-t`}>{u.timesheets}</div>,
              <div key={`${u.user}-m`}>{u.moms}</div>,
              <div key={`${u.user}-s`} style={{ fontWeight: 700, color: T.accent }}>{pct(u.total, r.totalEntries)}%</div>,
            ])}
          </div>
          <div style={{ marginTop: 14 }}>
            <CardTitle>Engineers (from case assignment)</CardTitle>
            <SplitBar parts={[
              { label: "Logging (≥1 worksheet)", value: r.activeEngineers.length, color: T.success },
              { label: "Never logged", value: r.engineers.length - r.activeEngineers.length, color: "#F59E0B" },
            ]} />
          </div>
        </Panel>
      </ChartRow>

      {/* ── 3. What was logged ── */}
      <SectionLabel>3 · What Was Logged</SectionLabel>
      <ChartRow columns="minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)">
        <Panel title="Issue types (case Problem Type)">
          <BarList items={r.problemTypes.slice(0, 8).map((p, i) => ({ key: p.key, label: p.key, value: p.value, color: CHART_COLORS[i % CHART_COLORS.length] }))} formatValue={(v) => `${v}`} />
        </Panel>
        <Panel title="Service types (worksheets)">
          <BarList items={r.serviceTypes.map((p, i) => ({ key: p.key, label: p.key, value: p.value, color: colorFor(p.key, SERVICE_TYPE_COLORS, i) }))} formatValue={(v) => `${v}`} emptyText="No worksheets" />
        </Panel>
        <Panel title="Most used spare parts">
          <BarList items={r.spareTally.slice(0, 8).map((p, i) => ({ key: p.key, label: p.key, value: p.value, color: CHART_COLORS[(i + 3) % CHART_COLORS.length] }))} formatValue={(v) => `${v}×`} emptyText="No spare parts recorded" />
        </Panel>
      </ChartRow>

      {/* ── 4. Time ── */}
      <SectionLabel>4 · Time Taken</SectionLabel>
      <div className="card report-avoid-break" style={{ padding: "14px 18px", marginBottom: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
        <MiniStat label="Avg time taken / visit" value={r.avgDays === null ? "—" : `${fmtNum(r.avgDays, 1)} d`} color={T.success} sub={`${r.durations.length} worksheets measured`} />
        <MiniStat label="Shortest / longest" value={r.durations.length ? `${Math.min(...r.durations)} / ${Math.max(...r.durations)} d` : "—"} sub="visit start → end" />
        <MiniStat label="Total working hours" value={`${fmtNum(r.totalHours, 0)} h`} color={T.accent} sub="all timesheets" />
        <MiniStat label="Avg hours / completed case" value={`${fmtNum(r.avgHoursCompleted, 1)} h`} sub="completed cases with timesheets" />
        <MiniStat label="Overtime share" value={`${pct(r.totalOT, r.totalHours)}%`} color={T.danger} sub={`${fmtNum(r.totalOT, 0)} h overtime`} />
        <MiniStat label="Missing visit dates" value={fmtNum(r.missingDates)} color={T.warning} sub="worksheets not measurable" />
      </div>

      {/* ── 5. Problem areas, risks & recommendations ── */}
      <div className="report-page-break" />
      <SectionLabel>5 · Problem Areas, Risks &amp; Recommendations</SectionLabel>
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px minmax(0, 0.8fr) minmax(0, 2fr) minmax(0, 1.6fr) minmax(0, 2fr)", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", padding: "8px 16px", gap: 12 }}>
          {["Severity", "Area", "Finding", "Impact", "Recommendation"].map((h) => <div key={h} style={{ fontSize: 9.5, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.6px", textTransform: "uppercase" }}>{h}</div>)}
        </div>
        {r.risks.length === 0 && <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontSize: 13 }}>No risks detected 🎉</div>}
        {r.risks.map((x, i) => {
          const sv = SEVERITY[x.severity];
          return (
            <div key={i} className="report-avoid-break" style={{ display: "grid", gridTemplateColumns: "90px minmax(0, 0.8fr) minmax(0, 2fr) minmax(0, 1.6fr) minmax(0, 2fr)", padding: "10px 16px", gap: 12, borderBottom: "1px solid #f1f5f9", boxShadow: `inset 3px 0 0 ${sv.color}`, alignItems: "start" }}>
              <div><Pill color={sv.color} bg={sv.bg}>{x.severity}</Pill></div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{x.area}</div>
              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.45 }}>{x.finding}</div>
              <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.45 }}>{x.impact}</div>
              <div style={{ fontSize: 12, color: T.textPrimary, lineHeight: 1.45 }}><span style={{ color: T.accent, fontWeight: 700 }}>→ </span>{x.recommendation}</div>
            </div>
          );
        })}
      </div>

      <div className="card report-avoid-break" style={{ padding: "14px 18px", marginBottom: 10, background: T.accentBg, border: `1px solid ${T.accentBdr}` }}>
        <CardTitle color={T.accent}>Top recommendations</CardTitle>
        <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {r.risks.slice(0, 5).map((x, i) => <li key={i} style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}><strong>{x.area}:</strong> {x.recommendation}</li>)}
        </ol>
      </div>
      <div style={{ fontSize: 10.5, color: T.textMuted, margin: "4px 2px 0" }}>
        Generated automatically from live Odoo Field Service data. Definitions of every figure: docs/metrics.md.
      </div>
    </div>
  );
}
