import type { VercelRequest, VercelResponse } from '@vercel/node';

const JAMENDO_API = 'https://api.jamendo.com/v3.0';
const CLIENT_ID = process.env.JAMENDO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.JAMENDO_CLIENT_SECRET || '';

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
    // Path is forwarded as ?path=... by the Vercel rewrite rule.
    // req.query.path can be a string like "tracks" or an array like ["tracks"]
    // when the :path* wildcard captures a multi-segment path.
    const rawPath = req.query.path;
    let path = '/';
    if (rawPath) {
      const pathStr = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath);
      path = '/' + pathStr.replace(/^\/+/, '');
    }

    // Forward all query params except 'path' (which is our internal routing param)
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') continue; // skip our internal routing param
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, String(v));
      } else {
        qs.append(key, String(value));
      }
    }
    // Inject server-side credentials — these are never exposed to the browser
    qs.set('client_id', CLIENT_ID);
    if (CLIENT_SECRET) qs.set('client_secret', CLIENT_SECRET);
    qs.set('format', 'json');

    const upstreamUrl = `${JAMENDO_API}${path}?${qs.toString()}`;

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Vibify/1.0',
        Accept: 'application/json',
      },
    });

    const contentType = upstreamRes.headers.get('content-type') ?? 'application/json';
    const body = await upstreamRes.text();

    res.setHeader('Content-Type', contentType);
    res.status(upstreamRes.status).send(body);
  } catch (err) {
    console.error('[jamendo] error:', err);
    res.status(502).json({ error: 'Bad gateway', details: String(err) });
  }
}
