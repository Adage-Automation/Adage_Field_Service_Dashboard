import { useMemo, useState } from "react";
import { T } from "../constants/theme";
import { PERSON_COLORS, SPECIAL_DATE_COLORS, colorFor } from "../constants/colors";
import { tally } from "../lib/derive";
import { InsightsCard, KpiCard, KpiRow, BarList, InteractiveDonut, DataTable, ChartRow, Stack, Panel, SplitBar, MiniStat, FilterChip, TitleCell, Txt, Pill, Dash, fmtNum, avg } from "../components/ui";
import { caseCustomer, engineerNames, EngineerPills, openCase, odooLinkCell, fmtDay, isoDay, SectionLabel } from "./shared";

// Who a timesheet belongs to: "Submitted By" when filled, otherwise the case's service engineers.
const tsEngineers = (t) => (t.engineerIds.length ? t.engineerIds : t.case?.engineerIds || []);

function SpecialTypePill({ type }) {
  if (!type) return <Dash />;
  return <Pill color={colorFor(type, SPECIAL_DATE_COLORS)}>{type}</Pill>;
}

// ─── Timesheets tab ───────────────────────────────────────────────────────────
export function TimesheetsTab({ model, userMap, filtered }) {
  const { timesheets, specials } = model;
  const [specialType, setSpecialType] = useState(null);

  const totalHours = timesheets.reduce((s, t) => s + t.hours, 0);
  const totalOvertime = timesheets.reduce((s, t) => s + t.overtime, 0);
  const totalTravel = timesheets.reduce((s, t) => s + t.travelDays, 0);
  const withTravel = timesheets.filter((t) => t.travelDays > 0).length;
  const caseCount = new Set(timesheets.map((t) => t.caseId).filter(Boolean)).size;
  const unlinked = timesheets.filter((t) => !t.case).length;

  const specialSegments = useMemo(
    () => tally(specials.map((s) => s.x_studio_type || "Not set")).map((t, i) => ({ ...t, color: colorFor(t.key, SPECIAL_DATE_COLORS, i) })),
    [specials],
  );
  const specialHours = specials.reduce((s, x) => s + (Number(x.x_studio_hours) || 0), 0);

  const perEngineer = useMemo(() => {
    const m = {};
    timesheets.forEach((t) => tsEngineers(t).forEach((id) => {
      if (!m[id]) m[id] = { id, name: userMap[id] || `Employee #${id}`, hours: 0, overtime: 0, travel: 0, sheets: 0 };
      m[id].hours += t.hours;
      m[id].overtime += t.overtime;
      m[id].travel += t.travelDays;
      m[id].sheets += 1;
    }));
    return Object.values(m).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  }, [timesheets, userMap]);

  const hoursItems = perEngineer.map((p, i) => ({
    key: p.id, label: p.name, value: p.hours, color: PERSON_COLORS[i % PERSON_COLORS.length], avatar: true,
    sub: `${p.sheets} timesheet${p.sheets === 1 ? "" : "s"} · average ${fmtNum(avg(p.hours, p.sheets), 1)} h · ${fmtNum(p.overtime, 1)} h overtime · ${p.travel} travel day${p.travel === 1 ? "" : "s"}`,
  }));
  const travelItems = [...perEngineer].sort((a, b) => b.travel - a.travel).filter((p) => p.travel > 0).map((p, i) => ({
    key: p.id, label: p.name, value: p.travel, color: PERSON_COLORS[(i + 3) % PERSON_COLORS.length],
    sub: `average ${fmtNum(avg(p.travel, p.sheets), 1)} days per timesheet`,
  }));

  // ── Hours per task (case) and per customer ──
  // All FSM cases sit in one Odoo project ("Field Service"), so "per project" is reported per task/case.
  const taskRows = useMemo(() => {
    const m = {};
    timesheets.forEach((t) => {
      if (!t.case) return;
      const c = t.case;
      if (!m[c.id]) m[c.id] = { c, sheets: 0, hours: 0, overtime: 0, travel: 0, workDays: 0 };
      const r = m[c.id];
      r.sheets += 1; r.hours += t.hours; r.overtime += t.overtime; r.travel += t.travelDays; r.workDays += t.workDays || 0;
    });
    return Object.values(m).sort((a, b) => b.hours - a.hours);
  }, [timesheets]);
  const completedTasks = taskRows.filter((r) => !r.c.isOpen);
  const openTasks = taskRows.filter((r) => r.c.isOpen);
  const avgCompleteHours = avg(completedTasks.reduce((n, r) => n + r.hours, 0), completedTasks.length);
  const customerItems = useMemo(() => {
    const m = {};
    taskRows.forEach((r) => {
      const k = caseCustomer(r.c) || "No customer";
      if (!m[k]) m[k] = { hours: 0, cases: 0 };
      m[k].hours += r.hours; m[k].cases += 1;
    });
    return Object.entries(m).sort((a, b) => b[1].hours - a[1].hours)
      .map(([k, v], i) => ({ key: k, label: k, value: v.hours, color: PERSON_COLORS[(i + 2) % PERSON_COLORS.length], sub: `${v.cases} job${v.cases === 1 ? "" : "s"} · average ${fmtNum(avg(v.hours, v.cases), 1)} h per job` }));
  }, [taskRows]);
  const projectName = taskRows[0]?.c.projectName || "Field Service";

  const taskColumns = [
    { key: "case", label: "Job", weight: 24, exportWidth: 44, render: (r) => <TitleCell title={r.c.name} sub={caseCustomer(r.c)} />, sortValue: (r) => r.c.name, exportValue: (r) => r.c.name },
    { key: "project", label: "Project", weight: 9, exportWidth: 18, render: (r) => <Txt>{r.c.projectName}</Txt>, sortValue: (r) => r.c.projectName, exportValue: (r) => r.c.projectName },
    { key: "stage", label: "Status", weight: 8, render: (r) => <Pill color={r.c.isOpen ? T.accent : T.success} bg={r.c.isOpen ? T.accentBg : T.successBg}>{r.c.stage_id?.[1] || "—"}</Pill>, sortValue: (r) => r.c.stage_id?.[1] || "", exportValue: (r) => r.c.stage_id?.[1] || "" },
    { key: "sheets", label: "Timesheets", weight: 7, render: (r) => <Txt>{r.sheets}</Txt>, sortValue: (r) => r.sheets },
    { key: "hours", label: "Working Hours", weight: 8, info: "Sum of Total Working Hours across the job's timesheets: the time taken on that task.",
      render: (r) => <span className="col-value">{fmtNum(r.hours, 1)}</span>, sortValue: (r) => r.hours },
    { key: "ot", label: "Overtime", weight: 7, render: (r) => (r.overtime ? <span style={{ fontSize: 12, fontWeight: 700, color: T.danger }}>{fmtNum(r.overtime, 1)}</span> : <Dash />), sortValue: (r) => r.overtime },
    { key: "work", label: "Work Days", weight: 7, info: "Σ (Work End − Work Start + 1) across the job's timesheets.", render: (r) => <Txt>{r.workDays || "—"}</Txt>, sortValue: (r) => r.workDays },
    { key: "travel", label: "Travel Days", weight: 7, render: (r) => <Txt>{r.travel || "—"}</Txt>, sortValue: (r) => r.travel },
    { key: "share", label: "Share of Hours", weight: 12, exportWidth: 12, info: "This task's hours as a % of all timesheet hours shown.",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.bgInput, overflow: "hidden" }}><div style={{ width: `${totalHours ? (r.hours / totalHours) * 100 : 0}%`, height: "100%", background: T.accent }} /></div>
          <span style={{ fontSize: 11, color: T.textMuted, width: 30, textAlign: "right" }}>{totalHours ? Math.round((r.hours / totalHours) * 100) : 0}%</span>
        </div>
      ),
      sortValue: (r) => r.hours, exportValue: (r) => (totalHours ? `${Math.round((r.hours / totalHours) * 100)}%` : "") },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (r) => odooLinkCell(r.c.id), exportWidth: 14 },
  ];

  const insights = (() => {
    const out = [];
    if (!timesheets.length) return out;
    const otShare = totalHours ? totalOvertime / totalHours : 0;
    out.push({
      tone: otShare > 0.1 ? "warn" : "good", title: `Overtime is ${Math.round(otShare * 100)}% of logged hours`,
      text: `${fmtNum(totalOvertime, 1)} h overtime out of ${fmtNum(totalHours, 0)} h worked; ${specialSegments.find((s) => s.key === "Overtime")?.value || 0} overtime dates recorded.`,
    });
    const top = perEngineer[0];
    if (top && totalHours) out.push({
      tone: top.hours / totalHours > 0.3 ? "warn" : "info", title: `${top.name} carries ${Math.round((top.hours / totalHours) * 100)}% of hours`,
      text: `${fmtNum(top.hours, 0)} h across ${top.sheets} timesheets. ${top.hours / totalHours > 0.3 ? "There's a high dependency on one engineer." : "The load is reasonably spread."}`,
    });
    if (withTravel) out.push({
      tone: "info", title: `${fmtNum(avg(totalTravel, withTravel), 1)} travel days per trip`,
      text: `${totalTravel} travel days across ${withTravel} trips. Travel is ${Math.round((totalTravel / Math.max(1, totalTravel + timesheets.reduce((n, t) => n + (t.workDays || 0), 0))) * 100)}% of on-assignment days.`,
    });
    const leave = specialSegments.find((s) => s.key === "Casual Leave")?.value || 0;
    const hol = specialSegments.find((s) => s.key === "Site Holiday")?.value || 0;
    if (leave + hol) out.push({
      tone: "info", title: `${leave + hol} non-working day${leave + hol === 1 ? "" : "s"} on site`,
      text: `${leave} casual leave and ${hol} site holiday${hol === 1 ? "" : "s"} recorded during assignments.`,
      onClick: () => setSpecialType(leave >= hol ? "Casual Leave" : "Site Holiday"),
    });
    if (!filtered && unlinked) out.push({
      tone: "bad", title: `${unlinked} timesheets not linked to a job`,
      text: "Their hours can't be attributed to a job or an engineer. Link them to their task in Odoo.",
    });
    return out.slice(0, 6);
  })();

  const specialRows = useMemo(
    () => specials.filter((s) => !specialType || (s.x_studio_type || "Not set") === specialType),
    [specials, specialType],
  );

  const tsCaseTitle = (t) => t.case?.name || t.x_project_task_id?.[1] || "";
  const tsColumns = [
    { key: "case", label: "Job / Work Done", weight: 22, exportWidth: 44,
      info: "Job the timesheet belongs to, with its WORK DONE text underneath. Timesheets not linked to a job are marked ⚠ and only count in the unfiltered totals.",
      render: (t) => (tsCaseTitle(t)
        ? <TitleCell title={tsCaseTitle(t)} sub={t.x_name || caseCustomer(t.case)} />
        : <TitleCell title={t.x_name || "Untitled timesheet"} sub="⚠ Not linked to a job" />),
      sortValue: tsCaseTitle, exportValue: (t) => [tsCaseTitle(t), t.x_name].filter(Boolean).join(" — ") },
    { key: "engineer", label: "Engineer", weight: 13, exportWidth: 30,
      info: "Timesheet's Submitted By, or the job's Service Engineers when that field is empty.",
      render: (t) => <EngineerPills ids={tsEngineers(t)} userMap={userMap} />,
      sortValue: (t) => engineerNames(tsEngineers(t), userMap).join(", "), exportValue: (t) => engineerNames(tsEngineers(t), userMap).join(", ") },
    { key: "dated", label: "Dated", weight: 8, exportWidth: 14, render: (t) => <Txt>{fmtDay(t.x_studio_dated)}</Txt>, sortValue: (t) => isoDay(t.x_studio_dated) },
    { key: "workstart", label: "Work Start", weight: 8, exportWidth: 14, render: (t) => <Txt>{fmtDay(t.x_studio_work_start_date)}</Txt>, sortValue: (t) => isoDay(t.x_studio_work_start_date) },
    { key: "workend", label: "Work End", weight: 8, exportWidth: 14, render: (t) => <Txt>{fmtDay(t.x_studio_work_end_date)}</Txt>, sortValue: (t) => isoDay(t.x_studio_work_end_date) },
    { key: "hours", label: "Working Hours", weight: 7, info: "Total Working Hours on the timesheet (stored as text in Odoo and converted to a number).", render: (t) => (t.hours ? <span className="col-value">{fmtNum(t.hours, 1)}</span> : <Dash />), sortValue: (t) => t.hours },
    { key: "ot", label: "Overtime Hours", weight: 7, info: "Total Overtime Hours on the timesheet.", render: (t) => (t.overtime ? <span style={{ fontSize: 12, fontWeight: 700, color: T.danger }}>{fmtNum(t.overtime, 1)}</span> : <Dash />), sortValue: (t) => t.overtime },
    { key: "travelto", label: "Travel To", weight: 9, exportWidth: 26,
      info: "Days travelling to site: Travel To End − Travel To Start + 1. A single travel date counts as 1 day. Hover to see the dates.",
      render: (t) => (t.travelTo ? <Txt title={`${fmtDay(t.x_studio_travel_to_start_date || t.x_studio_travel_to_site)} → ${fmtDay(t.x_studio_travel_to_end_date)}`}>{t.travelTo} d · {fmtDay(t.x_studio_travel_to_start_date || t.x_studio_travel_to_site)}</Txt> : <Dash />),
      sortValue: (t) => t.travelTo, exportValue: (t) => t.travelTo },
    { key: "travelfrom", label: "Travel From", weight: 9, exportWidth: 26,
      info: "Days travelling back from site: Travel From End − Travel From Start + 1. A single travel date counts as 1 day.",
      render: (t) => (t.travelFrom ? <Txt title={`${fmtDay(t.x_studio_travel_from_start_date || t.x_studio_travel_from_site)} → ${fmtDay(t.x_studio_travel_from_end_date)}`}>{t.travelFrom} d · {fmtDay(t.x_studio_travel_from_start_date || t.x_studio_travel_from_site)}</Txt> : <Dash />),
      sortValue: (t) => t.travelFrom, exportValue: (t) => t.travelFrom },
    { key: "travel", label: "Travel Days", weight: 6, info: "Travel To days + Travel From days.", render: (t) => (t.travelDays ? <span className="col-value">{t.travelDays}</span> : <Dash />), sortValue: (t) => t.travelDays },
    { key: "special", label: "Special Dates", weight: 10, exportWidth: 30,
      info: "Special Dates entered on the timesheet (Site Holiday, Casual Leave, Overtime), counted by type.",
      render: (t) => (t.specials.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {tally(t.specials.map((s) => s.x_studio_type || "Not set")).map((x) => <Pill key={x.key} color={colorFor(x.key, SPECIAL_DATE_COLORS)}>{x.key} ×{x.value}</Pill>)}
        </div>
      ) : <Dash />),
      sortValue: (t) => t.specials.length,
      exportValue: (t) => t.specials.map((s) => `${s.x_studio_type || ""} ${isoDay(s.x_studio_date)} ${s.x_studio_hours ? `${s.x_studio_hours}h` : ""}`.trim()).join("; ") },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (t) => odooLinkCell(t.case ? t.caseId : null), exportWidth: 14 },
  ];

  const spColumns = [
    { key: "type", label: "Type", weight: 10, render: (s) => <SpecialTypePill type={s.x_studio_type} />, sortValue: (s) => s.x_studio_type || "" },
    { key: "date", label: "Date", weight: 10, exportWidth: 14, render: (s) => <Txt>{fmtDay(s.x_studio_date)}</Txt>, sortValue: (s) => isoDay(s.x_studio_date) },
    { key: "hours", label: "Working Hours", weight: 6, info: "Hours entered on the special date (mainly for Overtime).", render: (s) => (s.x_studio_hours ? <span className="col-value">{s.x_studio_hours}</span> : <Dash />), sortValue: (s) => Number(s.x_studio_hours) || 0 },
    { key: "case", label: "Job", weight: 26, exportWidth: 44,
      render: (s) => (s.case?.name || s.timesheet?.x_project_task_id?.[1]
        ? <TitleCell title={s.case?.name || s.timesheet?.x_project_task_id?.[1]} sub={s.timesheet?.x_name} />
        : <TitleCell title={s.timesheet?.x_name || "Untitled timesheet"} sub="⚠ Not linked to a job" />),
      sortValue: (s) => s.case?.name || s.timesheet?.x_name || "", exportValue: (s) => s.case?.name || `${s.timesheet?.x_name || ""} (not linked to a job)` },
    { key: "engineer", label: "Engineer", weight: 14, exportWidth: 30,
      render: (s) => <EngineerPills ids={s.timesheet ? tsEngineers(s.timesheet) : []} userMap={userMap} />,
      sortValue: (s) => engineerNames(s.timesheet ? tsEngineers(s.timesheet) : [], userMap).join(", "),
      exportValue: (s) => engineerNames(s.timesheet ? tsEngineers(s.timesheet) : [], userMap).join(", ") },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (s) => odooLinkCell(s.case?.id), exportWidth: 14 },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Total Working Hours" value={`${fmtNum(totalHours, 1)} h`} tone="accent"
          info="Sum of each timesheet's Total Working Hours."
          sub={`average ${fmtNum(avg(totalHours, timesheets.length), 1)} h per timesheet · ${fmtNum(avg(totalHours, caseCount), 1)} h per job`} />
        <KpiCard label="Overtime Hours" value={`${fmtNum(totalOvertime, 1)} h`} tone="danger"
          info="Sum of each timesheet's Total Overtime Hours."
          sub={`average ${fmtNum(avg(totalOvertime, timesheets.length), 1)} h per timesheet`} />
        <KpiCard label="Travel Days" value={`${fmtNum(totalTravel)} d`} tone="warning"
          info="Travel To + Travel From days on each timesheet. A start → end range counts every day in it, both ends included. A single travel date counts as 1 day."
          sub={`average ${fmtNum(avg(totalTravel, timesheets.length), 1)} d per timesheet · ${fmtNum(avg(totalTravel, withTravel), 1)} d per trip`} />
        <KpiCard label="Special Dates" value={fmtNum(specials.length)} tone="success"
          info="Site Holiday, Casual Leave and Overtime dates entered on the timesheets."
          sub={specialSegments.map((s) => `${s.key} ${s.value}`).join(" · ") || "None recorded"} />
      </KpiRow>

      {!filtered && unlinked > 0 && (
        <div style={{ fontSize: 11.5, color: T.textMuted, margin: "-2px 0 10px 2px" }}>
          {fmtNum(timesheets.length)} timesheets across {caseCount} jobs · <span style={{ color: T.warning, fontWeight: 600 }}>{unlinked} not linked to a job</span>. They count toward the totals above but drop out when you filter by engineer.
        </div>
      )}

      <InsightsCard insights={insights} />

      <ChartRow columns="minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr)">
        <Panel title="Working Hours by Engineer" info="Working hours from each engineer's timesheets. A timesheet belongs to its Submitted By person, or to the job's service engineers when that field is empty.">
          <BarList items={hoursItems} maxHeight={390} formatValue={(v) => `${fmtNum(v, 1)} h`} emptyText="No timesheets" />
        </Panel>
        <Panel title="Travel Days by Engineer" info="Travel days (to and from site) per engineer, with their average per timesheet.">
          <BarList items={travelItems} maxHeight={390} formatValue={(v) => `${v} d`} emptyText="No travel recorded" />
        </Panel>
        <Stack>
          <InteractiveDonut
            grow={false}
            title="Special Dates"
            infoText={`Special dates entered on timesheets (${fmtNum(specialHours)} h recorded in total). Click a segment to filter the special-dates list.`}
            centerLabel="dates"
            unit="dates"
            segments={specialSegments}
            activeKey={specialType}
            onSegmentClick={(k) => setSpecialType((v) => (v === k ? null : k))}
          />
          <Panel title="Time Summary" info="Regular vs overtime hours across the timesheets shown, plus per-timesheet averages.">
            <SplitBar unit=" h" parts={[
              { label: "Regular", value: Math.round(Math.max(0, totalHours - totalOvertime)), color: T.accent },
              { label: "Overtime", value: Math.round(totalOvertime), color: T.danger },
            ]} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
              <MiniStat label="Average Hours" value={`${fmtNum(avg(totalHours, timesheets.length), 1)} h`} color={T.accent} sub="per timesheet" />
              <MiniStat label="Average Travel" value={`${fmtNum(avg(totalTravel, timesheets.length), 1)} d`} color={T.warning} sub="per timesheet" />
              <MiniStat label="Work Days" value={fmtNum(timesheets.reduce((n, t) => n + (t.workDays || 0), 0))} sub="work start → end" />
            </div>
          </Panel>
        </Stack>
      </ChartRow>

      <ChartRow columns="minmax(0, 1fr) minmax(0, 1.3fr)" style={{ marginTop: 10 }}>
        <Panel title="Time Taken to Complete" info="Hours from timesheets per job. Completed = jobs in a Completed stage. All jobs belong to one Odoo project, so the overall figure is the project total.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
            <MiniStat label={`Overall · ${projectName}`} value={`${fmtNum(totalHours, 0)} h`} color={T.accent} sub={`${taskRows.length} jobs with timesheets`} />
            <MiniStat label="Average per completed job" value={`${fmtNum(avgCompleteHours, 1)} h`} color={T.success} sub={`${completedTasks.length} completed jobs`} />
            <MiniStat label="Working Hours on In-Progress Jobs" value={`${fmtNum(openTasks.reduce((n, r) => n + r.hours, 0), 0)} h`} color={T.warning} sub={`${openTasks.length} jobs still open`} />
            <MiniStat label="Longest task" value={taskRows[0] ? `${fmtNum(taskRows[0].hours, 0)} h` : "—"} color={T.danger} sub={taskRows[0]?.c.name?.slice(0, 40) || ""} />
          </div>
        </Panel>
        <Panel title="Working Hours by Customer" info="Timesheet hours grouped by the job's customer.">
          <BarList items={customerItems} maxHeight={220} formatValue={(v) => `${fmtNum(v, 0)} h`} emptyText="No linked timesheets" />
        </Panel>
      </ChartRow>

      <SectionLabel>Working Hours per Job</SectionLabel>
      <DataTable
        title={`Project: ${projectName}`}
        columns={taskColumns}
        rows={taskRows}
        rowKey={(r) => r.c.id}
        defaultSort={{ key: "hours", dir: "desc" }}
        storageKey="adage_fsm_taskhours_cols_v1"
        searchText={(r) => [r.c.name, caseCustomer(r.c), r.c.projectName].join(" ")}
        searchPlaceholder="Search tasks..."
        onRowClick={(r) => openCase(r.c)}
        exportName="field-service-hours-per-task"
        maxHeight={380}
        emptyText="No timesheets linked to a job."
      />

      <SectionLabel>Special Dates</SectionLabel>
      {specialType && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textMuted }}>Filtered by:</span>
          <FilterChip label={`Type: ${specialType}`} color={colorFor(specialType, SPECIAL_DATE_COLORS)} onClear={() => setSpecialType(null)} />
        </div>
      )}
      <DataTable
        title="Special Dates Used"
        columns={spColumns}
        rows={specialRows}
        storageKey="adage_fsm_special_cols_v2"
        searchText={(s) => [s.x_studio_type, s.case?.name, s.timesheet?.x_name, engineerNames(s.timesheet ? tsEngineers(s.timesheet) : [], userMap).join(" ")].join(" ")}
        searchPlaceholder="Search special dates..."
        onRowClick={(s) => s.case && openCase(s.case)}
        exportName="field-service-special-dates"
        maxHeight={320}
        emptyText="No special dates recorded."
      />

      <SectionLabel>Timesheet Records</SectionLabel>
      <DataTable
        title="Timesheets"
        columns={tsColumns}
        rows={timesheets}
        storageKey="adage_fsm_timesheets_cols_v2"
        searchText={(t) => [tsCaseTitle(t), t.x_name, t.x_studio_plant_site, t.x_studio_plant_section, engineerNames(tsEngineers(t), userMap).join(" ")].join(" ")}
        searchPlaceholder="Search timesheets..."
        onRowClick={(t) => t.case && openCase(t.case)}
        exportName="field-service-timesheets"
      />
    </div>
  );
}
