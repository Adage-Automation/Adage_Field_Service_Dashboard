export const PERSON_COLORS = [
  "#4F8EF7","#F7924F","#059669","#7C3AED","#DB2777","#D97706","#DC2626","#0891B2",
];

// ─── Field service categorical palettes ───────────────────────────────────────
export const CHART_COLORS = [
  "#02818A", "#4F8EF7", "#F7924F", "#7C3AED", "#059669", "#DB2777", "#D97706", "#0891B2", "#DC2626", "#64748B",
];

export const SERVICE_TYPE_COLORS = {
  AMC: "#02818A", CAMC: "#0891B2", "Pre-commissioning": "#7C3AED", Commissioning: "#4F8EF7",
  "Post-commissioning": "#6366F1", Troubleshooting: "#F7924F", Service: "#059669",
};

export const SPECIAL_DATE_COLORS = { "Site Holiday": "#4F8EF7", "Casual Leave": "#F59E0B", Overtime: "#DC2626" };

export const STAGE_PILL = {
  Completed:     { bg: "#D1FAE5", color: "#059669" },
  "In Progress": { bg: "#E6F4F5", color: "#02818A" },
  Cancelled:     { bg: "#F1F5F9", color: "#64748B" },
};

export const colorFor = (key, map, idx = 0) => map[key] || CHART_COLORS[idx % CHART_COLORS.length];
