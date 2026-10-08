import { useMemo, useState } from "react";
import { T } from "../constants/theme";
import { PERSON_COLORS } from "../constants/colors";
import { FLAG, tally } from "../lib/derive";
import { InsightsCard, KpiCard, KpiRow, BarList, InteractiveDonut, DataTable, ChartRow, Stack, Panel, FilterSelect, TitleCell, Txt, Pill, fmtNum } from "../components/ui";
import { caseCustomer, engineerNames, EngineerPills, CountBadge, YesNo, FLAG_META, flagCaseColumns, openCase, odooLinkCell, fmtDay, isoDay, SectionLabel } from "./shared";

const MOM_AMC = "#02818A";
const MOM_COMM = "#7C3AED";
const CERT = "#0891B2";

const lastMomDate = (c) => [...c.momAmc, ...c.momComm].map((m) => isoDay(m.x_studio_date)).filter(Boolean).sort().pop() || "";

// ─── Documents tab ────────────────────────────────────────────────────────────
// "Documents" = MoM (AMC), MoM Commissioning, Commissioning Certificate and the Studio Documents
// section. A case is flagged when:
//   • a worksheet is filled but no MoM (AMC / Commissioning) is recorded, or
//   • a MoM or any other document is recorded but no worksheet is filled.
export function DocumentsTab({ model, userMap }) {
  const { cases, momAmc, momComm, certs, docSection } = model;
  const [show, setShow] = useState("flagged");

  const withWs = cases.filter((c) => c.hasWorksheet);
  const documented = withWs.filter((c) => c.hasMom);
  const flagged = cases.filter((c) => c.flagged);
  const noMom = flagged.filter((c) => c.flag === FLAG.NO_MOM);
  const noWs = flagged.filter((c) => c.flag === FLAG.NO_WORKSHEET);
  const withAmc = withWs.filter((c) => c.momAmc.length > 0).length;
  const withComm = withWs.filter((c) => c.momComm.length > 0).length;
  const checked = cases.filter((c) => c.hasWorksheet || c.hasAnyDoc);

  const flaggedByEngineer = useMemo(() => {
    const m = {};
    checked.forEach((c) => c.engineerIds.forEach((id) => {
      if (!m[id]) m[id] = { id, name: userMap[id] || `Employee #${id}`, flagged: 0, noMom: 0, noWs: 0, total: 0 };
      m[id].total += 1;
      if (c.flag) m[id].flagged += 1;
      if (c.flag === FLAG.NO_MOM) m[id].noMom += 1;
      if (c.flag === FLAG.NO_WORKSHEET) m[id].noWs += 1;
    }));
    return Object.values(m)
      .filter((p) => p.flagged > 0)
      .sort((a, b) => b.flagged - a.flagged || a.name.localeCompare(b.name))
      .map((p, i) => ({
        key: p.id, label: p.name, value: p.flagged, max: p.total, color: PERSON_COLORS[i % PERSON_COLORS.length], avatar: true,
        sub: [p.noMom && `${p.noMom} worksheet${p.noMom === 1 ? "" : "s"} without MoM`, p.noWs && `${p.noWs} doc${p.noWs === 1 ? "" : "s"} without worksheet`].filter(Boolean).join(" · "),
      }));
  }, [checked, userMap]);

  // ── Key insights: what is flagged and why ──
  const attachedOnly = cases.filter((c) => c.attachedFiles && (c.hasWorksheet ? !c.hasMom : c.hasAnyDoc));
  const flaggedDone = flagged.filter((c) => !c.isOpen).length;
  const insights = [];
  insights.push(flagged.length
    ? { tone: "bad", title: `${flagged.length} of ${checked.length} records flagged (${checked.length ? Math.round((flagged.length / checked.length) * 100) : 0}%)`,
        text: `${noMom.length} worksheet${noMom.length === 1 ? "" : "s"} without MoM · ${noWs.length} document${noWs.length === 1 ? "" : "s"} without worksheet. ${flaggedDone} of them are already in a Completed stage.`,
        onClick: () => setShow("flagged") }
    : { tone: "good", title: "No flagged records", text: "Every case with a worksheet also has a MoM, and every document has a worksheet." });
  if (noMom.length) {
    const types = tally(noMom.flatMap((c) => c.worksheets.map((w) => w.x_studio_service_type || "No service type")));
    insights.push({ tone: "bad", title: `Why: ${noMom.length} worksheet${noMom.length === 1 ? "" : "s"} filed, MoM never recorded`,
      text: `The engineer filled the Service Call Worksheet but no MoM (AMC) or MoM Commissioning was added. Service types: ${types.slice(0, 3).map((t) => `${t.key} (${t.value})`).join(", ")}.`,
      onClick: () => setShow("no_mom") });
  }
  if (noWs.length) {
    const types = tally(noWs.flatMap((c) => c.docTypes));
    insights.push({ tone: "warn", title: `Why: ${noWs.length} case${noWs.length === 1 ? "" : "s"} documented, worksheet missing`,
      text: `Paperwork exists (${types.map((t) => `${t.key} ${t.value}`).join(", ")}) but no worksheet was filed, so the visit itself isn't logged.`,
      onClick: () => setShow("no_worksheet") });
  }
  if (flaggedByEngineer[0]) insights.push({ tone: "warn", title: `${flaggedByEngineer[0].label} has the most flags (${flaggedByEngineer[0].value})`,
    text: `${flaggedByEngineer[0].sub}. ${flaggedByEngineer.length} engineer${flaggedByEngineer.length === 1 ? "" : "s"} have at least one flagged case.` });
  if (attachedOnly.length) insights.push({ tone: "info", title: `${attachedOnly.length} case${attachedOnly.length === 1 ? "" : "s"} cleared by attachments`,
    text: "These would be flagged, but files are uploaded in the case's Attachments field, so they count as documented.",
    onClick: () => setShow("attached") });

  const rowsByView = {
    flagged, no_mom: noMom, no_worksheet: noWs, documented, attached: attachedOnly, worksheet: withWs, all: cases,
  };
  const rows = rowsByView[show] || flagged;

  const columns = [
    ...flagCaseColumns(userMap),
    { key: "ws", label: "Worksheet", weight: 7,
      info: "Number of Service Call Worksheets linked to the case (worksheet → Task ID).",
      render: (c) => <YesNo yes={c.hasWorksheet} yesLabel={`${c.worksheets.length}`} noLabel="None" noColor={T.textMuted} noBg={T.bgInput} />,
      sortValue: (c) => c.worksheets.length, exportValue: (c) => c.worksheets.length },
    { key: "amc", label: "MoM (AMC)", weight: 7, info: "Rows in the case's Minutes of Meeting (AMC) section.",
      render: (c) => <CountBadge n={c.momAmc.length} color={MOM_AMC} bg="#E6F4F5" />, sortValue: (c) => c.momAmc.length },
    { key: "comm", label: "MoM Comm.", weight: 7, info: "Rows in the case's Minutes of Meeting Commissioning section.",
      render: (c) => <CountBadge n={c.momComm.length} color={MOM_COMM} bg="#EDE9FE" />, sortValue: (c) => c.momComm.length },
    { key: "cert", label: "Comm. Cert.", weight: 7, info: "Rows in the case's Commissioning Certificate section. These count as a document, but they don't replace a MoM.",
      render: (c) => <CountBadge n={c.certs.length} color={CERT} bg="#E0F2FE" />, sortValue: (c) => c.certs.length },
    { key: "files", label: "Doc Files", weight: 6, info: "Files uploaded in the case's Documents section.",
      render: (c) => <CountBadge n={c.docSection.length} color={T.textSecondary} bg={T.bgInput} />, sortValue: (c) => c.docSection.length },
    { key: "last", label: "Latest MoM", weight: 8, exportWidth: 14, info: "Most recent Date across the case's MoM (AMC) and MoM Commissioning rows.",
      render: (c) => <Txt>{fmtDay(lastMomDate(c))}</Txt>, sortValue: lastMomDate },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (c) => odooLinkCell(c.id), exportWidth: 14 },
  ];

  // ── MoM register: every case that has a MoM, with its type(s) ──
  const momCases = useMemo(() => cases.filter((c) => c.hasMom), [cases]);
  const momTypeLabel = (c) => (c.momAmc.length && c.momComm.length ? "AMC + Commissioning" : c.momAmc.length ? "AMC" : "Commissioning");
  const momSubjects = (c) => [...c.momAmc, ...c.momComm].map((m) => m.x_name).filter(Boolean);
  const momColumns = [
    { key: "case", label: "Case", weight: 24, exportWidth: 44, render: (c) => <TitleCell title={c.name} sub={caseCustomer(c)} />, sortValue: (c) => c.name },
    { key: "type", label: "MoM Type", weight: 11, exportWidth: 20,
      info: "Which Minutes of Meeting sections have entries on the case: AMC, Commissioning, or both.",
      render: (c) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {c.momAmc.length > 0 && <Pill color={MOM_AMC}>AMC ×{c.momAmc.length}</Pill>}
          {c.momComm.length > 0 && <Pill color={MOM_COMM}>Commissioning ×{c.momComm.length}</Pill>}
        </div>
      ),
      sortValue: momTypeLabel, exportValue: momTypeLabel },
    { key: "count", label: "MoM Rows", weight: 6, render: (c) => <span className="col-value">{c.momAmc.length + c.momComm.length}</span>, sortValue: (c) => c.momAmc.length + c.momComm.length },
    { key: "subjects", label: "Subjects", weight: 22, exportWidth: 60, info: "Subject line of each MoM entry.",
      render: (c) => <Txt title={momSubjects(c).join("\n")}>{momSubjects(c).join(" · ")}</Txt>, sortValue: (c) => momSubjects(c).join(" "), exportValue: (c) => momSubjects(c).join("; ") },
    { key: "engineers", label: "Service Engineers", weight: 13, exportWidth: 30,
      render: (c) => <EngineerPills ids={c.engineerIds} userMap={userMap} />,
      sortValue: (c) => engineerNames(c.engineerIds, userMap).join(", "), exportValue: (c) => engineerNames(c.engineerIds, userMap).join(", ") },
    { key: "ws", label: "Worksheet", weight: 8, info: "Whether the case also has a worksheet (MoM without a worksheet is flagged).",
      render: (c) => <YesNo yes={c.hasWorksheet} yesLabel={`${c.worksheets.length}`} noLabel="None" />, sortValue: (c) => c.worksheets.length },
    { key: "last", label: "Latest MoM", weight: 9, exportWidth: 14, render: (c) => <Txt>{fmtDay(lastMomDate(c))}</Txt>, sortValue: lastMomDate },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (c) => odooLinkCell(c.id), exportWidth: 14 },
  ];

  // ── Completed but no evidence: no files, no MoM, no timesheet ──
  const noEvidence = useMemo(() => cases.filter((c) => c.completedNoEvidence), [cases]);
  const completedCount = cases.filter((c) => !c.isOpen).length;
  const evidenceColumns = [
    { key: "case", label: "Case", weight: 24, exportWidth: 44, render: (c) => <TitleCell title={c.name} sub={caseCustomer(c)} />, sortValue: (c) => c.name },
    { key: "status", label: "Task Status", weight: 11, exportWidth: 20, render: (c) => <Txt>{c.x_studio_task_status}</Txt>, sortValue: (c) => c.x_studio_task_status || "" },
    { key: "engineers", label: "Service Engineers", weight: 14, exportWidth: 30,
      render: (c) => <EngineerPills ids={c.engineerIds} userMap={userMap} />,
      sortValue: (c) => engineerNames(c.engineerIds, userMap).join(", "), exportValue: (c) => engineerNames(c.engineerIds, userMap).join(", ") },
    { key: "files", label: "Files", weight: 6, info: "Chatter attachments + Documents-section files on the case.", render: () => <Pill color={T.danger} bg={T.dangerBg}>0</Pill>, sortValue: (c) => c.attachments, exportValue: () => 0 },
    { key: "mom", label: "MoM", weight: 6, render: () => <Pill color={T.danger} bg={T.dangerBg}>0</Pill>, exportValue: () => 0 },
    { key: "ts", label: "Timesheets", weight: 7, render: () => <Pill color={T.danger} bg={T.dangerBg}>0</Pill>, exportValue: () => 0 },
    { key: "ws", label: "Worksheet", weight: 7, info: "Shown for context: a worksheet alone doesn't count as completion evidence here.",
      render: (c) => <YesNo yes={c.hasWorksheet} yesLabel={`${c.worksheets.length}`} noLabel="None" />, sortValue: (c) => c.worksheets.length },
    { key: "created", label: "Created On", weight: 8, exportWidth: 14, render: (c) => <Txt>{fmtDay(c.createdISO)}</Txt>, sortValue: (c) => c.createdISO },
    { key: "odoo", label: "Odoo Link", exportOnly: true, exportValue: (c) => odooLinkCell(c.id), exportWidth: 14 },
  ];

  return (
    <div>
      <InsightsCard title="Key Insights · Flagged Records" insights={insights}
        info="Why records are flagged, generated from the data shown (follows the engineer filter). Click an insight to list those records." />

      <KpiRow>
        <KpiCard label="Cases with Worksheet" value={fmtNum(withWs.length)} tone="accent"
          info="Cases with at least one Service Call Worksheet."
          onClick={() => setShow("worksheet")} active={show === "worksheet"}
          sub={`of ${fmtNum(cases.length)} cases in total`} />
        <KpiCard label="Documented" value={fmtNum(documented.length)} tone="success"
          info="Cases with a worksheet and at least one MoM (AMC) or MoM Commissioning row: the expected, compliant state."
          onClick={() => setShow("documented")} active={show === "documented"}
          sub={`AMC ${withAmc} · Commissioning ${withComm}`} />
        <KpiCard label="Worksheet · No MoM" value={fmtNum(noMom.length)} tone="danger"
          info="Flagged: a worksheet is filled but no MoM (AMC) or MoM Commissioning is recorded."
          onClick={() => setShow("no_mom")} active={show === "no_mom"}
          sub={`${withWs.length ? Math.round((noMom.length / withWs.length) * 100) : 0}% of cases with a worksheet`} />
        <KpiCard label="Docs · No Worksheet" value={fmtNum(noWs.length)} tone="warning"
          info="Flagged: a MoM, Commissioning Certificate or Documents-section file is recorded but no worksheet is filled."
          onClick={() => setShow("no_worksheet")} active={show === "no_worksheet"}
          sub={`MoM rows: AMC ${momAmc.length} · Comm. ${momComm.length} · Certificates ${certs.length} · Files ${docSection.length}`} />
      </KpiRow>

      <ChartRow columns="minmax(0, 1fr) minmax(0, 1fr)">
        <Stack>
        <InteractiveDonut
          grow={false}
          title="Document Check"
          infoText="Every case with a worksheet or any document. Cases with files in the Attachments field are never flagged (Cleared). Click a segment to filter the list."
          centerLabel="cases"
          unit="cases"
          segments={[
            { key: "documented", displayKey: "OK · worksheet + MoM", value: documented.length, color: T.success },
            { key: "no_mom", displayKey: "Worksheet · no MoM", value: noMom.length, color: FLAG_META.no_mom.color },
            { key: "no_worksheet", displayKey: "Docs · no worksheet", value: noWs.length, color: FLAG_META.no_worksheet.color },
            { key: "attached", displayKey: "Cleared · files attached", value: attachedOnly.length, color: T.accent },
          ]}
          activeKey={["documented", "no_mom", "no_worksheet", "attached"].includes(show) ? show : null}
          onSegmentClick={(k) => setShow((v) => (v === k ? "flagged" : k))}
        />
        <InteractiveDonut
          grow={false}
          title="Document Type"
          infoText="Number of rows of each document type, across every case."
          centerLabel="doc rows"
          unit="rows"
          segments={[
            { key: "amc", displayKey: "MoM (AMC)", value: momAmc.length, color: MOM_AMC },
            { key: "comm", displayKey: "MoM Commissioning", value: momComm.length, color: MOM_COMM },
            { key: "cert", displayKey: "Commissioning Certificate", value: certs.length, color: CERT },
            { key: "files", displayKey: "Documents section", value: docSection.length, color: "#64748B" },
          ]}
        />
        </Stack>
        <Panel title="Flagged by Engineer" titleColor={T.danger} info="Flagged cases per service engineer. The bar shows flagged cases out of the engineer's cases that have a worksheet or document.">
          <BarList items={flaggedByEngineer} maxHeight={330} emptyText="No flagged records 🎉" formatValue={(v, it) => `${v} / ${it.max}`} />
        </Panel>
      </ChartRow>

      <SectionLabel>{show === "flagged" ? "Flagged Records" : "Document Check"}</SectionLabel>
      <DataTable
        title={{ flagged: "Flagged Records", no_mom: "Worksheet filled · No MoM", no_worksheet: "Docs recorded · No Worksheet" }[show] || "Records"}
        columns={columns}
        rows={rows}
        storageKey="adage_fsm_documents_cols_v2"
        searchText={(c) => [c.name, caseCustomer(c), c.flagReason, engineerNames(c.engineerIds, userMap).join(" ")].join(" ")}
        searchPlaceholder="Search records..."
        onRowClick={openCase}
        exportName={show === "flagged" ? "field-service-flagged" : "field-service-documents"}
        rowStyle={(c) => (c.flag ? { boxShadow: `inset 3px 0 0 ${FLAG_META[c.flag].color}` } : null)}
        emptyText={show.startsWith("no_") || show === "flagged" ? "No flagged records 🎉" : "No records."}
        toolbar={
          <>
            <div style={{ width: 1, height: 20, background: "#e5e7eb", flexShrink: 0 }} />
            <FilterSelect value={show} onChange={setShow} prefix="Show: " width={250} options={[
              { value: "flagged", label: `All flagged (${flagged.length})` },
              { value: "no_mom", label: `Worksheet · no MoM (${noMom.length})` },
              { value: "no_worksheet", label: `Docs · no worksheet (${noWs.length})` },
              { value: "documented", label: `Documented (${documented.length})` },
              { value: "attached", label: `Cleared · files attached (${attachedOnly.length})` },
              { value: "worksheet", label: `All with worksheet (${withWs.length})` },
              { value: "all", label: `All cases (${cases.length})` },
            ]} />
          </>
        }
      />

      <div className="card" style={{ padding: "12px 18px", margin: "18px 0 10px", background: noEvidence.length ? "#FEF2F2" : T.successBg, border: `1px solid ${noEvidence.length ? "#FECACA" : "#A7F3D0"}`, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 18, color: noEvidence.length ? T.danger : T.success }}>{noEvidence.length ? "⚠" : "✓"}</span>
        <div style={{ fontSize: 13, color: noEvidence.length ? "#B91C1C" : T.success, lineHeight: 1.5 }}>
          <strong>{noEvidence.length} of {completedCount} completed cases</strong> have no files attached, no MoM and no timesheet logged.
          {noEvidence.length > 0 && " The work is closed in Odoo with no supporting record."}
        </div>
      </div>
      <DataTable
        title="Completed · No Evidence"
        columns={evidenceColumns}
        rows={noEvidence}
        storageKey="adage_fsm_noevidence_cols_v1"
        searchText={(c) => [c.name, caseCustomer(c), engineerNames(c.engineerIds, userMap).join(" ")].join(" ")}
        searchPlaceholder="Search cases..."
        onRowClick={openCase}
        exportName="field-service-completed-no-evidence"
        rowStyle={() => ({ boxShadow: `inset 3px 0 0 ${T.danger}` })}
        maxHeight={320}
        emptyText="Every completed case has at least a file, MoM or timesheet 🎉"
      />

      <SectionLabel right={
        <span style={{ display: "flex", gap: 6 }}>
          <span className="pill" style={{ background: "#E6F4F5", color: MOM_AMC }}>AMC {momCases.filter((c) => c.momAmc.length).length} cases</span>
          <span className="pill" style={{ background: "#EDE9FE", color: MOM_COMM }}>Commissioning {momCases.filter((c) => c.momComm.length).length} cases</span>
        </span>
      }>
        Minutes of Meeting Register
      </SectionLabel>
      <DataTable
        title="Cases with MoM"
        columns={momColumns}
        rows={momCases}
        storageKey="adage_fsm_momreg_cols_v1"
        searchText={(c) => [c.name, caseCustomer(c), momTypeLabel(c), ...momSubjects(c), engineerNames(c.engineerIds, userMap).join(" ")].join(" ")}
        searchPlaceholder="Search MoM..."
        onRowClick={openCase}
        exportName="field-service-mom-register"
        maxHeight={420}
        emptyText="No MoM recorded."
      />
    </div>
  );
}
