/**
 * Odoo API client
 *
 * All calls go to /api/odoo — the proxy handles authentication.
 * Dev  → vite-odoo-proxy.js (Vite middleware)
 * Prod → api/odoo.js (Vercel serverless function)
 */

// Base URL of the Odoo instance (e.g. https://adage-automation.odoo.com), used to build
// "open in Odoo" links. Read from the same VITE_ODOO_URL used to configure the proxy, so the
// instance only needs to be changed in one place (.env). Safe to expose client-side — it's just
// the public web app URL, already embedded in clickable link hrefs.
const ODOO_BASE_URL = import.meta.env.VITE_ODOO_URL || "";

export const fetchOdoo = async (model, method, args = [], kwargs = {}) => {
  const res = await fetch("/api/odoo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        model,
        method,
        args,
        kwargs: { context: { lang: "en_US" }, ...kwargs },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message);
  return data.result;
};

// "Open in Odoo" link for a field service task (project.task record).
export const odooTaskUrl = (id) => `${ODOO_BASE_URL}/odoo/project.task/${id}`;

// "Open in Odoo" link for a service engineer (hr.employee record).
export const odooEmployeeUrl = (id) => `${ODOO_BASE_URL}/odoo/hr.employee/${id}`;
