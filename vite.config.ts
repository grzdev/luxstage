import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const aholoBase = env.AHOLO_API_BASE || env.VITE_AHOLO_API_BASE || 'https://api.aholo.ai';
  const aholoKey = (env.AHOLO_API_KEY || env.VITE_AHOLO_API_KEY || '').trim();

  return {
    plugins: [
      react(),
      {
        name: 'luxstage-glb-cors-proxy',
        configureServer(server) {
          server.middlewares.use('/api/glb-proxy', async (req: IncomingMessage, res: ServerResponse) => {
            try {
              const reqUrl = new URL(req.url || '', 'http://localhost');
              const targetUrl = reqUrl.searchParams.get('url');
              if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
                res.statusCode = 400;
                res.end('Missing or invalid url parameter');
                return;
              }
              const upstream = await fetch(targetUrl);
              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.end(`Upstream error: ${upstream.statusText}`);
                return;
              }
              const arrayBuffer = await upstream.arrayBuffer();
              res.setHeader('Content-Type', upstream.headers.get('content-type') || 'model/gltf-binary');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.end(Buffer.from(arrayBuffer));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(err?.message || 'GLB proxy failed');
            }
          });
        },
      },
    ],
    define: {
      __HAS_SERVER_AHOLO_KEY__: JSON.stringify(Boolean(aholoKey)),
    },
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
              // Aholo OpenAPI uses raw API key in Authorization header (no "Bearer " prefix)
              const existingAuth = proxyReq.getHeader('authorization');
              if (typeof existingAuth === 'string' && existingAuth.trim()) {
                const rawKey = existingAuth.replace(/^Bearer\s+/i, '').trim();
                proxyReq.setHeader('authorization', rawKey);
              } else if (aholoKey) {
                proxyReq.setHeader('authorization', aholoKey);
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
