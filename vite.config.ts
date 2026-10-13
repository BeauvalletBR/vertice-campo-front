import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyToken = env.API_PROXY_TOKEN || env.VITE_N8N_SECRET_TOKEN;
  const proxyHeader = env.API_PROXY_HEADER || "x-api-key";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://127.0.0.1:8000",
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
          headers: proxyToken ? { [proxyHeader]: proxyToken } : undefined,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
