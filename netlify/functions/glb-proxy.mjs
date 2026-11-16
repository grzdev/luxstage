/**
 * Netlify Serverless Function: /api/glb-proxy?url=...
 * Streams generated .glb 3D assets from Aholo's CDN with CORS headers enabled
 * so Three.js / WebGL can load textures and geometry in the browser.
 */
export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  try {
    const reqUrl = new URL(req.url);
    const targetUrl = reqUrl.searchParams.get('url');

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return new Response('Missing or invalid url parameter', { status: 400 });
    }

    const upstream = await fetch(targetUrl);
    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.statusText}`, {
        status: upstream.status,
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'model/gltf-binary',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(err?.message || 'GLB proxy failed', { status: 500 });
  }
};
