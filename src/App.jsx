import { useState, useEffect, useCallback, useMemo, useRef, Component } from "react";
import { useMsal } from "@azure/msal-react";
import { T } from "./constants/theme";
import { fetchOdoo } from "./lib/odoo";
import { buildModel, filterModel } from "./lib/derive";
import { TABLE_CSS, SearchSelect } from "./components/ui";
import { OverviewTab }   from "./views/OverviewTab";
import { WorksheetsTab } from "./views/WorksheetsTab";
import { DocumentsTab }  from "./views/DocumentsTab";
import { TimesheetsTab } from "./views/TimesheetsTab";
import { ReportTab }     from "./views/ReportTab";
import mainLogo from "./logos/Main Logo.png";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div style={{ background: T.dangerBg, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 20, color: "#B91C1C", fontSize: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>UI Error</div>
          <div style={{ color: "#B91C1C" }}>{msg}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Odoo models (technical names confirmed against the schema PDFs + live instance) ──
const TASK_FIELDS = [
  "name", "partner_id", "x_studio_end_user", "x_studio_regions", "x_studio_call_type", "x_studio_problem_type",
  "x_studio_service_engineers", "stage_id", "x_studio_task_status", "x_studio_created_on",
  "create_date", "x_studio_control_no", "x_studio_scrn",
  "project_id", "date_last_stage_update", "message_attachment_count", "attachment_ids", // last two non-stored: readable, not filterable
];
const WORKSHEET_MODEL = "x_project_task_worksheet_template_4"; // "Service Call Worksheet"
const WORKSHEET_FIELDS = [
  "x_name", "x_studio_task_id", "x_studio_service_type", "x_studio_problems_identified",
  "x_studio_problems_found_", "x_studio_spare_parts_used", "x_studio_spare_parts_was_used_",
  "x_studio_actual_visit_start_date", "x_studio_actual_visit_end_date",
  "x_studio_assigned_service_engineer", "x_studio_customer_requirement", "create_date",
  "x_studio_resolution_applied", "create_uid",
];
const TIMESHEET_MODEL = "x_project_task_line_d19f2";
const TIMESHEET_FIELDS = [
  "x_name", "x_project_task_id", "x_studio_dated", "x_studio_plant_section", "x_studio_plant_site",
  "x_studio_total_working_hours", "x_studio_total_overtime_hours", "x_studio_submitted_by",
  "x_studio_travel_to_start_date", "x_studio_travel_to_end_date", "x_studio_travel_to_site",
  "x_studio_travel_from_start_date", "x_studio_travel_from_end_date", "x_studio_travel_from_site",
  "x_studio_work_start_date", "x_studio_work_end_date", "create_uid",
];
const SPECIAL_DATE_MODEL = "x_project_task_line_d19f2_line_1c99e";
const MOM_AMC_MODEL = "x_project_task_line_34995";
const MOM_COMM_MODEL = "x_project_task_line_12c3e";
const MOM_FIELDS = ["x_name", "x_project_task_id", "x_studio_date", "x_studio_service_engineers", "x_studio_minutes_recorded_by", "create_uid"];
const CERT_MODEL = "x_project_task_line_3517d";     // Commissioning Certificate
const DOC_SECTION_MODEL = "x_project_task_line_04bec"; // Documents section (uploaded files)

const ENGINEER_STORAGE_KEY = "adage_fsm_engineer_id";

export default function App() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [activeTab, setActiveTab] = useState("report");
  const [raw, setRaw]             = useState(null);
  const [loading, setLoading]     = useState(true);   // first load only (full-page loader)
  const [refreshing, setRefreshing] = useState(false); // background refresh (data stays on screen)
  const [error, setError]         = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toast, setToast]         = useState(null);    // { ok, text }
  const [userMap, setUserMap]     = useState({});
  const [serviceEngineers, setServiceEngineers] = useState([]); // {id, name} roster managed by Samaresh Dey (id 184)
  const [engineerId, setEngineerId] = useState(() => {
    try {
      const stored = localStorage.getItem(ENGINEER_STORAGE_KEY);
      return stored ? Number(stored) : null;
    } catch { return null; }
  });

  const handleEngineerChange = useCallback((id) => {
    setEngineerId(id);
    try {
      if (id) localStorage.setItem(ENGINEER_STORAGE_KEY, String(id));
      else localStorage.removeItem(ENGINEER_STORAGE_KEY);
    } catch { /* ignore blocked storage */ }
  }, []);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  // First call shows the full-page loader; later calls (Refresh button) refresh in the background
  // and keep the current data visible, so the page never blanks out.
  const hasData = useRef(false);
  const loadData = useCallback(async () => {
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const all = { limit: 5000 };
      const [tasks, worksheets, timesheets, specialDates, momAmc, momComm, certs, docSection, problems, spares] = await Promise.all([
        fetchOdoo("project.task", "search_read", [[["is_fsm", "=", true]]], { fields: TASK_FIELDS, order: "create_date desc", ...all }),
        fetchOdoo(WORKSHEET_MODEL, "search_read", [[]], { fields: WORKSHEET_FIELDS, ...all }),
        fetchOdoo(TIMESHEET_MODEL, "search_read", [[]], { fields: TIMESHEET_FIELDS, ...all }),
        fetchOdoo(SPECIAL_DATE_MODEL, "search_read", [[]], { fields: ["x_name", "x_studio_type", "x_studio_date", "x_studio_hours", "x_project_task_line_d19f2_id"], ...all }),
        fetchOdoo(MOM_AMC_MODEL, "search_read", [[]], { fields: MOM_FIELDS, ...all }),
        fetchOdoo(MOM_COMM_MODEL, "search_read", [[]], { fields: MOM_FIELDS, ...all }),
        fetchOdoo(CERT_MODEL, "search_read", [[]], { fields: ["x_name", "x_project_task_id", "x_studio_date_of_commissioning"], ...all }),
        fetchOdoo(DOC_SECTION_MODEL, "search_read", [[]], { fields: ["x_name", "x_project_task_id", "x_studio_uploaded_by", "x_studio_revision_number"], ...all }),
        fetchOdoo("x_problems", "search_read", [[]], { fields: ["x_name"], ...all }),
        fetchOdoo("x_spare_parts", "search_read", [[]], { fields: ["x_name", "x_studio_item_description", "x_studio_item_number"], ...all }),
      ]);

      // Resolve every hr.employee id referenced anywhere → name
      const empIds = new Set();
      const collect = (v) => (Array.isArray(v) ? v : []).forEach((x) => { const id = Array.isArray(x) ? x[0] : x; if (Number.isFinite(id)) empIds.add(id); });
      (tasks || []).forEach((t) => collect(t.x_studio_service_engineers));
      (worksheets || []).forEach((w) => collect(w.x_studio_assigned_service_engineer));
      (timesheets || []).forEach((t) => collect(t.x_studio_submitted_by));
      [...(momAmc || []), ...(momComm || [])].forEach((m) => collect(m.x_studio_service_engineers));

      const map = {};
      if (empIds.size > 0) {
        try {
          const employees = await fetchOdoo("hr.employee", "search_read", [[["id", "in", Array.from(empIds)]]], { fields: ["id", "name"], limit: 5000, context: { lang: "en_US", active_test: false } });
          (employees || []).forEach((emp) => { map[emp.id] = emp.name; });
        } catch (umErr) { console.warn("employeeMap load error:", umErr); }
      }

      try {
        const svcEngineers = await fetchOdoo("hr.employee", "search_read", [[["parent_id", "=", 184]]], { fields: ["id", "name"], limit: 5000, context: { lang: "en_US" } });
        setServiceEngineers((svcEngineers || []).map((e) => ({ id: e.id, name: e.name })));
      } catch (seErr) { console.warn("service engineer list load error:", seErr); }

      setUserMap(map);
      setRaw({ tasks, worksheets, timesheets, specialDates, momAmc, momComm, certs, docSection, problems, spares });
      setLastUpdated(new Date());
      if (hasData.current) setToast({ ok: true, text: `✓ Data refreshed from Odoo · ${tasks.length} jobs, ${worksheets.length} worksheets` });
      hasData.current = true;
    } catch (e) {
      if (hasData.current) setToast({ ok: false, text: `Refresh failed: ${e.message}. Showing the previous data.` });
      else setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const fullModel = useMemo(() => (raw ? buildModel(raw) : null), [raw]);

  // Engineer dropdown: everyone assigned to at least one FSM case, busiest first
  const engineers = useMemo(() => {
    if (!fullModel) return [];
    const counts = {};
    fullModel.cases.forEach((c) => c.engineerIds.forEach((id) => { counts[id] = (counts[id] || 0) + 1; }));
    return Object.entries(counts)
      .map(([id, count]) => ({ id: Number(id), name: userMap[id] || `Employee #${id}`, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fullModel, userMap]);

  // Drop a stale stored engineer that no longer has any FSM case
  useEffect(() => {
    if (fullModel && engineerId && !engineers.some((e) => e.id === engineerId)) {
      setEngineerId(null);
      try { localStorage.removeItem(ENGINEER_STORAGE_KEY); } catch { /* ignore */ }
    }
  }, [fullModel, engineers, engineerId]);

  const model = useMemo(() => (fullModel ? filterModel(fullModel, engineerId) : null), [fullModel, engineerId]);
  const engineerName = engineerId ? userMap[engineerId] || `Employee #${engineerId}` : null;

  // No tabs shown in the header for now; Report still renders by default (filtered out here, not removed).
  const tabs = [];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', 'Segoe UI', sans-serif", background: "#F7F7FA", minHeight: "100vh", color: T.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.scrollThumb}; border-radius: 3px; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .tab-btn:hover { background: ${T.accentBg} !important; color: ${T.accent} !important; }
        .card { background: ${T.bgCard}; border: 1px solid ${T.border}; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); }
        .card:hover { border-color: ${T.borderMd}; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .pill { border-radius: 100px; font-size: 11px; font-weight: 600; padding: 3px 10px; display: inline-block; }
        .bar-fill { transition: width 0.8s cubic-bezier(.4,0,.2,1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .fade-in { animation: fadeIn 0.35s ease; } /* no "forwards": a held transform would trap position:fixed popovers */
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
        .pulse { animation: pulse 2s infinite; }
        @media (prefers-reduced-motion: reduce) { .fade-in, .bar-fill, .pulse { animation: none; transition: none; } }
        ${TABLE_CSS}
      `}</style>

      {/* Header */}
      <div data-app-header style={{ borderBottom: `1px solid ${T.border}`, padding: "0 28px", background: T.bgHeader, display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={() => setActiveTab("report")}
            style={{ background: "none", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1, cursor: "pointer", fontFamily: "inherit" }}
          >
            <img src={mainLogo} alt="ADAGE" style={{ height: 22, width: "auto", display: "block" }} />
            <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "1.6px", textTransform: "uppercase", marginTop: 4, fontWeight: 700 }}>
              FIELD SERVICE INTELLIGENCE
            </div>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SearchSelect
            value={engineerId}
            onChange={handleEngineerChange}
            options={engineers.map((e) => ({ value: e.id, label: e.name, meta: e.count }))}
            allLabel="All Service Engineers"
            searchPlaceholder="Search service engineer..."
            title="Filter every tab by assigned engineer"
            width={240}
          />
          <div style={{ width: 1, height: 22, background: T.border, margin: "0 8px" }} />
          {tabs.map(t => (
            <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: activeTab === t.id ? T.accent : T.textSecondary,
              background: activeTab === t.id ? T.accentBg : "transparent",
              border: activeTab === t.id ? `1px solid ${T.accentBdr}` : "1px solid transparent",
            }}>{t.label}</button>
          ))}
          <button
            onClick={loadData}
            disabled={loading || refreshing}
            title={lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString("en-IN")} — click to reload live data from Odoo` : "Reload live data from Odoo"}
            style={{ marginLeft: 8, background: T.accentBg, border: `1px solid ${T.accentBdr}`, color: T.accent, borderRadius: 8, padding: "7px 14px", cursor: refreshing ? "wait" : "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span className={refreshing ? "spin" : ""} style={{ display: "inline-block" }}>⟳</span>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {lastUpdated && (
            <span style={{ fontSize: 10.5, color: T.textMuted, marginLeft: 6, lineHeight: 1.2, whiteSpace: "nowrap" }}>
              Updated<br />{lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {account && (
            <>
              <div style={{ width: 1, height: 22, background: T.border, margin: "0 8px" }} />
              <span style={{ fontSize: 12.5, color: T.textSecondary, fontWeight: 500, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={account.username}>
                {account.name || account.username}
              </span>
              <button
                onClick={() => instance.logoutRedirect()}
                title="Sign out"
                style={{ marginLeft: 8, background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>

      {refreshing && <div className="pulse" style={{ position: "sticky", top: 60, zIndex: 99, height: 3, background: "linear-gradient(90deg, #02818A, #04A8B4)" }} />}
      {toast && (
        <div style={{
          position: "fixed", right: 24, bottom: 24, zIndex: 500, padding: "10px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
          background: toast.ok ? T.successBg : T.dangerBg, color: toast.ok ? T.success : T.danger,
          border: `1px solid ${toast.ok ? T.success : T.danger}40`, boxShadow: T.shadowMd,
        }}>
          {toast.text}
        </div>
      )}

      <div style={{ padding: "24px 28px", minHeight: "calc(100vh - 60px)", opacity: refreshing ? 0.6 : 1, transition: "opacity 0.2s" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
            <div className="pulse" style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #02818A, #04A8B4)" }} />
            <div style={{ color: T.textMuted, fontSize: 14 }}>Connecting to Odoo Field Service…</div>
          </div>
        )}
        {error && (
          <div style={{ background: T.dangerBg, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 20, color: "#B91C1C", fontSize: 14 }}>
            <strong>Connection error:</strong> {error}
            <div style={{ marginTop: 8, fontSize: 12, color: T.textMuted }}>Check that ODOO_URL, ODOO_DB, ODOO_USERNAME and ODOO_PASSWORD in .env are correct.</div>
          </div>
        )}

        {!loading && !error && model && (
          <ErrorBoundary key={activeTab}>
            <div className="fade-in">
              {engineerName && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12, color: T.textMuted }}>
                  Showing records assigned to
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: `${T.accent}18`, color: T.accent, border: `1px solid ${T.accent}40` }}>
                    {engineerName}
                    <button onClick={() => handleEngineerChange(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
                  </span>
                </div>
              )}
              {activeTab === "overview"   && <OverviewTab model={model} userMap={userMap} />}
              {activeTab === "worksheets" && <WorksheetsTab model={model} userMap={userMap} />}
              {activeTab === "documents"  && <DocumentsTab model={model} userMap={userMap} />}
              {activeTab === "timesheets" && <TimesheetsTab model={model} userMap={userMap} filtered={!!engineerId} />}
              {activeTab === "report"     && <ReportTab model={model} userMap={userMap} engineerName={engineerName} lastUpdated={lastUpdated} serviceEngineerCount={serviceEngineers.length} serviceEngineers={serviceEngineers} />}
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
