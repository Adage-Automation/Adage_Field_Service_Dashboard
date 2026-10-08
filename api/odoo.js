/**
 * Vercel Serverless Function — /api/odoo
 *
 * Forwards the browser's { model, method, args, kwargs } calls to Odoo via the shared
 * JSON-RPC client in ./_odoo-rpc.js. Credentials never reach the browser. The login uid
 * is cached in module scope, so warm re-invocations skip the login round-trip.
 *
 * Required Vercel Environment Variables: ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD
 */
import { readOdooConfig, createOdooClient, handleOdooRequest, readBody } from "./_odoo-rpc.js";

let client = null;

export default async function handler(req, res) {
  if (req.method !== "POST")    { res.status(405).json({ error: "Method Not Allowed" }); return; }

  const config = readOdooConfig(process.env);
  if (config.missing.length) {
    const missing = config.missing.join(", ");
    console.error(`[odoo-proxy] Missing env vars: ${missing}`);
    res.status(500).json({ jsonrpc: "2.0", id: null, error: { code: 500, message: `Server misconfiguration — set in Vercel: ${missing}` } });
    return;
  }
  if (!client) client = createOdooClient(config);

  const bodyText = typeof req.body === "string" ? req.body : req.body ? JSON.stringify(req.body) : await readBody(req);

  const { status, body } = await handleOdooRequest(client, bodyText);
  res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}
