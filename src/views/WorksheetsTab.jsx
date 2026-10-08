import { useMemo, useState } from "react";
import { T } from "../constants/theme";
import { SERVICE_TYPE_COLORS, CHART_COLORS, colorFor } from "../constants/colors";
import { tally } from "../lib/derive";
import { InsightsCard, KpiCard, KpiRow, BarList, InteractiveDonut, DataTable, ChartRow, Stack, Panel, SplitBar, MiniStat, MultiSelect, FilterChip, TitleCell, Txt, Pill, Dash, fmtNum, avg } from "../components/ui";
import { caseCustomer, engineerNames, EngineerPills, openCase, odooLinkCell, fmtDay, isoDay, SectionLabel } from "./shared";

export const DURATION_BUCKETS = [
  { key: "1 day", test: (d) => d === 1, color: "#059669" },
  { key: "2–3 days", test: (d) => d >= 2 && d <= 3, color: "#02818A" },
  { key: "4–7 days", test: (d) => d >= 4 && d <= 7, color: "#D97706" },
  { key: "8+ days", test: (d) => d >= 8, color: "#DC2626" },
];


export function TagList({ items, color }) {
  if (!items.length) return <Dash />;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {items.map((t, i) => <Pill key={`${t}-${i}`} color={color} title={t}>{t}</Pill>)}
    </div>
  );
}

