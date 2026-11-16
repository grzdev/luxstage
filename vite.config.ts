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
          server.middlewares.use('/api/aholo/key-status', (_req: IncomingMessage, res: ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ configured: Boolean(aholoKey) }));
          });
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
              // Prefer custom user key (X-Aholo-Key or Authorization), fallback to server .env.local key
              const customKeyHeader = proxyReq.getHeader('x-aholo-key') || proxyReq.getHeader('authorization');
              if (typeof customKeyHeader === 'string' && customKeyHeader.trim()) {
                const rawKey = customKeyHeader.replace(/^Bearer\s+/i, '').trim();
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
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'three-vendor': ['three'],
            'r3f-vendor': ['@react-three/fiber', '@react-three/drei'],
          },
        },
      },
    },
  };
});
