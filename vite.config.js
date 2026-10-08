import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { odooProxyPlugin } from "./vite-odoo-proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  const isDev = command === "serve";
  // Load ALL env vars (not just VITE_-prefixed) so the public Odoo web URL can be
  // exposed to the client for "open in Odoo" links. Only the URL is exposed —
  // ODOO_USERNAME / ODOO_PASSWORD stay server-side in the proxy.
  const env = loadEnv(mode, process.cwd(), "");
  const odooUrl = (env.ODOO_URL || env.VITE_ODOO_URL || "").replace(/\/+$/, "");

  return {
    // Only load the dev proxy plugin in local dev — not during Vercel build
    plugins: [react(), ...(isDev ? [odooProxyPlugin()] : [])],

    define: {
      "import.meta.env.VITE_ODOO_URL": JSON.stringify(odooUrl),
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    server: {
      port: 5173,
    },

    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          // Split vendor chunk for better caching
          manualChunks: {
            react: ["react", "react-dom"],
          },
        },
      },
    },
  };
});
