import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const aholoBase = env.AHOLO_API_BASE || env.VITE_AHOLO_API_BASE || 'https://api.aholo3d.com';
  const aholoKey = env.AHOLO_API_KEY || env.VITE_AHOLO_API_KEY || '';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        'spatialkit/react': fileURLToPath(new URL('./src/spatialkit/index.ts', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5174,
      proxy: {
        '/api/aholo': {
          target: aholoBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/aholo/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Inject API key if client didn't supply one and server has one configured
              if (!proxyReq.getHeader('authorization') && aholoKey) {
                proxyReq.setHeader('authorization', `Bearer ${aholoKey}`);
              }
            });
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
