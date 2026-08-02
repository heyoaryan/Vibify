import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for https://api.lyrics.ovh
 * Usage: /lyricsovh/v1/{artist}/{title}
 *
 * The Vercel rewrite forwards the path as ?path=... e.g.:
 *   /lyricsovh/v1/Arijit%20Singh/Kesariya  →  /api/lyricsovh?path=v1/Arijit%20Singh/Kesariya
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    // Path forwarded as ?path=... by Vercel rewrite; may be array for multi-segment paths
    const rawPath = req.query.path;
    let path = '/';
    if (rawPath) {
      const pathStr = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath);
      path = '/' + pathStr.replace(/^\/+/, '');
    }

    // Forward all query params except our internal 'path' routing param
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') continue;
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, String(v));
      } else {
        qs.append(key, String(value));
      }
    }

    const upstream = `https://api.lyrics.ovh${path}${qs.toString() ? '?' + qs.toString() : ''}`;

    const upstream_res = await fetch(upstream, {
      headers: {
        'User-Agent': 'ARVINE/1.0',
        Accept: 'application/json',
      },
    });

    const body = await upstream_res.text();

    res.setHeader('Content-Type', upstream_res.headers.get('content-type') ?? 'application/json');
    res.status(upstream_res.status).send(body);
  } catch (err) {
    console.error('[lyricsovh proxy]', err);
    res.status(502).json({ error: 'Bad gateway' });
  }
}
