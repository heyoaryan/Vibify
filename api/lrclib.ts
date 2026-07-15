import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for https://lrclib.net
 * Usage: /api/lrclib/api/search?q=...
 *        /api/lrclib/api/get/...
 * The path after /api/lrclib is forwarded to lrclib.net.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // req.url will be something like /api/lrclib/api/search?q=...
  // Strip the leading /api/lrclib prefix to get the lrclib path
  const raw = req.url ?? '/';
  const lrclibPath = raw.replace(/^\/api\/lrclib/, '') || '/';

  const upstream = `https://lrclib.net${lrclibPath}`;

  try {
    const upstream_res = await fetch(upstream, {
      headers: {
        'Lrclib-Client': 'ARVINE/1.0',
        Accept: 'application/json',
      },
    });

    const body = await upstream_res.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', upstream_res.headers.get('content-type') ?? 'application/json');
    res.status(upstream_res.status).send(body);
  } catch (err) {
    console.error('[lrclib proxy]', err);
    res.status(502).json({ error: 'Bad gateway' });
  }
}
