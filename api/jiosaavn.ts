import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for https://www.jiosaavn.com/api.php
 * Forwards all query params, spoof India headers so JioSaavn returns
 * valid encrypted_media_url values (they differ by region).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const params = req.query as Record<string, string>;
  const qs = new URLSearchParams(params).toString();
  const upstream = `https://www.jiosaavn.com/api.php?${qs}`;

  try {
    const upstream_res = await fetch(upstream, {
      headers: {
        // Spoof a real Indian browser — JioSaavn returns different (valid)
        // encrypted_media_url values based on the requesting client context.
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
        'Origin': 'https://www.jiosaavn.com',
        'Referer': 'https://www.jiosaavn.com/',
      },
    });

    const body = await upstream_res.text();
    res.setHeader('Content-Type', upstream_res.headers.get('content-type') ?? 'application/json');
    res.status(upstream_res.status).send(body);

  } catch (err) {
    console.error('[jiosaavn proxy]', err);
    res.status(502).json({
      error: 'Bad gateway',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
