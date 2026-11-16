/**
 * Netlify Serverless Function: /api/aholo/*
 * Proxies requests to Manycore Aholo OpenAPI (https://api.aholo.ai or https://api.aholo3d.cn)
 * and automatically attaches the server-side AHOLO_API_KEY / VITE_AHOLO_API_KEY if no client
 * key was provided in the request header.
 */
export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const reqUrl = new URL(req.url);
    const serverKey = (process.env.AHOLO_API_KEY || process.env.VITE_AHOLO_API_KEY || '').trim();

    // Extract path after /api/aholo or /.netlify/functions/aholo
    const subPath = reqUrl.pathname
      .replace(/^\/\.netlify\/functions\/aholo/, '')
      .replace(/^\/api\/aholo/, '');

    // Lightweight endpoint so the client can check if Netlify has a server key configured
    if (subPath === '/key-status') {
      return new Response(JSON.stringify({ configured: Boolean(serverKey) }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const base = (
      process.env.AHOLO_API_BASE ||
      process.env.VITE_AHOLO_API_BASE ||
      'https://api.aholo.ai'
    ).replace(/\/+$/, '');

    const targetUrl = `${base}${subPath.startsWith('/') ? subPath : `/${subPath}`}${reqUrl.search}`;

    // Aholo OpenAPI expects the raw API key in Authorization (no "Bearer " prefix)
    const incomingAuth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const finalAuth = incomingAuth || serverKey;

    const headers = new Headers();
    headers.set('Content-Type', req.headers.get('content-type') || 'application/json');
    if (finalAuth) {
      headers.set('Authorization', finalAuth);
    }

    const bodyText =
      req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyText,
    });

    const responseText = await upstream.text();
    return new Response(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        c: '500',
        m: err?.message || 'Aholo serverless proxy error',
        d: null,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};
