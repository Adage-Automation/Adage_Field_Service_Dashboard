import { T } from "../constants/theme";
import { CHART_COLORS, STAGE_PILL } from "../constants/colors";
import { odooTaskUrl } from "../lib/odoo";
import { Pill, Dash, TitleCell, InfoDot } from "../components/ui";

// ─── Case-level helpers shared by every tab ──────────────────────────────────

export const caseCustomer = (c) => c?.partner_id?.[1] || "";
export const caseEndUser = (c) => c?.x_studio_end_user?.[1] || "";
export const engineerNames = (idList, userMap) => (idList || []).map((id) => userMap[id] || `Employee #${id}`);

// Stable color per string (regions, call types, etc. have too many values for fixed maps)
export const hashColor = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CHART_COLORS[h % CHART_COLORS.length];
};

export const fmtDay = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).split(/[T ]/)[0].split("-").map(Number);
  if (!y) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const isoDay = (iso) => (iso ? String(iso).split(/[T ]/)[0] : "");

export function EngineerPills({ ids, userMap }) {
  const names = engineerNames(ids, userMap);
  if (names.length === 0) return <Dash />;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {names.map((n) => (
        <span key={n} title={n} style={{ fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 999, background: "#F1F5F9", color: "#475569", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {n}
        </span>
      ))}
    </div>
  );
}

export function StagePill({ stage }) {
  if (!stage) return <Dash />;
  const p = STAGE_PILL[stage] || { bg: T.bgInput, color: T.textSecondary };
  return <Pill color={p.color} bg={p.bg}>{stage}</Pill>;
}

export function TagPill({ value }) {
  if (!value) return <Dash />;
  return <Pill color={hashColor(value)} title={value}>{value}</Pill>;
}

export function CountBadge({ n, color = "#0284c7", bg = "#e0f2fe" }) {
  if (!n) return <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 24, padding: "0 6px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 700 }}>
      {n}
    </span>
  );
}

export function YesNo({ yes, yesLabel = "Yes", noLabel = "No", noColor = T.danger, noBg = T.dangerBg }) {
  return yes
    ? <Pill color={T.success} bg={T.successBg}>✓ {yesLabel}</Pill>
    : <Pill color={noColor} bg={noBg}>✗ {noLabel}</Pill>;
}

// Document-check flag for a case (see buildModel in lib/derive.js)
export const FLAG_META = {
  no_mom:       { label: "No MoM",       short: "Worksheet · no MoM", color: "#DC2626", bg: "#FEE2E2" },
  no_worksheet: { label: "No Worksheet", short: "Docs · no worksheet", color: "#EA580C", bg: "#FFEDD5" },
};

export function FlagCell({ c, showReason = true }) {
  if (!c.flag) {
    if (c.attachedFiles) return <Pill color={T.success} bg={T.successBg} title={`${c.attachedFiles} file(s) in the case's Attachments field`}>✓ Attached</Pill>;
    return c.hasWorksheet || c.hasAnyDoc
      ? <Pill color={T.success} bg={T.successBg}>✓ OK</Pill>
      : <Pill color={T.textMuted} bg={T.bgInput} title="No worksheet and no documents yet">Not started</Pill>;
  }
  const m = FLAG_META[c.flag];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }} title={c.flagReason}>
      <span><Pill color={m.color} bg={m.bg}>⚑ {m.label}</Pill></span>
      {showReason && <span style={{ fontSize: 10, color: m.color, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c.flagReason}</span>}
    </div>
  );
}

export const flagExport = (c) => (c.flag ? `${FLAG_META[c.flag].label}: ${c.flagReason}` : c.attachedFiles ? "OK (files attached)" : c.hasWorksheet || c.hasAnyDoc ? "OK" : "Not started");

// Flag & Reason, Case, Service Engineers, Stage: the leading columns of every flagged-records table
export const flagCaseColumns = (userMap) => [
  { key: "flag", label: "Flag & Reason", weight: 20, exportWidth: 60,
    info: "⚑ No MoM: a worksheet is filled but no MoM (AMC) or MoM Commissioning is recorded.\n⚑ No Worksheet: a MoM, Commissioning Certificate or Documents-section file is recorded but no worksheet is filled.\n✓ Attached: files in the case's Attachments field, so it is never flagged.\n✓ OK: worksheet and MoM are both present.\nNot started: neither yet.",
    render: (c) => <FlagCell c={c} />,
    sortValue: (c) => (c.flag === "no_mom" ? 0 : c.flag === "no_worksheet" ? 1 : c.hasMom || c.attachedFiles ? 3 : 2), exportValue: flagExport },
  { key: "case", label: "Case", weight: 23, exportWidth: 44, render: (c) => <TitleCell title={c.name} sub={caseCustomer(c)} />, sortValue: (c) => c.name },
  { key: "engineers", label: "Service Engineers", weight: 14, exportWidth: 32,
    render: (c) => <EngineerPills ids={c.engineerIds} userMap={userMap} />,
    sortValue: (c) => engineerNames(c.engineerIds, userMap).join(", "), exportValue: (c) => engineerNames(c.engineerIds, userMap).join(", ") },
  { key: "stage", label: "Stage", weight: 8, render: (c) => <StagePill stage={c.stage_id?.[1]} />, sortValue: (c) => c.stage_id?.[1] || "" },
];

export const openCase = (c) => c?.id && window.open(odooTaskUrl(c.id), "_blank", "noopener,noreferrer");
export const odooLinkCell = (id) => (id ? { text: "Open in Odoo", hyperlink: odooTaskUrl(id) } : "");

// Section heading used between dashboard blocks
export function SectionLabel({ children, right = null, info = null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700 }}>{children}</div>
        {info && <InfoDot text={info} />}
      </div>
      {right}
    </div>
  );
}
