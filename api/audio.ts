import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Audio proxy for JioSaavn CDN URLs.
 *
 * Problem: JioSaavn CDN (akamaized.net) is geo-restricted to India.
 * Vercel servers (US/EU) get blocked. This proxy fetches audio server-side
 * with India-origin headers and streams it back to the browser.
 *
 * Usage: GET /api/audio?url=<encodeURIComponent(cdnUrl)>
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

  // Only allow known JioSaavn CDN domains — security guard
  const ALLOWED_DOMAINS = [
    'akamaized.net',
    'jiosaavn.com',
    'saavn.com',
    'cf-hls-media',
    'ac.cf.jiosaaavn.com',
  ];
  if (!ALLOWED_DOMAINS.some(d => audioUrl.includes(d))) {
    res.status(403).json({ error: 'Domain not allowed' });
    return;
  }

  try {
    const rangeHeader = req.headers['range'];

    const upstream = await fetch(audioUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
        'Accept-Encoding': 'identity',
        'Origin': 'https://www.jiosaavn.com',
        'Referer': 'https://www.jiosaavn.com/',
        ...(rangeHeader ? { 'Range': rangeHeader } : {}),
      },
    });

    // Pass status + key headers through
    const status = upstream.status;
    const contentType    = upstream.headers.get('content-type')    ?? 'audio/mp4';
    const contentLength  = upstream.headers.get('content-length');
    const contentRange   = upstream.headers.get('content-range');
    const acceptRanges   = upstream.headers.get('accept-ranges');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (contentLength)  res.setHeader('Content-Length', contentLength);
    if (contentRange)   res.setHeader('Content-Range', contentRange);
    if (acceptRanges)   res.setHeader('Accept-Ranges', acceptRanges);

    if (!upstream.body) {
      res.status(status).end();
      return;
    }

    // Stream chunks directly — avoids loading the entire file into RAM
    // and stays well under Vercel's 4.5 MB response body limit per chunk.
    res.status(status);
    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    await pump();

  } catch (err) {
    console.error('[audio proxy]', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Bad gateway', details: String(err) });
    }
  }
}
