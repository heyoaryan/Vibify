import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTREAM = 'https://api.audiomack.com/v1';
const CONSUMER_KEY = process.env.AUDIOMACK_CONSUMER_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.url ?? '/';
  const path = raw.replace(/^\/api\/audiomack/, '') || '/';

  const url = new URL(`${UPSTREAM}${path}`, 'http://localhost');
  if (CONSUMER_KEY && !url.searchParams.has('consumer_key')) {
    url.searchParams.set('consumer_key', CONSUMER_KEY);
  }
  const upstreamUrl = url.toString();

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
