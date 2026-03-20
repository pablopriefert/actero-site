import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/n8n-proxy': {
          target: 'https://n8n.srv1403284.hstgr.cloud/api/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/n8n-proxy/, ''),
          headers: {
            'X-N8N-API-KEY': env.VITE_N8N_API_KEY || '',
          },
        },
      },
    },
  };
});