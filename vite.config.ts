import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/naver': {
          target: 'https://maps.apigw.ntruss.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/naver/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              proxyReq.setHeader('X-NCP-APIGW-API-KEY-ID', env.VITE_NAVER_MAP_CLIENT_ID);
              proxyReq.setHeader('X-NCP-APIGW-API-KEY', env.VITE_NAVER_MAP_CLIENT_SECRET);
            });
          },
        },
      },
    },
  };
});
