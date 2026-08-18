import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

/** Production site lives under IIS path /lfb_cms/frontend/ (same pattern as IPMS). */
const PROD_BASE = "/lfb_cms/frontend/";

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  const base = isProd ? PROD_BASE : "/";

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react()],
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      hmr: {
        host: "localhost",
        port: 5174,
        protocol: "ws",
      },
      watch: {
        ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/*.log"],
      },
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 5174,
    },
  };
});
