import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for https://www.jiosaavn.com/api.php
 * Usage: /api/jiosaavn?__call=...&q=...
 * All query params are forwarded as-is.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const params = req.query as Record<string, string>;
  const qs = new URLSearchParams(params).toString();
  const upstream = `https://www.jiosaavn.com/api.php?${qs}`;

  try {
    const upstream_res = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ARVINE/1.0)',
        Accept: 'application/json',
      },
    });

    const body = await upstream_res.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', upstream_res.headers.get('content-type') ?? 'application/json');
    res.status(upstream_res.status).send(body);
  } catch (err) {
    console.error('[jiosaavn proxy]', err);
    res.status(502).json({ error: 'Bad gateway' });
  }
}
