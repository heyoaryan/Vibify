import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Audio proxy for JioSaavn CDN URLs.
 *
 * JioSaavn CDN (akamaized.net) is geo-restricted — it blocks requests from
 * non-India IPs. Vercel's edge servers are outside India, so the browser
 * cannot fetch audio directly in production.
 *
 * This proxy forwards the request server-side with an India-spoofed
 * User-Agent + headers, then streams the response back to the browser.
 *
 * Usage: GET /api/audio?url=<encoded-saavn-cdn-url>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Range');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400).json({ error: 'Missing ?url= parameter' });
    return;
  }

  let audioUrl: string;
  try {
    audioUrl = decodeURIComponent(rawUrl);
  } catch {
    res.status(400).json({ error: 'Invalid URL encoding' });
    return;
  }

  // Only proxy known JioSaavn CDN domains
  const allowed = [
    'akamaized.net',
    'jiosaavn.com',
    'saavn.com',
    'cf-hls-media',
  ];
  const isAllowed = allowed.some(d => audioUrl.includes(d));
  if (!isAllowed) {
    res.status(403).json({ error: 'URL not allowed' });
    return;
  }

  try {
    // Forward Range header for seeking support
    const rangeHeader = req.headers['range'];
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      'Accept': '*/*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Origin': 'https://www.jiosaavn.com',
      'Referer': 'https://www.jiosaavn.com/',
    };
    if (rangeHeader) headers['Range'] = rangeHeader;

    const upstream = await fetch(audioUrl, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
      return;
    }

    // Pass through content headers
    const contentType = upstream.headers.get('content-type') ?? 'audio/mp4';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    const body = await upstream.arrayBuffer();
    res.status(upstream.status).send(Buffer.from(body));
  } catch (err) {
    console.error('[audio proxy]', err);
    res.status(502).json({ error: 'Bad gateway', details: String(err) });
  }
}
