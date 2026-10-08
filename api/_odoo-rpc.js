/**
 * Shared Odoo client used by both proxies (api/odoo.js on Vercel, vite-odoo-proxy.js in dev).
 * Files prefixed with "_" are not exposed as Vercel routes.
 *
 * Uses Odoo's external JSON-RPC API (/jsonrpc → common.login + object.execute_kw), which
 * accepts an API key as the password. The CRM app's /web/session/authenticate flow does
 * not: Odoo 19 rejects API keys for web sessions with "Access Denied".
 *
 * Env (server-side only):
 *   ODOO_URL       – https://your-instance.odoo.com
 *   ODOO_DB        – database name
 *   ODOO_USERNAME  – login email of the Odoo user
 *   ODOO_PASSWORD  – API key (preferred) or account password
 * The VITE_ODOO_URL / VITE_ODOO_DB / VITE_ODOO_LOGIN / VITE_ODOO_API_KEY names from the
 * CRM app are accepted as fallbacks.
 */

export function readOdooConfig(env) {
  const config = {
    url: (env.ODOO_URL || env.VITE_ODOO_URL || "").replace(/\/+$/, ""),
    db: env.ODOO_DB || env.VITE_ODOO_DB,
    login: env.ODOO_USERNAME || env.VITE_ODOO_LOGIN,
    password: env.ODOO_PASSWORD || env.VITE_ODOO_API_KEY || env.VITE_ODOO_PASSWORD,
  };
  config.missing = [
    !config.url && "ODOO_URL",
    !config.db && "ODOO_DB",
    !config.login && "ODOO_USERNAME",
    !config.password && "ODOO_PASSWORD",
  ].filter(Boolean);
  return config;
}

// Odoo.com throttles bursts of RPC calls ("Rate limit exceeded", HTTP 429). Keep at most
// MAX_CONCURRENT calls in flight per proxy instance and retry throttled calls with backoff.
const MAX_CONCURRENT = 2;
const RETRY_DELAYS_MS = [1000, 2500, 5000];
let active = 0;
const waiting = [];
const acquire = () => (active < MAX_CONCURRENT ? (active++, Promise.resolve()) : new Promise((resolve) => waiting.push(resolve)));
const release = () => { const next = waiting.shift(); if (next) next(); else active--; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jsonrpc(url, service, method, args) {
  for (let attempt = 0; ; attempt++) {
    await acquire();
    try {
      return await jsonrpcOnce(url, service, method, args);
    } catch (err) {
      if (!err.rateLimited || attempt >= RETRY_DELAYS_MS.length) throw err;
      console.warn(`[odoo-proxy] Rate limited — retrying in ${RETRY_DELAYS_MS[attempt]}ms`);
    } finally {
      release();
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

async function jsonrpcOnce(url, service, method, args) {
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: Date.now(), params: { service, method, args } }),
  });
  const text = await res.text();

  // Odoo returns HTML on rate-limit / maintenance
  if (res.status === 429 || /<!DOCTYPE|<html/i.test(text)) {
    const titleMatch = /<title>([^<]+)<\/title>/i.exec(text);
    const err = new Error(titleMatch ? titleMatch[1].trim() : res.status === 429 ? "Rate limit exceeded" : "Odoo returned an HTML error page");
    err.rateLimited = res.status === 429 || /rate limit/i.test(err.message);
    throw err;
  }
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Odoo returned non-JSON: ${text.slice(0, 100)}`);
  }
  if (data.error) throw new Error(data.error.data?.message || data.error.message || "Odoo error");
  return data.result;
}

/** Creates a client that logs in once (uid cached) and forwards execute_kw calls. */
export function createOdooClient(config) {
  let uid = null;
  let loginInFlight = null;

  const ensureUid = () => {
    if (uid) return Promise.resolve(uid);
    if (loginInFlight) return loginInFlight;
    loginInFlight = jsonrpc(config.url, "common", "login", [config.db, config.login, config.password])
      .then((result) => {
        loginInFlight = null;
        if (!result) throw new Error("Authentication failed — check ODOO_DB, ODOO_USERNAME and ODOO_PASSWORD");
        uid = result;
        console.log(`[odoo-proxy] ✓ Authenticated as ${config.login} (uid=${uid})`);
        return uid;
      })
      .catch((err) => {
        loginInFlight = null;
        throw err;
      });
    return loginInFlight;
  };

  /** params = { model, method, args, kwargs } as sent by src/lib/odoo.js */
  const call = async (params) => {
    const { model, method, args = [], kwargs = {} } = params || {};
    if (!model || !method) throw new Error("Missing model/method");
    const id = await ensureUid();
    try {
      return await jsonrpc(config.url, "object", "execute_kw", [config.db, id, config.password, model, method, args, kwargs]);
    } catch (err) {
      // Credentials rotated mid-flight — log in again once and retry
      if (/access denied|session expired/i.test(err.message)) {
        uid = null;
        const fresh = await ensureUid();
        return jsonrpc(config.url, "object", "execute_kw", [config.db, fresh, config.password, model, method, args, kwargs]);
      }
      throw err;
    }
  };

  return { call };
}

/** Reads a Node request stream into a string. */
export const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

/** Turns a raw request body into the JSON-RPC response body the browser expects. */
export async function handleOdooRequest(client, bodyText) {
  let payload;
  try { payload = JSON.parse(bodyText || "{}"); } catch {
    return { status: 400, body: { jsonrpc: "2.0", id: null, error: { code: 400, message: "Invalid JSON body" } } };
  }
  try {
    const result = await client.call(payload.params);
    return { status: 200, body: { jsonrpc: "2.0", id: payload.id ?? null, result } };
  } catch (err) {
    console.error(`[odoo-proxy] ${payload.params?.model}.${payload.params?.method}: ${err.message}`);
    return { status: 200, body: { jsonrpc: "2.0", id: payload.id ?? null, error: { code: 200, message: err.message, data: { message: err.message } } } };
  }
}
