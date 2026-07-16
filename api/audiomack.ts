import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTREAM = 'https://api.audiomack.com/v1';

function getClientIp(req: VercelRequest): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || (req.headers['x-real-ip'] as string)
    || 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let path = '/';
    
    // Vercel's req.url is the DESTINATION path (/api/audiomack), not the source.
    // The original path is captured in req.params.path from the :path* wildcard.
    const paramsPath = (req as { params?: { path?: string } }).params?.path;
    if (paramsPath) {
      path = '/' + paramsPath;
    }

    // Reconstruct query string from req.query (Vercel parses it for us)
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const upstreamUrl = `${UPSTREAM}${path}${qs ? '?' + qs : ''}`;
    
    console.log(`[audiomack] ${req.method} ${path} → ${upstreamUrl} (ip: ${getClientIp(req)})`);

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

    console.log(`[audiomack] ${upstreamRes.status} ${contentType} (${body.length} bytes)`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.status(upstreamRes.status).send(body);
  } catch (err) {
    console.error('[audiomack] error:', err);
    res.status(502).json({ error: 'Bad gateway', details: String(err) });
  }
}
