import React, { useState } from 'react';

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export function DownloadVerifier({ onClose }: { onClose?: () => void }) {
  const [url, setUrl] = useState('');
  const [expected, setExpected] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('download.bin');

  async function verifyAndOffer() {
    try {
      setStatus(null);
      setVerifying(true);
      setDownloadUrl(null);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network error');
      const buf = await res.arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', buf);
      const b64 = toBase64(hash);
      let expectedB64 = expected;
      if (expected.startsWith('sha256-')) expectedB64 = expected.split('sha256-')[1];

      if (expectedB64) {
        if (b64 === expectedB64) {
          setStatus('verified');
        } else {
          setStatus('mismatch');
        }
      } else {
        setStatus('computed');
      }

      const blob = new Blob([buf]);
      setDownloadUrl(URL.createObjectURL(blob));
      // Try to derive filename from URL
      try {
        const urlObj = new URL(url);
        const seg = urlObj.pathname.split('/').pop();
        if (seg) setFilename(decodeURIComponent(seg));
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      setStatus('error:' + (err.message || 'failed'));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-300">Paste a download URL and an expected SRI (optional). The verifier computes SHA-256 and compares it to <code className="rounded bg-ink-900/30 px-1 py-0.5">sha256-&lt;base64&gt;</code>.</p>
      <label className="block text-xs text-ink-400">URL</label>
      <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-md bg-ink-900/40 p-2 text-sm text-ink-50" />
      <label className="block text-xs text-ink-400">Expected SRI (optional)</label>
      <input value={expected} onChange={(e) => setExpected(e.target.value)} className="w-full rounded-md bg-ink-900/40 p-2 text-sm text-ink-50" placeholder="sha256-..." />
      <div className="flex items-center gap-2">
        <button onClick={verifyAndOffer} disabled={verifying || !url} className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950 disabled:opacity-50">Verify</button>
        {downloadUrl && (
          <a href={downloadUrl} download={filename} className="rounded-md bg-white/[0.06] px-3 py-2 text-sm font-medium text-ink-100">Save file</a>
        )}
        <button onClick={() => { if (onClose) onClose(); }} className="ml-auto rounded-md bg-white/[0.04] px-3 py-2 text-sm">Close</button>
      </div>
      <div className="text-sm">
        {verifying && <p className="text-ink-300">Verifying…</p>}
        {status === 'verified' && <p className="text-green-400">Hash matched (sha256)</p>}
        {status === 'mismatch' && <p className="text-red-400">Hash mismatch — do not trust this file</p>}
        {status === 'computed' && <p className="text-amber-400">Computed hash (no expected SRI provided)</p>}
        {status && status.startsWith('error:') && <p className="text-red-400">Error: {status.replace('error:', '')}</p>}
      </div>
    </div>
  );
}

export default DownloadVerifier;
