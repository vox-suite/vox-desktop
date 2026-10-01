import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFileSync } from "fs";

const host = process.env.TAURI_DEV_HOST;
const appVersion = JSON.parse(readFileSync("./package.json", "utf-8"))
  .version as string;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Same key name as vox-core / Places (New); Vite aliases also accepted.
  const googleMapsKey =
    env.GOOGLE_MAPS_API_KEY ||
    env.VITE_GOOGLE_MAPS_API_KEY ||
    env.VOX_GOOGLE_MAPS_API_KEY ||
    "";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.GOOGLE_MAPS_API_KEY": JSON.stringify(googleMapsKey),
      "import.meta.env.VITE_GOOGLE_MAPS_API_KEY": JSON.stringify(googleMapsKey),
      "import.meta.env.VOX_GOOGLE_MAPS_API_KEY": JSON.stringify(googleMapsKey),
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    worker: {
      format: "es",
    },
    build: {
      // The app loads from disk inside Tauri, so size only affects parse time.
      // maplibre-gl alone is ~1 MB and backs the always-visible map, so it gets
      // its own chunk and the limit is set just above it.
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules/maplibre-gl")) return "maplibre";
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id))
              return "react";
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ["maplibre-gl"],
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
