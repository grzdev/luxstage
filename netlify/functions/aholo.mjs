/**
 * Netlify Serverless Proxy: /.netlify/functions/aholo/:splat (mapped from /api/aholo/*)
 * Routes requests to Manycore Aholo OpenAPI (https://api.aholo.ai or https://api.aholo3d.cn)
 * and prefers a user-supplied custom key while falling back to the server AHOLO_API_KEY.
 */
export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Aholo-Key, X-Aholo-Region',
      },
    });
  }

  try {
    const reqUrl = new URL(req.url);
    const serverKey = (process.env.AHOLO_API_KEY || process.env.VITE_AHOLO_API_KEY || '').trim();

    // Extract splat path reliably from v2 context.params or reqUrl.pathname
    const rawSplat = context?.params?.['*'];
    let subPath = '';
    if (typeof rawSplat === 'string' && rawSplat.length > 0) {
      subPath = `/${rawSplat.replace(/^\/+/, '')}`;
    } else {
      subPath = reqUrl.pathname
        .replace(/^\/\.netlify\/functions\/aholo/, '')
        .replace(/^\/api\/aholo/, '');
    }

    // Lightweight endpoint so the client can check if Netlify has a server key configured
    if (subPath === '/key-status' || subPath === 'key-status') {
      return new Response(JSON.stringify({ configured: Boolean(serverKey) }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const region = (req.headers.get('x-aholo-region') || 'intl').toLowerCase();
    const defaultBase = region === 'cn' ? 'https://api.aholo3d.cn' : 'https://api.aholo.ai';
    const base = (
      region === 'cn'
        ? 'https://api.aholo3d.cn'
        : process.env.AHOLO_API_BASE || process.env.VITE_AHOLO_API_BASE || defaultBase
    ).replace(/\/+$/, '');

    const targetUrl = `${base}${subPath.startsWith('/') ? subPath : `/${subPath}`}${reqUrl.search}`;

    // Aholo OpenAPI expects the raw API key in Authorization (no "Bearer " prefix)
    const incomingKey = (
      req.headers.get('x-aholo-key') ||
      req.headers.get('authorization') ||
      ''
    )
      .replace(/^Bearer\s+/i, '')
      .trim();
    const finalAuth = incomingKey || serverKey;

    if (!finalAuth) {
      return new Response(
        JSON.stringify({
          c: '401',
          m: 'No Aholo API key configured on server or provided in Settings (API Key).',
          d: null,
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', req.headers.get('content-type') || 'application/json');
    headers.set('Authorization', finalAuth);

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
