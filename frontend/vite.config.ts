import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rootEnv = loadEnv(mode, resolve(process.cwd(), ".."), "");
  const backendPort = env.APP_PORT || rootEnv.APP_PORT || "8001";

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target:
            env.API_HOST ||
            rootEnv.API_HOST ||
            `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "build",
    },
  };
});
