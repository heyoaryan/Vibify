import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTREAM = 'https://api.audiomack.com/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.url ?? '/';
  const path = raw.replace(/^\/api\/audiomack/, '') || '/';
  const upstreamUrl = `${UPSTREAM}${path}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Vibify/1.0)',
        Accept: 'application/json',
      },
    });

    const body = await upstreamRes.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json');
    res.status(upstreamRes.status).send(body);
  } catch (err) {
    console.error('[audiomack proxy]', err);
    res.status(502).json({ error: 'Bad gateway' });
  }
}
