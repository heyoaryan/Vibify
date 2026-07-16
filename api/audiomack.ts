import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTREAM = 'https://api.audiomack.com/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let path = '/';

    // Vercel :path* wildcard captures the original path after /api/audiomack
    const rawParams = req.params?.path;
    if (typeof rawParams === 'string') {
      path = '/' + rawParams;
    } else if (Array.isArray(rawParams) && rawParams.length > 0) {
      path = '/' + rawParams[0];
    }

    // Reconstruct query string from Vercel-parsed req.query
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, String(v));
      } else {
        qs.append(key, String(value));
      }
    }
    const queryString = qs.toString();

    const upstreamUrl = `${UPSTREAM}${path}${queryString ? '?' + queryString : ''}`;

    console.log('[audiomack]', JSON.stringify({
      method: req.method,
      reqUrl: req.url,
      params: JSON.stringify(req.params),
      query: JSON.stringify(req.query),
      path,
      upstreamUrl,
    }));

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://audiomack.com',
        Referer: 'https://audiomack.com/',
      },
    });

    const contentType = upstreamRes.headers.get('content-type') ?? 'application/json';
    const body = await upstreamRes.text();

    console.log(`[audiomack] response: ${upstreamRes.status} ${contentType} (${body.length} bytes)`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.status(upstreamRes.status).send(body);
  } catch (err) {
    console.error('[audiomack] error:', err);
    res.status(502).json({ error: 'Bad gateway', details: String(err) });
  }
}
