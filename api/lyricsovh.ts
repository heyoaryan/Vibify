import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for https://api.lyrics.ovh
 * Usage: /api/lyricsovh/v1/{artist}/{title}
 * The path after /api/lyricsovh is forwarded to api.lyrics.ovh.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.url ?? '/';
  const ovhPath = raw.replace(/^\/api\/lyricsovh/, '') || '/';

  const upstream = `https://api.lyrics.ovh${ovhPath}`;

  try {
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
