import { useState, useRef, useEffect, useMemo } from "react";
import { T } from "../constants/theme";

// Shared UI building blocks, lifted from the CRM dashboard's PipelineTab / TeamTab so
// every tab here looks and behaves exactly like the CRM app.

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
export const avg = (total, n) => (n ? total / n : 0);

export const fmtNum = (n, digits = 0) =>
  Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : "—";

// ─── Section label (10px uppercase, as used on every CRM card) ────────────────
export function CardTitle({ children, color = T.textMuted, right = null, info = null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 10, color, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700 }}>{children}</div>
        {info && <InfoDot text={info} />}
      </div>
      {right}
    </div>
  );
}

// ─── "?" info tooltip (same as InteractiveDonut's info button) ─────────────────
// `text` is a string or [{ label, formula?, text }]. The popover is position: fixed (placed from the button's
// screen position) so table headers and scrolling cards can't clip it; it opens upward near the bottom edge.
const POP_W = 280;
export function InfoDot({ text }) {
  const [pos, setPos] = useState(null); // null = closed
  const show = pos !== null;
  const ref = useRef(null);
  const open = () => {
    const b = ref.current?.getBoundingClientRect();
    if (!b) return;
    const left = Math.max(8, Math.min(b.left, window.innerWidth - POP_W - 8));
    const below = window.innerHeight - b.bottom;
    setPos(below < 280 && b.top > below ? { left, bottom: window.innerHeight - b.top + 10 } : { left, top: b.bottom + 10 });
  };
  const close = () => setPos(null);
  useEffect(() => {
    if (!show) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", close, true); // fixed popover would drift away from the button
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("scroll", close, true); };
  }, [show]);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="More info"
        aria-expanded={show}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={() => (show ? close() : open())}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, padding: 0,
          borderRadius: "50%", border: `1px solid ${show ? T.accent : T.textMuted}`, background: "none",
          color: show ? T.accent : T.textMuted, fontSize: 9, fontWeight: 700, lineHeight: 1, fontFamily: "inherit", cursor: "pointer",
        }}
      >
        ?
      </button>
      {show && (
        <div role="tooltip" style={{
          position: "fixed", ...pos, width: POP_W, maxWidth: "calc(100vw - 16px)", maxHeight: "70vh", overflowY: "auto",
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.18)",
          zIndex: 1000, fontWeight: 400, textTransform: "none", letterSpacing: "normal", textAlign: "left", whiteSpace: "normal", cursor: "default",
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${T.accent}, ${T.accentBdr})` }} />
          <div style={{ padding: "11px 13px", display: "flex", flexDirection: "column", gap: Array.isArray(text) ? 9 : 0 }}>
            {Array.isArray(text)
              ? text.map((item, i) => (
                  <div key={i} style={{ paddingTop: i ? 9 : 0, borderTop: i ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{item.label}</div>
                    {item.formula && (
                      <div style={{
                        fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace", fontSize: 11.5, fontWeight: 700, color: T.accent,
                        background: T.accentBg, border: `1px solid ${T.accentBdr}`, borderRadius: 6, padding: "5px 8px", margin: "2px 0 5px",
                      }}>{item.formula}</div>
                    )}
                    <div style={{ fontSize: 11.5, color: T.textSecondary, lineHeight: 1.5 }}>{item.text}</div>
                  </div>
                ))
              : <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>{text}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Layout helpers ────────────────────────────────────────────────────────────
// ChartRow: a row of cards that all stretch to the tallest one (no ragged white space).
export function ChartRow({ columns, children, style = null }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: columns, gap: 10, alignItems: "stretch", marginBottom: 10, ...(style || {}) }}>
      {children}
    </div>
  );
}

// Stack: several cards in one grid cell, sharing its height.
export function Stack({ children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, height: "100%" }}>{children}</div>;
}

// Panel: a card that fills its cell (and grows inside a Stack), with the standard title.
export function Panel({ title, info = null, titleColor, right = null, children, grow = true, style = null }) {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", minWidth: 0, ...(grow ? { flex: 1, height: "100%" } : {}), ...(style || {}) }}>
      {title && <CardTitle info={info} color={titleColor} right={right}>{title}</CardTitle>}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

// Split bar: one horizontal bar divided into colored parts with a legend (yes/no splits etc.)
export function SplitBar({ parts, unit = "" }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: T.bgInput }}>
        {total > 0 && parts.map((p) => (
          <div key={p.label} className="bar-fill" title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 7 }}>
        {parts.map((p) => (
          <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: T.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
            {p.label} <strong style={{ color: T.textPrimary }}>{fmtNum(p.value)}</strong>{unit}
            {total > 0 && <span style={{ color: T.textMuted }}>({Math.round((p.value / total) * 100)}%)</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// Mini stat: compact label/value pair for summary panels
export function MiniStat({ label, value, color = T.textPrimary, sub = null }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: T.textMuted, letterSpacing: "0.6px", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ─── Key Insights card ─────────────────────────────────────────────────────────
// insights: [{ tone: "good" | "warn" | "bad" | "info", title, text, onClick? }]
const INSIGHT_TONES = {
  good: { color: T.success, bg: T.successBg, icon: "▲" },
  warn: { color: T.warning, bg: T.warningBg, icon: "!" },
  bad:  { color: T.danger,  bg: T.dangerBg,  icon: "⚑" },
  info: { color: T.accent,  bg: T.accentBg,  icon: "i" },
};

export function InsightsCard({ title = "Key Insights", insights, info = null }) {
  if (!insights.length) return null;
  return (
    <div className="card" style={{ padding: "14px 16px", marginBottom: 10 }}>
      <CardTitle info={info || "Generated automatically from the data shown (follows the engineer filter). Click an insight to drill in where available."}>{title}</CardTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10 }}>
        {insights.map((it, i) => {
          const t = INSIGHT_TONES[it.tone] || INSIGHT_TONES.info;
          return (
            <div
              key={i}
              onClick={it.onClick || undefined}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10,
                background: t.bg, border: `1px solid ${t.color}30`, cursor: it.onClick ? "pointer" : "default",
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: t.color, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{t.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.textPrimary, lineHeight: 1.35 }}>{it.title}</div>
                <div style={{ fontSize: 11.5, color: T.textSecondary, lineHeight: 1.45, marginTop: 2 }}>{it.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Column chart (stacked columns, CRM MonthlyClosings style) ─────────────────
// columns: [{ key, label, parts: [{ key, value, color, label }] }]
export function ColumnChart({ columns, height = 170, legend = [], onColumnClick = null, activeKey = null }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...columns.map((c) => c.parts.reduce((s, p) => s + p.value, 0)));
  return (
    <div>
      {legend.length > 0 && (
        <div style={{ display: "flex", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: T.textSecondary }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />{l.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, borderBottom: `1px solid ${T.border}` }}>
        {columns.map((c) => {
          const total = c.parts.reduce((s, p) => s + p.value, 0);
          const isActive = activeKey === c.key;
          const dim = (hover && hover !== c.key) || (activeKey && !isActive);
          return (
            <div
              key={c.key}
              onMouseEnter={() => setHover(c.key)}
              onMouseLeave={() => setHover(null)}
              onClick={onColumnClick ? () => onColumnClick(c.key) : undefined}
              title={`${c.label}: ${c.parts.map((p) => `${p.label} ${p.value}`).join(" · ")}`}
              style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", cursor: onColumnClick ? "pointer" : "default", opacity: dim ? 0.45 : 1, transition: "opacity 0.15s" }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, marginBottom: 3 }}>{total || ""}</div>
              <div style={{ width: "100%", maxWidth: 36, height: `${(total / max) * 82}%`, display: "flex", flexDirection: "column-reverse", borderRadius: "4px 4px 0 0", overflow: "hidden", outline: isActive ? `2px solid ${T.accent}` : "none" }}>
                {c.parts.map((p) => <div key={p.key} style={{ height: total ? `${(p.value / total) * 100}%` : 0, background: p.color, flexShrink: 0 }} />)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
        {columns.map((c) => (
          <div key={c.key} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 9.5, color: activeKey === c.key ? T.accent : T.textMuted, fontWeight: activeKey === c.key ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden" }}>{c.label}</div>
        ))}
      </div>
    </div>
  );
}

// Inline stacked progress bar for table cells
export function MiniStack({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div style={{ display: "flex", height: 7, width: "100%", borderRadius: 4, overflow: "hidden", background: T.bgInput }}>
      {total > 0 && parts.map((p) => <div key={p.label} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
    </div>
  );
}

// ─── KPI stat card ─────────────────────────────────────────────────────────────
const KPI_TONES = {
  default: { value: T.textPrimary, bar: T.accent },
  accent:  { value: T.accent, bar: T.accent },
  success: { value: T.success, bar: T.success },
  warning: { value: T.warning, bar: T.warning },
  danger:  { value: T.danger, bar: T.danger },
};

export function KpiCard({ label, value, sub = null, tone = "default", info = null, onClick = null, active = false }) {
  const t = KPI_TONES[tone] || KPI_TONES.default;
  return (
    <div
      className="card"
      onClick={onClick || undefined}
      style={{
        padding: "14px 16px", borderLeft: `4px solid ${t.bar}`, cursor: onClick ? "pointer" : "default",
        ...(active ? { borderColor: t.bar, background: `${t.bar}0D` } : {}),
      }}
    >
      <CardTitle info={info}>{label}</CardTitle>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.value, lineHeight: 1.1, marginTop: -4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

export function KpiRow({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ─── Pill ──────────────────────────────────────────────────────────────────────
export function Pill({ children, color = T.accent, bg = null, title = null }) {
  return (
    <span title={title || undefined} style={{
      fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: bg || `${color}18`, color,
      whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block",
    }}>
      {children}
    </span>
  );
}

export const Dash = () => <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>;

// ─── Person avatar (initials circle, as on the CRM Team tab) ───────────────────
const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export function Avatar({ name, color, size = 30 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: `${color}18`, border: `1.5px solid ${color}50`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.37, color, fontWeight: 800, flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

// ─── Horizontal bar list (ranking / distribution) ──────────────────────────────
// items: [{ key, label, value, max?, sub?, color?, avatar?, rank? }]
export function BarList({ items, formatValue = (v) => fmtNum(v), emptyText = "No data", showRank = false, maxHeight = null, onItemClick = null, activeKey = null }) {
  const max = Math.max(1, ...items.map((i) => i.max ?? i.value));
  if (items.length === 0) {
    return <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0" }}>{emptyText}</div>;
  }
  const MEDALS = ["#F59E0B", "#94A3B8", "#B45309"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: maxHeight || undefined, overflowY: maxHeight ? "auto" : "visible", paddingRight: maxHeight ? 4 : 0 }}>
      {items.map((it, i) => {
        const color = it.color || T.accent;
        const pct = Math.max(0, Math.min(100, ((it.value || 0) / (it.max ?? max)) * 100));
        const isActive = activeKey != null && activeKey === it.key;
        return (
          <div
            key={it.key}
            onClick={onItemClick ? () => onItemClick(it.key) : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 10, cursor: onItemClick ? "pointer" : "default",
              borderRadius: 8, padding: isActive ? "4px 6px" : 0, background: isActive ? `${color}12` : "transparent",
            }}
          >
            {showRank && (
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10.5, fontWeight: 800,
                background: i < 3 ? `${MEDALS[i]}22` : T.bgInput, color: i < 3 ? MEDALS[i] : T.textMuted,
                border: i < 3 ? `1.5px solid ${MEDALS[i]}66` : `1px solid ${T.border}`,
              }}>
                {i + 1}
              </div>
            )}
            {it.avatar && <Avatar name={it.label} color={color} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <span title={it.label} style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: "nowrap" }}>{formatValue(it.value, it)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: T.bgInput, overflow: "hidden" }}>
                <div className="bar-fill" style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
              </div>
              {it.sub && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{it.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MultiSelect (same as CRM PipelineTab) ─────────────────────────────────────
export function MultiSelect({ label, options, selected, onChange, searchable = false, searchPlaceholder = "Search..." }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  const isActive = selected.length > 0;
  const btnLabel = !isActive ? label : selected.length === 1 ? selected[0] : `${label} (${selected.length})`;
  const visibleOptions = searchable
    ? options.filter((opt) => String(opt).toLowerCase().includes(searchQuery.toLowerCase()))
    : options;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => {
        setOpen((o) => {
          const next = !o;
          if (!next) setSearchQuery("");
          return next;
        });
      }} style={{
        padding: "5px 14px", borderRadius: 100,
        border: `1px solid ${isActive ? T.accent : T.border}`,
        background: isActive ? T.accentBg : T.bgCard,
        color: isActive ? T.accent : T.textSecondary,
        fontSize: 12, fontFamily: "inherit", fontWeight: 500,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      }}>
        <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{btnLabel}</span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: searchable ? 300 : 180, maxWidth: "80vw", maxHeight: 260, overflowY: "auto" }}>
          {searchable && (
            <div style={{ padding: 8, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                onClick={(e) => e.stopPropagation()}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgInput, color: T.textPrimary, fontFamily: "inherit", fontSize: 12, outline: "none", boxSizing: "border-box" }}
              />
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textMuted, fontFamily: "inherit", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {visibleOptions.map(opt => (
            <div key={opt} onClick={() => toggle(opt)} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: selected.includes(opt) ? T.accentBg : "transparent", color: selected.includes(opt) ? T.accent : T.textPrimary }}>
              <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `1.5px solid ${selected.includes(opt) ? T.accent : T.borderMd}`, background: selected.includes(opt) ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selected.includes(opt) && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
              </div>
              {opt}
            </div>
          ))}
          {visibleOptions.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No options</div>}
        </div>
      )}
    </div>
  );
}

// ─── FilterSelect (single-choice pill dropdown, same as CRM PipelineTab) ──────
export function FilterSelect({ value, onChange, options, prefix = "", width = 150 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const handleEscape = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selected = options.find((opt) => opt.value === value);

  return (
    <div ref={ref} style={{ position: "relative", width, minWidth: width, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", padding: "6px 28px 6px 12px", borderRadius: 999, border: `1px solid ${T.border}`,
          background: T.bgCard, color: T.accent, fontSize: 12, fontWeight: 600, fontFamily: "inherit", outline: "none",
          cursor: "pointer", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {prefix}{selected?.label ?? value}
      </button>
      <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: T.accent, pointerEvents: "none" }}>{open ? "▲" : "▼"}</span>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "100%", zIndex: 300,
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10,
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)", maxHeight: 260, overflowY: "auto",
        }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: "8px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                background: opt.value === value ? T.accentBg : "transparent",
                color: opt.value === value ? T.accent : T.textPrimary,
                fontWeight: opt.value === value ? 700 : 500,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SearchSelect (single choice with a search box — header engineer filter) ───
// options: [{ value, label, meta? }]; value null = the "all" option
export function SearchSelect({ value, onChange, options, allLabel = "All", searchPlaceholder = "Search...", width = 240, title = null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const close = () => { setOpen(false); setQuery(""); setHighlight(0); };
  const pick = (v) => { onChange(v); close(); };

  const q = query.trim().toLowerCase();
  const list = [
    ...(q ? [] : [{ value: null, label: allLabel }]),
    ...options.filter((o) => !q || o.label.toLowerCase().includes(q)),
  ];
  const selected = options.find((o) => o.value === value);
  const isActive = value !== null && value !== undefined;

  const onKeyDown = (e) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && list[highlight]) pick(list[highlight].value);
  };

  return (
    <div ref={ref} style={{ position: "relative", width, flexShrink: 0 }}>
      <button
        type="button"
        title={title || undefined}
        onClick={() => (open ? close() : setOpen(true))}
        style={{
          width: "100%", padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: "inherit",
          color: isActive ? T.accent : T.textSecondary, background: isActive ? T.accentBg : T.bgCard,
          border: `1px solid ${isActive ? T.accentBdr : T.border}`, cursor: "pointer", textAlign: "left",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {selected ? `${selected.label}${selected.meta ? ` (${selected.meta})` : ""}` : allLabel}
      </button>
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: isActive ? T.accent : T.textMuted, pointerEvents: "none" }}>{open ? "▲" : "▼"}</span>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, width: Math.max(width, 280), zIndex: 400,
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${T.border}` }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgInput, color: T.textPrimary, fontFamily: "inherit", fontSize: 12, outline: "none" }}
            />
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", padding: "4px 0" }}>
            {list.map((o, i) => {
              const isSel = o.value === value || (o.value === null && !isActive);
              return (
                <div
                  key={o.value ?? "__all"}
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    padding: "8px 14px", fontSize: 12.5, cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10,
                    background: isSel ? T.accentBg : i === highlight ? T.bgCardAlt : "transparent",
                    color: isSel ? T.accent : T.textPrimary, fontWeight: isSel ? 700 : 500,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                  {o.meta !== undefined && <span style={{ color: T.textMuted, fontWeight: 500, flexShrink: 0 }}>{o.meta}</span>}
                </div>
              );
            })}
            {list.length === 0 && <div style={{ padding: "10px 14px", fontSize: 12, color: T.textMuted }}>No engineer matches “{query}”</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── InteractiveDonut (CRM donut, counts instead of revenue) ───────────────────
// segments: [{ key, value, color, displayKey? }]
// grow=false keeps the card at its natural height (use inside a <Stack> next to a growing Panel)
export function InteractiveDonut({ title, infoText = null, segments, centerLabel, onSegmentClick, activeKey, legendMaxHeight = null, unit = "records", formatValue = (v) => fmtNum(v), grow = true }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [drilledKey, setDrilledKey] = useState(null);
  const drilled = drilledKey ? segments.find((s) => s.key === drilledKey) : null;
  const activeSegments = drilled ? drilled.others : segments;
  const total = activeSegments.reduce((s, x) => s + (x.value || 0), 0);

  const size = 120, cx = size / 2, cy = size / 2;
  const R_BASE = 44, R_HOVER = 48;
  const SW_BASE = 14, SW_HOVER = 11;
  const circ_base = 2 * Math.PI * R_BASE;
  const circ_hover = 2 * Math.PI * R_HOVER;

  let cumDashBase = 0, cumDashHover = 0;
  const segs = activeSegments.filter((s) => s.value > 0).map(seg => {
    const dashBase = (seg.value / total) * circ_base;
    const dashHover = (seg.value / total) * circ_hover;
    const s = { ...seg, dashBase, dashHover, offsetBase: cumDashBase, offsetHover: cumDashHover };
    cumDashBase += dashBase;
    cumDashHover += dashHover;
    return s;
  });

  const hovered = hoveredKey ? segs.find(s => s.key === hoveredKey) : null;
  const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", ...(grow ? { height: "100%" } : { flex: "0 0 auto" }) }}>
      <CardTitle info={infoText}>{title}</CardTitle>
      {drilled && (
        <button type="button" onClick={() => setDrilledKey(null)} style={{
          display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 8,
          border: "none", background: "none", padding: 0, color: T.accent, fontWeight: 600, fontSize: 11.5, fontFamily: "inherit", cursor: "pointer",
        }}>← Back · {drilled.displayKey || drilled.key}</button>
      )}
      {segs.length === 0 ? (
        <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0", flex: 1 }}>No data</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
              <circle cx={cx} cy={cy} r={R_BASE} fill="none" stroke={T.bgInput} strokeWidth={SW_BASE} />
              {segs.map((seg, i) => {
                const isHov = hoveredKey === seg.key;
                const isActive = activeKey === seg.key;
                const expand = isHov || isActive;
                const r = expand ? R_HOVER : R_BASE;
                const sw = expand ? SW_HOVER : SW_BASE;
                const circ = expand ? circ_hover : circ_base;
                const dash = (seg.value / total) * circ;
                const offset = expand ? seg.offsetHover : seg.offsetBase;
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
                      strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="butt"
                      opacity={hoveredKey && !isHov ? 0.35 : 1} pointerEvents="none"
                      filter={isActive ? `drop-shadow(0 0 5px ${seg.color}90)` : undefined}
                      style={{ transition: "r 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease" }}
                    />
                    <circle cx={cx} cy={cy} r={R_HOVER} fill="none" stroke="transparent" strokeWidth={SW_HOVER + 8}
                      strokeDasharray={`${seg.dashHover} ${circ_hover - seg.dashHover}`} strokeDashoffset={-seg.offsetHover}
                      strokeLinecap="butt" cursor={(onSegmentClick || (seg.others && seg.others.length > 0)) ? "pointer" : "default"}
                      onMouseEnter={() => setHoveredKey(seg.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => { if (seg.others && seg.others.length > 0) { setHoveredKey(null); setDrilledKey(seg.key); } else if (onSegmentClick) onSegmentClick(seg.key); }}
                    />
                  </g>
                );
              })}
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center", padding: "0 6px" }}>
              {hovered ? (
                <>
                  <div style={{ fontSize: 9, fontWeight: 800, color: hovered.color, lineHeight: 1.2, maxWidth: 66 }}>{hovered.displayKey || hovered.key}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, marginTop: 2 }}>{formatValue(hovered.value)}</div>
                  <div style={{ fontSize: 9, color: T.textMuted }}>{pct(hovered.value)}%</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.textPrimary }}>{formatValue(total)}</div>
                  <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{centerLabel}</div>
                </>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, maxHeight: legendMaxHeight || undefined, overflowY: legendMaxHeight ? "auto" : "visible", paddingRight: legendMaxHeight ? 4 : 0 }}>
            {segs.map(seg => {
              const isActive = activeKey === seg.key;
              const hasBreakdown = seg.others && seg.others.length > 0;
              return (
                <div key={seg.key}
                  onClick={() => { if (hasBreakdown) { setHoveredKey(null); setDrilledKey(seg.key); } else if (onSegmentClick) onSegmentClick(seg.key); }}
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7,
                    cursor: (onSegmentClick || hasBreakdown) ? "pointer" : "default",
                    opacity: hoveredKey && hoveredKey !== seg.key ? 0.4 : 1, transition: "opacity 0.15s",
                    borderLeft: `3px solid ${isActive ? seg.color : "transparent"}`,
                    background: isActive ? `${seg.color}12` : "transparent", borderRadius: 4, paddingLeft: 5,
                  }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0, marginTop: 3 }} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                    <span title={seg.displayKey || seg.key} style={{ fontSize: 11, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                      {seg.displayKey || seg.key}
                      {hasBreakdown && <span aria-hidden="true" style={{ fontSize: 9, color: T.textMuted }}>▸</span>}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>{formatValue(seg.value)} {unit}</span>
                      <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>{pct(seg.value)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active drill-down filter chip (as under the CRM charts row) ───────────────
export function FilterChip({ label, color = T.accent, onClear }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {label}
      <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
    </span>
  );
}

// ─── Excel export (same ExcelJS approach as the CRM pipeline export) ───────────
export async function exportToExcel(fileBase, sheets) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  sheets.forEach(({ name, columns, rows }) => {
    const ws = wb.addWorksheet(name.slice(0, 31));
    ws.columns = columns.map(({ header, width = 18 }) => ({ header, width }));
    rows.forEach((r) => {
      const row = ws.addRow(r);
      r.forEach((cell, i) => {
        if (cell && typeof cell === "object" && cell.hyperlink) row.getCell(i + 1).font = { color: { argb: "FF0563C1" }, underline: true };
      });
    });
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    if (columns.length) ws.autoFilter = { from: "A1", to: { row: 1, column: columns.length } };
  });
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileBase}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// Cross-browser file download: the link must be in the DOM (Firefox / Edge), and the object URL must
// outlive the click; revoking it synchronously can silently cancel the download.
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
}

// ─── DataTable — CRM pipeline list view (resizable, sortable, searchable) ─────
// columns: [{ key, label, weight, render(row), sortValue?(row), exportValue?(row), exportWidth?, info?, exportOnly? }]
//   info       – column description, shown as a "?" hint in the header (same as the CRM list headers)
//   exportOnly – not rendered in the grid, only written to the Excel export (e.g. the Odoo link)
const MIN_COL_PX = 60;
const gridTemplate = (weights) => weights.map((w) => `minmax(${MIN_COL_PX}px, ${w}fr)`).join(" ");

export function DataTable({
  title, columns, rows, rowKey = (r) => r.id, storageKey, searchText = null, searchPlaceholder = "Search...",
  onRowClick = null, toolbar = null, exportName = null, emptyText = "No records match the current filters.",
  rowStyle = null, maxHeight = 560, defaultSort = null,
}) {
  const shown = columns.filter((c) => !c.exportOnly);
  const defaultWeights = shown.map((c) => c.weight || 10);
  const [weights, setWeights] = useState(() => {
    try {
      const saved = storageKey && localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === defaultWeights.length) return parsed;
      }
    } catch { /* ignore malformed/blocked storage */ }
    return defaultWeights;
  });
  const [sort, setSort] = useState(defaultSort);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null); // { ok, text }
  const gridRef = useRef(null);

  const toggleSort = (key) => setSort((s) => (s?.key === key && s.dir === "asc" ? { key, dir: "desc" } : { key, dir: "asc" }));

  const visible = useMemo(() => {
    let list = rows;
    if (query && searchText) {
      const q = query.toLowerCase();
      list = list.filter((r) => searchText(r).toLowerCase().includes(q));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const dir = sort.dir === "asc" ? 1 : -1;
        list = [...list].sort((a, b) => {
          const va = col.sortValue(a), vb = col.sortValue(b);
          if (va === vb) return 0;
          if (va === null || va === undefined || va === "") return 1;
          if (vb === null || vb === undefined || vb === "") return -1;
          return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * dir;
        });
      }
    }
    return list;
  }, [rows, query, sort, columns, searchText]);

  const startColumnResize = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidths = weights;
    const startWidth = startWidths[index];
    const header = e.currentTarget.closest(".fs-list-header");
    const weightPerPx = startWidths.reduce((a, b) => a + b, 0) / Math.max(1, (header?.clientWidth || 1200) - 32);
    let current = startWidths;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(MIN_COL_PX * weightPerPx, startWidth + delta * weightPerPx);
      current = startWidths.map((w, i) => (i === index ? newWidth : w));
      if (gridRef.current) gridRef.current.style.setProperty("--list-grid-cols", gridTemplate(current));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setWeights(current);
      try { if (storageKey) localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* ignore blocked storage */ }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const cols = columns.filter((c) => c.exportValue !== false);
      await exportToExcel(exportName, [{
        name: title || exportName,
        columns: cols.map((c) => ({ header: c.label, width: c.exportWidth || 18 })),
        rows: visible.map((r) => cols.map((c) => (c.exportValue ? c.exportValue(r) : c.sortValue ? c.sortValue(r) ?? "" : ""))),
      }]);
      setExportMsg({ ok: true, text: `✓ Exported ${visible.length} rows` });
    } catch (err) {
      console.error("Excel export failed:", err);
      setExportMsg({ ok: false, text: `Export failed: ${err.message || err}` });
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(null), 4000);
    }
  };

  return (
    <div>
      {/* ── Filter bar (same styling as the CRM pipeline filter bar) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10, padding: "10px 16px", borderRadius: 12, background: "#ffffff", border: `1px solid ${T.border}` }}>
        {title && <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginRight: 4 }}>{title}</div>}
        <span style={{ fontSize: 12, color: T.textMuted }}>{visible.length} of {rows.length}</span>
        {toolbar}
        <div style={{ flex: 1 }} />
        {exportMsg && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: exportMsg.ok ? T.success : T.danger }}>{exportMsg.text}</span>
        )}
        {exportName && (
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Export the rows shown to Excel"
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.accent}`, background: T.bgCard, color: T.accent, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: exporting ? "wait" : "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {exporting ? "Exporting…" : "⬇ Export Excel"}
          </button>
        )}
        {searchText && (
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgInput, color: T.textPrimary, fontFamily: "inherit", fontSize: 12, width: 200, outline: "none" }}
          />
        )}
      </div>

      <div ref={gridRef} style={{ "--list-grid-cols": gridTemplate(weights), border: `1px solid ${T.border}`, borderRadius: 10, overflow: "auto", maxHeight, background: "#fff" }}>
        <div style={{ minWidth: Math.max(1000, shown.length * 105) }}>
          <div className="fs-list-header">
            {shown.map((c, idx) => (
              <div
                key={c.key}
                className="fs-list-header-cell"
                onClick={c.sortValue ? () => toggleSort(c.key) : undefined}
                style={c.sortValue ? { cursor: "pointer", userSelect: "none" } : undefined}
              >
                <span>{c.label}{c.sortValue && (sort?.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅")}</span>
                {c.info && (
                  <span style={{ marginLeft: 4, display: "inline-flex" }}><InfoDot text={c.info} /></span>
                )}
                {idx < shown.length - 1 && (
                  <div className="col-resize-handle" onMouseDown={(e) => startColumnResize(e, idx)} onClick={(e) => e.stopPropagation()} title="Drag to resize this column" />
                )}
              </div>
            ))}
          </div>
          {visible.map((r) => (
            <div
              key={rowKey(r)}
              className="fs-list-row"
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              style={{ cursor: onRowClick ? "pointer" : "default", ...(rowStyle ? rowStyle(r) : {}) }}
            >
              {shown.map((c) => <div key={c.key}>{c.render(r)}</div>)}
            </div>
          ))}
          {visible.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted, fontSize: 13 }}>{emptyText}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Primary + secondary cell text (opp-title / opp-company in the CRM list)
export function TitleCell({ title, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <div className="opp-title" title={title}>{title || "—"}</div>
      {sub && <div className="opp-company" title={sub}>{sub}</div>}
    </div>
  );
}

const cellText = { fontSize: 11.5, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" };
export const Txt = ({ children, title = null, style = null }) => (
  <span style={{ ...cellText, ...(style || {}) }} title={title ?? (typeof children === "string" ? children : undefined)}>
    {children === null || children === undefined || children === "" ? "—" : children}
  </span>
);

// Global CSS for the list view (rendered once by App)
export const TABLE_CSS = `
  .fs-list-header { display: grid; grid-template-columns: var(--list-grid-cols); padding: 5px 16px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; position: sticky; top: 0; z-index: 10; }
  .fs-list-header-cell { position: relative; display: flex; align-items: center; min-width: 0; padding-left: 8px; padding-right: 8px; }
  .fs-list-header-cell:first-child { padding-left: 0; }
  .fs-list-header span { font-size: 9.5px; font-weight: 700; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
  .fs-list-header .col-info { flex-shrink: 0; margin-left: 4px; width: 13px; height: 13px; border-radius: 50%; border: 1px solid #9ca3af; color: #9ca3af; font-size: 9px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; cursor: help; letter-spacing: 0; text-transform: none; overflow: visible; }
  .fs-list-header .col-info:hover { border-color: #02818A; color: #02818A; }
  .col-resize-handle { position: absolute; top: 0; right: -8px; width: 16px; height: 100%; cursor: col-resize; z-index: 5; }
  .col-resize-handle::after { content: ""; position: absolute; top: 15%; bottom: 15%; left: 50%; transform: translateX(-50%); width: 3px; border-radius: 3px; background: #02818A; opacity: 0.55; }
  .col-resize-handle:hover::after, .col-resize-handle:active::after { top: 8%; bottom: 8%; width: 4px; opacity: 1; }
  .col-resize-handle:hover, .col-resize-handle:active { background: rgba(2, 129, 138, 0.12); }
  .fs-list-row { display: grid; grid-template-columns: var(--list-grid-cols); padding: 4px 16px; border-bottom: 1px solid #f1f5f9; background: white; align-items: center; transition: background 0.15s; min-height: 36px; }
  .fs-list-row:hover { background: #f0fdfd !important; }
  .fs-list-row > div { text-align: left; border-right: 1px solid #f1f5f9; padding-right: 8px; padding-left: 8px; min-width: 0; }
  .fs-list-row > div:first-child { padding-left: 0; }
  .fs-list-row > div:last-child { border-right: none; padding-right: 0; }
  .opp-title { font-size: 12.5px; font-weight: 600; color: #1e293b; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .opp-company { font-size: 10.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .col-value { font-size: 12.5px; font-weight: 700; color: #02818A; }
`;
