import type { VercelRequest, VercelResponse } from '@vercel/node';

const JAMENDO_API = 'https://api.jamendo.com/v3.0';
const CLIENT_ID = process.env.JAMENDO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.JAMENDO_CLIENT_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let path = '/';
    const paramsPath = (req as { params?: { path?: string } }).params?.path;
    if (paramsPath) path = '/' + paramsPath;

    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, String(v));
      } else {
        qs.append(key, String(value));
      }
    }
    qs.set('client_id', CLIENT_ID);
    if (CLIENT_SECRET) qs.set('client_secret', CLIENT_SECRET);
    qs.set('format', 'json');

    const upstreamUrl = `${JAMENDO_API}${path}${qs.toString() ? '?' + qs.toString() : ''}`;

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Vibify/1.0',
        Accept: 'application/json',
      },
    });

    const contentType = upstreamRes.headers.get('content-type') ?? 'application/json';
    const body = await upstreamRes.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.status(upstreamRes.status).send(body);
  } catch (err) {
    console.error('[jamendo] error:', err);
    res.status(502).json({ error: 'Bad gateway', details: String(err) });
  }
}
