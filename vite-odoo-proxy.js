/**
 * Vite dev-server proxy for Odoo — same behaviour as api/odoo.js (Vercel), sharing
 * the JSON-RPC client in api/_odoo-rpc.js. Reads ODOO_URL, ODOO_DB, ODOO_USERNAME and
 * ODOO_PASSWORD from .env; they never reach the browser.
 */
import { loadEnv } from "vite";
import { readOdooConfig, createOdooClient, handleOdooRequest, readBody } from "./api/_odoo-rpc.js";

export function odooProxyPlugin() {
  return {
    name: "odoo-proxy",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir || process.cwd(), "");
      const config = readOdooConfig(env);
      if (config.missing.length) {
        console.warn(`\n[odoo-proxy] ⚠  Missing in .env: ${config.missing.join(", ")}\n  API calls will fail until these are set.\n`);
      }
      const client = createOdooClient(config);

      server.middlewares.use("/api/odoo", async (req, res, next) => {
        if (req.method !== "POST") return next();
        const bodyText = await readBody(req);
        const { status, body } = await handleOdooRequest(client, bodyText);
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
      });
    },
  };
}