// ─── Worksheets tab ───────────────────────────────────────────────────────────
export function WorksheetsTab({ model, userMap }) {
  const { worksheets, cases } = model;
  const [serviceType, setServiceType] = useState(null);
  const [bucket, setBucket] = useState(null);
  const [filterProblem, setFilterProblem] = useState([]);
  const [filterSpare, setFilterSpare] = useState([]);

  const caseCount = new Set(worksheets.map((w) => w.caseId).filter(Boolean)).size;
  const problemTotal = worksheets.reduce((s, w) => s + w.problems.length, 0);
  const problemsYes = worksheets.filter((w) => w.x_studio_problems_found_ === "Yes").length;
  const spareTotal = worksheets.reduce((s, w) => s + w.spares.length, 0);
  const sparesYes = worksheets.filter((w) => w.x_studio_spare_parts_was_used_ === "Yes").length;
  const durations = worksheets.map((w) => w.visitDays).filter((d) => d !== null);
  const missingDates = worksheets.length - durations.length;
  const avgDays = durations.length ? avg(durations.reduce((s, v) => s + v, 0), durations.length) : null;

  const serviceSegments = useMemo(
    () => tally(worksheets.map((w) => w.x_studio_service_type || "Not set"))
      .map((t, i) => ({ ...t, color: t.key === "Not set" ? "#94A3B8" : colorFor(t.key, SERVICE_TYPE_COLORS, i) })),
    [worksheets],
  );
  const durationItems = DURATION_BUCKETS.map((b) => ({ key: b.key, label: b.key, value: durations.filter(b.test).length, color: b.color }));
  const problemItems = useMemo(() => tally(worksheets.flatMap((w) => w.problems)).map((t, i) => ({ key: t.key, label: t.key, value: t.value, color: CHART_COLORS[(i + 8) % CHART_COLORS.length] })), [worksheets]);
  const spareItems = useMemo(() => tally(worksheets.flatMap((w) => w.spares)).map((t, i) => ({ key: t.key, label: t.key, value: t.value, color: CHART_COLORS[(i + 2) % CHART_COLORS.length] })), [worksheets]);

  const insights = (() => {
    const out = [];
    const n = worksheets.length;
    if (!n) return out;
    const topType = serviceSegments[0];
    if (topType) out.push({
      tone: "info", title: `${topType.key} drives ${Math.round((topType.value / n) * 100)}% of field work`,
      text: `${topType.value} of ${n} worksheets. Next: ${serviceSegments.slice(1, 3).map((s) => `${s.key} (${s.value})`).join(", ") || "none"}.`,
      onClick: () => setServiceType(topType.key),
    });
    out.push({
      tone: problemsYes / n > 0.5 ? "warn" : "info",
      title: `Problems found on ${Math.round((problemsYes / n) * 100)}% of visits`,
      text: `${problemsYes} worksheets report problems, with ${problemTotal} problem tags across ${problemItems.length} distinct issues.`,
    });
    const repeat = problemItems.filter((p) => p.value > 1);
    if (repeat.length) out.push({
      tone: "warn", title: `Recurring issue: ${repeat[0].key}`,
      text: `Seen on ${repeat[0].value} worksheets${repeat.length > 1 ? `; ${repeat.length - 1} more issues recur` : ""}. Consider a preventive fix or a spares stock check.`,
      onClick: () => setFilterProblem([repeat[0].key]),
    });
    out.push({
      tone: "info", title: `Spare parts used on ${Math.round((sparesYes / n) * 100)}% of visits`,
      text: `${spareTotal} parts across ${spareItems.length} distinct items${spareItems[0] ? `. Most used: ${spareItems[0].key}` : ""}.`,
    });
    const long = durations.filter((d) => d >= 15).length;
    if (long) out.push({
      tone: "warn", title: `${long} visit${long === 1 ? "" : "s"} lasted 15+ days`,
      text: `The average visit is ${fmtNum(avgDays, 1)} days. Long visits tie up engineers; check commissioning scope and planning.`,
      onClick: () => setBucket("8+ days"),
    });
    if (missingDates) out.push({
      tone: "bad", title: `${missingDates} worksheet${missingDates === 1 ? "" : "s"} missing visit dates`,
      text: "Without both an Actual Visit Start and End Date, their duration can't be measured. Ask the engineers to complete them.",
      onClick: () => setBucket("missing"),
    });
    return out.slice(0, 6);
  })();

  const yesNo = (field) => [
    { label: "Yes", value: worksheets.filter((w) => w[field] === "Yes").length, color: T.success },
    { label: "No", value: worksheets.filter((w) => w[field] === "No").length, color: "#94A3B8" },
    { label: "Blank", value: worksheets.filter((w) => !w[field]).length, color: T.border },
  ];

  const rows = useMemo(() => worksheets.filter((w) => {
    if (serviceType && (w.x_studio_service_type || "Not set") !== serviceType) return false;
    if (bucket) {
      const b = DURATION_BUCKETS.find((x) => x.key === bucket);
      if (bucket === "missing" ? w.visitDays !== null : w.visitDays === null || !b.test(w.visitDays)) return false;
    }
    if (filterProblem.length && !w.problems.some((p) => filterProblem.includes(p))) return false;
    if (filterSpare.length && !w.spares.some((p) => filterSpare.includes(p))) return false;
    return true;
  }), [worksheets, serviceType, bucket, filterProblem, filterSpare]);

  const wsEngineers = (w) => (w.engineerIds.length ? w.engineerIds : w.case?.engineerIds || []);

  // ── Problem types (case field), avg time taken per service type ──
  const caseProblemTypes = useMemo(
    () => tally(cases.map((c) => c.x_studio_problem_type || "Not set"))
      .map((t, i) => ({ key: t.key, label: t.key, value: t.value, color: CHART_COLORS[i % CHART_COLORS.length],
        sub: `${cases.filter((c) => (c.x_studio_problem_type || "Not set") === t.key && c.hasWorksheet).length} logged` })),
    [cases],
  );
  const timeByType = useMemo(() => {
    const m = {};
    worksheets.forEach((w) => {
      if (w.visitDays === null) return;
      const k = w.x_studio_service_type || "Not set";
      if (!m[k]) m[k] = [];
      m[k].push(w.visitDays);
    });
    return Object.entries(m)
      .map(([k, v]) => ({ key: k, label: k, value: v.reduce((a, b) => a + b, 0) / v.length, color: colorFor(k, SERVICE_TYPE_COLORS), sub: `${v.length} worksheet${v.length === 1 ? "" : "s"} · ${Math.min(...v)}–${Math.max(...v)} days` }))
      .sort((a, b) => b.value - a.value);
  }, [worksheets]);

  // ── Problems & resolutions: every worksheet that recorded a problem or a resolution ──
  const resolutionRows = useMemo(
    () => worksheets.filter((w) => w.problems.length || w.spares.length || (w.x_studio_resolution_applied || "").trim()),
    [worksheets],
  );

  // ── Spare parts register: one row per part, most-used first ──
  const spareRegister = useMemo(() => {
    const m = {};
    worksheets.forEach((w) => w.spares.forEach((part) => {
      if (!m[part]) m[part] = { part, uses: 0, cases: new Set(), engineers: new Set(), last: "" };
      const r = m[part];
      r.uses += 1;
      if (w.case) r.cases.add(w.case.name);
      wsEngineers(w).forEach((id) => r.engineers.add(userMap[id] || `Employee #${id}`));
      const d = isoDay(w.x_studio_actual_visit_start_date || w.create_date);
      if (d > r.last) r.last = d;
    }));
    return Object.values(m)
      .map((r) => ({ ...r, cases: [...r.cases], engineers: [...r.engineers] }))
      .sort((a, b) => b.uses - a.uses || a.part.localeCompare(b.part));
  }, [worksheets, userMap]);
  const maxSpareUses = spareRegister[0]?.uses || 0;

  const resolutionColumns = [
    { key: "case", label: "Case", weight: 18, exportWidth: 40,
      render: (w) => <TitleCell title={w.case?.name || w.x_studio_task_id?.[1] || "Unlinked worksheet"} sub={caseCustomer(w.case)} />,
      sortValue: (w) => w.case?.name || "", exportValue: (w) => w.case?.name || w.x_studio_task_id?.[1] || "" },
    { key: "ptype", label: "Problem Type", weight: 11, exportWidth: 22, info: "The case's Problem Type field in Odoo.",
      render: (w) => <Txt>{w.case?.x_studio_problem_type}</Txt>, sortValue: (w) => w.case?.x_studio_problem_type || "" },
    { key: "problems", label: "Problems Identified", weight: 18, exportWidth: 40, info: "Problems Identified tags on the worksheet.",
      render: (w) => <TagList items={w.problems} color="#DC2626" />, sortValue: (w) => w.problems.length, exportValue: (w) => w.problems.join(", ") },
    { key: "resolution", label: "Resolution Applied", weight: 28, exportWidth: 70, info: "Resolution Applied text written by the engineer on the worksheet. Hover to read it in full.",
      render: (w) => (w.x_studio_resolution_applied
        ? <span title={w.x_studio_resolution_applied} style={{ fontSize: 11.5, color: T.textSecondary, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>{w.x_studio_resolution_applied.trim()}</span>
        : <span style={{ fontSize: 11, color: T.danger, fontWeight: 600 }}>Not recorded</span>),
      sortValue: (w) => (w.x_studio_resolution_applied ? 1 : 0), exportValue: (w) => (w.x_studio_resolution_applied || "").trim() },
    { key: "spares", label: "Spare Parts Used", weight: 14, exportWidth: 36,
      info: "Entries in the worksheet's Spare Parts Used field. Each entry counts once toward the Spare Parts Used total.",
      render: (w) => <TagList items={w.spares} color="#7C3AED" />, sortValue: (w) => w.spares.length, exportValue: (w) => w.spares.join(", ") },
    { key: "engineer", label: "Engineer", weight: 11, exportWidth: 28,
      render: (w) => <EngineerPills ids={wsEngineers(w)} userMap={userMap} />,
      sortValue: (w) => engineerNames(wsEngineers(w), userMap).join(", "), exportValue: (w) => engineerNames(wsEngineers(w), userMap).join(", ") },
    { key: "visit", label: "Visit Start", weight: 8, exportWidth: 14, render: (w) => <Txt>{fmtDay(w.x_studio_actual_visit_start_date)}</Txt>, sortValue: (w) => isoDay(w.x_studio_actual_visit_start_date) },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (w) => odooLinkCell(w.caseId), exportWidth: 14 },
  ];

  const spareColumns = [
    { key: "part", label: "Spare Part", weight: 26, exportWidth: 50,
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {r.uses === maxSpareUses && maxSpareUses > 1 && <Pill color="#B45309" bg={T.warningBg}>Most used</Pill>}
          <span className="opp-title" title={r.part}>{r.part}</span>
        </div>
      ),
      sortValue: (r) => r.part, exportValue: (r) => r.part },
    { key: "uses", label: "Times Used", weight: 8, info: "Number of worksheets that list this part under Spare Parts Used.",
      render: (r) => <span className="col-value">{r.uses}×</span>, sortValue: (r) => r.uses },
    { key: "cases", label: "Used On Cases", weight: 28, exportWidth: 60,
      render: (r) => <Txt title={r.cases.join("\n")}>{r.cases.join(" · ")}</Txt>, sortValue: (r) => r.cases.length, exportValue: (r) => r.cases.join("; ") },
    { key: "engineers", label: "Engineers", weight: 16, exportWidth: 30,
      render: (r) => <Txt title={r.engineers.join(", ")}>{r.engineers.join(", ")}</Txt>, sortValue: (r) => r.engineers.join(", "), exportValue: (r) => r.engineers.join(", ") },
    { key: "last", label: "Last Used", weight: 9, exportWidth: 14, info: "Visit start date of the latest worksheet that used the part.",
      render: (r) => <Txt>{fmtDay(r.last)}</Txt>, sortValue: (r) => r.last },
  ];

  const columns = [
    { key: "case", label: "Case", weight: 22, exportWidth: 44,
      render: (w) => <TitleCell title={w.case?.name || w.x_studio_task_id?.[1] || "Unlinked worksheet"} sub={caseCustomer(w.case) || w.x_name} />,
      sortValue: (w) => w.case?.name || w.x_studio_task_id?.[1] || "", exportValue: (w) => w.case?.name || w.x_studio_task_id?.[1] || "" },
    { key: "engineer", label: "Service Engineer", weight: 13, exportWidth: 30,
      info: "The worksheet's Assigned Service Engineer, or the case's Service Engineers when that field is empty.",
      render: (w) => <EngineerPills ids={wsEngineers(w)} userMap={userMap} />,
      sortValue: (w) => engineerNames(wsEngineers(w), userMap).join(", "), exportValue: (w) => engineerNames(wsEngineers(w), userMap).join(", ") },
    { key: "type", label: "Service Type", weight: 11, exportWidth: 20,
      info: "Service Type selected on the worksheet (AMC, CAMC, Pre-commissioning, Commissioning, Post-commissioning, Troubleshooting, Service).",
      render: (w) => (w.x_studio_service_type ? <Pill color={colorFor(w.x_studio_service_type, SERVICE_TYPE_COLORS)}>{w.x_studio_service_type}</Pill> : <Dash />),
      sortValue: (w) => w.x_studio_service_type || "" },
    { key: "start", label: "Visit Start", weight: 9, info: "Worksheet's Actual Visit Start Date.", exportWidth: 14, render: (w) => <Txt>{fmtDay(w.x_studio_actual_visit_start_date)}</Txt>, sortValue: (w) => isoDay(w.x_studio_actual_visit_start_date) },
    { key: "end", label: "Visit End", weight: 9, info: "Worksheet's Actual Visit End Date.", exportWidth: 14, render: (w) => <Txt>{fmtDay(w.x_studio_actual_visit_end_date)}</Txt>, sortValue: (w) => isoDay(w.x_studio_actual_visit_end_date) },
    { key: "days", label: "Time Taken (Days)", weight: 7,
      info: "Visit End − Visit Start + 1, so both days count (e.g. 10 → 12 Apr = 3 days). n/a means a date is missing; those rows are left out of the average.",
      render: (w) => (w.visitDays !== null ? <span className="col-value">{w.visitDays}</span> : <Pill color={T.warning} bg={T.warningBg} title="Start or end date missing">n/a</Pill>),
      sortValue: (w) => w.visitDays },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (w) => odooLinkCell(w.caseId), exportWidth: 14 },
  ];

  const anyFilter = serviceType || bucket || filterProblem.length || filterSpare.length;

  return (
    <div>
      <KpiRow>
        <KpiCard label="Worksheets" value={fmtNum(worksheets.length)} tone="accent"
          info="Service Call Worksheets filed in Odoo."
          sub={`across ${fmtNum(caseCount)} case${caseCount === 1 ? "" : "s"}`} />
        <KpiCard label="Problems Identified" value={fmtNum(problemTotal)} tone="danger"
          info="Total problem tags in the worksheets' Problems Identified field. The note below counts worksheets where Problems Found? is Yes."
          sub={`${problemsYes} worksheet${problemsYes === 1 ? "" : "s"} marked “Problems found: Yes” · ${problemItems.length} distinct`} />
        <KpiCard label="Spare Parts Used" value={fmtNum(spareTotal)} tone="warning"
          info="Total spare-part entries in the worksheets' Spare Parts Used field. The note below counts worksheets where Spare Parts was used? is Yes."
          sub={`${sparesYes} worksheet${sparesYes === 1 ? "" : "s"} marked “Spares used: Yes” · ${spareItems.length} distinct`} />
        <KpiCard label="Avg Time Taken" value={avgDays === null ? "—" : `${fmtNum(avgDays, 1)} d`} tone="success"
          info="Days between Actual Visit Start Date and Actual Visit End Date, counting both days. Worksheets missing either date are left out."
          sub={durations.length
            ? `${Math.min(...durations)}–${Math.max(...durations)} days range · ${missingDates} missing a date`
            : `${missingDates} worksheet${missingDates === 1 ? "" : "s"} missing a date`}
          onClick={missingDates ? () => setBucket((v) => (v === "missing" ? null : "missing")) : null} active={bucket === "missing"} />
      </KpiRow>

      <InsightsCard insights={insights} />

      <ChartRow columns="minmax(0, 1.05fr) minmax(0, 0.95fr) minmax(0, 1fr) minmax(0, 1fr)">
        <Stack>
          <InteractiveDonut
            grow={false}
            title="Service Type"
            infoText="Service Type picked on each worksheet. Click a segment to filter the worksheet list."
            centerLabel="worksheets"
            unit="ws"
            segments={serviceSegments}
            activeKey={serviceType}
            onSegmentClick={(k) => setServiceType((v) => (v === k ? null : k))}
          />
          <Panel title="Visit Dates" info="Calculated from Actual Visit Start / End Date on each worksheet (end − start + 1). Click “Missing” to list worksheets without both dates.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <MiniStat label="Shortest" value={durations.length ? `${Math.min(...durations)} d` : "—"} color={T.success} />
              <MiniStat label="Longest" value={durations.length ? `${Math.max(...durations)} d` : "—"} color={T.danger} />
              <div onClick={missingDates ? () => setBucket((v) => (v === "missing" ? null : "missing")) : undefined} style={{ cursor: missingDates ? "pointer" : "default" }}>
                <MiniStat label="Missing" value={fmtNum(missingDates)} color={T.warning} sub={bucket === "missing" ? "filtering ✓" : "no start/end"} />
              </div>
            </div>
          </Panel>
        </Stack>
        <Stack>
          <Panel title="Start → End Duration" info="Worksheets grouped by how many days the visit lasted (start to end, counting both days). Click a bar to filter.">
            <BarList items={durationItems} formatValue={(v) => `${v} ws`} onItemClick={(k) => setBucket((v) => (v === k ? null : k))} activeKey={bucket} />
          </Panel>
          <Panel title="Engineer Answers" info="What engineers answered on each worksheet for “Problems Found?” and “Spare Parts was used?”. Blank = not answered.">
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>Problems found?</div>
            <SplitBar parts={yesNo("x_studio_problems_found_")} />
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, margin: "12px 0 6px" }}>Spare parts used?</div>
            <SplitBar parts={yesNo("x_studio_spare_parts_was_used_")} />
          </Panel>
        </Stack>
        <Panel title="Top Problems Identified" info="The problems that come up most often across worksheets. Click to filter the list.">
          <BarList items={problemItems} maxHeight={330} emptyText="No problems recorded" formatValue={(v) => `${v}×`}
            onItemClick={(k) => setFilterProblem((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))} activeKey={filterProblem.length === 1 ? filterProblem[0] : null} />
        </Panel>
        <Panel title="Top Spare Parts Used" info="The spare parts used most often across worksheets. Click to filter the list.">
          <BarList items={spareItems} maxHeight={330} emptyText="No spare parts recorded" formatValue={(v) => `${v}×`}
            onItemClick={(k) => setFilterSpare((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))} activeKey={filterSpare.length === 1 ? filterSpare[0] : null} />
        </Panel>
      </ChartRow>

      <SectionLabel>Worksheet Records</SectionLabel>
      {anyFilter ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textMuted }}>Filtered by:</span>
          {serviceType && <FilterChip label={`Service Type: ${serviceType}`} color={colorFor(serviceType, SERVICE_TYPE_COLORS)} onClear={() => setServiceType(null)} />}
          {bucket && <FilterChip label={bucket === "missing" ? "Missing visit date" : `Duration: ${bucket}`} color={T.warning} onClear={() => setBucket(null)} />}
          {filterProblem.length > 0 && <FilterChip label={`Problem: ${filterProblem.join(", ")}`} color={T.danger} onClear={() => setFilterProblem([])} />}
          {filterSpare.length > 0 && <FilterChip label={`Spare: ${filterSpare.join(", ")}`} color="#7C3AED" onClear={() => setFilterSpare([])} />}
        </div>
      ) : null}
      <DataTable
        title="Service Call Worksheets"
        columns={columns}
        rows={rows}
        storageKey="adage_fsm_worksheets_cols_v3"
        searchText={(w) => [w.case?.name, caseCustomer(w.case), w.x_name, w.x_studio_service_type, w.x_studio_customer_requirement, ...w.problems, ...w.spares, engineerNames(wsEngineers(w), userMap).join(" ")].join(" ")}
        searchPlaceholder="Search worksheets..."
        onRowClick={(w) => openCase(w.case || { id: w.caseId })}
        exportName="field-service-worksheets"
        toolbar={
          <>
            <div style={{ width: 1, height: 20, background: "#e5e7eb", flexShrink: 0 }} />
            <MultiSelect label="Problem" options={problemItems.map((p) => p.key)} selected={filterProblem} onChange={setFilterProblem} searchable searchPlaceholder="Search problem..." />
            <MultiSelect label="Spare Part" options={spareItems.map((p) => p.key)} selected={filterSpare} onChange={setFilterSpare} searchable searchPlaceholder="Search spare part..." />
          </>
        }
      />

      <ChartRow columns="minmax(0, 1fr) minmax(0, 1fr)" style={{ marginTop: 10 }}>
        <Panel title="Problem Types · All Cases" info="Every value of the case's Problem Type field across all cases. The note under each shows how many of those cases are logged (have a worksheet).">
          <BarList items={caseProblemTypes} maxHeight={300} formatValue={(v) => `${v} case${v === 1 ? "" : "s"}`} />
        </Panel>
        <Panel title="Avg Time Taken by Service Type" info="Average of (Actual Visit End − Actual Visit Start + 1) per Service Type. Worksheets missing either date are left out.">
          <BarList items={timeByType} maxHeight={300} formatValue={(v) => `${fmtNum(v, 1)} d`} emptyText="No worksheets with both visit dates" />
        </Panel>
      </ChartRow>

      <SectionLabel>Problems Found &amp; Resolution Applied</SectionLabel>
      <DataTable
        title="Problems & Resolutions"
        columns={resolutionColumns}
        rows={resolutionRows}
        storageKey="adage_fsm_resolutions_cols_v2"
        searchText={(w) => [w.case?.name, caseCustomer(w.case), w.case?.x_studio_problem_type, ...w.problems, ...w.spares, w.x_studio_resolution_applied].join(" ")}
        searchPlaceholder="Search problems or resolutions..."
        onRowClick={(w) => openCase(w.case || { id: w.caseId })}
        exportName="field-service-problems-resolutions"
        maxHeight={420}
        emptyText="No worksheet has recorded a problem, spare part or resolution."
      />

      <SectionLabel>Spare Parts Register</SectionLabel>
      <DataTable
        title="Spare Parts Used"
        columns={spareColumns}
        rows={spareRegister}
        rowKey={(r) => r.part}
        defaultSort={{ key: "uses", dir: "desc" }}
        storageKey="adage_fsm_spares_cols_v1"
        searchText={(r) => [r.part, ...r.cases, ...r.engineers].join(" ")}
        searchPlaceholder="Search spare parts..."
        exportName="field-service-spare-parts"
        maxHeight={380}
        emptyText="No spare parts recorded on worksheets."
      />
    </div>
  );
}
