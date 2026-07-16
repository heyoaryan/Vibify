import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for https://lrclib.net
 * Usage: /lrclib/api/search?q=...
 *        /lrclib/api/get/...
 * The path after /lrclib is forwarded to lrclib.net.
 * 
 * Note: In Vercel, req.url is the DESTINATION path (/api/lrclib), not the source.
 * The original path is captured in req.params.path from the :path* wildcard.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let path = '/';
    
    const paramsPath = (req as { params?: { path?: string } }).params?.path;
    if (paramsPath) {
      path = '/' + paramsPath;
    }

    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const upstream = `https://lrclib.net${path}${qs ? '?' + qs : ''}`;

    console.log(`[lrclib] ${req.method} ${path} → ${upstream}`);

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
