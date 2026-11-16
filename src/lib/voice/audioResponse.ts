/**
 * An audio file as an HTTP response that honours byte ranges (lane pof-voice). A media element asks for
 * `Range: bytes=…` to seek and, for Ogg, to read the last page where the true length lives; a server that
 * ignores it leaves the player unable to scrub and showing an estimated duration (measured 2026-11-03: a
 * 12.0 s Ogg take showed as 0:10 in Chromium). Single ranges only (all a media element sends).
 */
const RANGE = /^bytes=(\d*)-(\d*)$/;

/** The served slice for a `Range` header against `size` bytes: null = whole file, 'unsatisfiable' = 416. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'unsatisfiable' {
  const m = header ? RANGE.exec(header.trim()) : null;
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]); // bytes=-N: the last N bytes
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

export function audioResponse(bytes: Buffer, contentType: string, rangeHeader: string | null, cacheControl: string): Response {
  const size = bytes.length;
  const base = { 'Content-Type': contentType, 'Cache-Control': cacheControl, 'Accept-Ranges': 'bytes' };
  const r = parseRange(rangeHeader, size);
  if (r === 'unsatisfiable') return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } });
  if (!r) return new Response(new Uint8Array(bytes), { status: 200, headers: { ...base, 'Content-Length': String(size) } });
  return new Response(new Uint8Array(bytes.subarray(r.start, r.end + 1)), {
    status: 206,
    headers: { ...base, 'Content-Range': `bytes ${r.start}-${r.end}/${size}`, 'Content-Length': String(r.end - r.start + 1) },
  });
}
