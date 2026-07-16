import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for https://api.lyrics.ovh
 * Usage: /lyricsovh/v1/{artist}/{title}
 * The path after /lyricsovh is forwarded to api.lyrics.ovh.
 * 
 * Note: In Vercel, req.url is the DESTINATION path (/api/lyricsovh), not the source.
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
    const upstream = `https://api.lyrics.ovh${path}${qs ? '?' + qs : ''}`;

    console.log(`[lyricsovh] ${req.method} ${path} → ${upstream}`);

    const upstream_res = await fetch(upstream, {
      headers: {
        'User-Agent': 'ARVINE/1.0',
        Accept: 'application/json',
      },
    });

    const body = await upstream_res.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', upstream_res.headers.get('content-type') ?? 'application/json');
    res.status(upstream_res.status).send(body);
  } catch (err) {
    console.error('[lyricsovh proxy]', err);
    res.status(502).json({ error: 'Bad gateway' });
  }
}
