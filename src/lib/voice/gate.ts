/**
 * The human gate (lane pof-voice): a take verdict and a voice cast are set ONLY from the Voice room page.
 *
 * Enforcement, in three layers:
 *  1. **No headless surface.** `voice.mjs` has no approve/reject/cast command and pof-mcp exposes no voice
 *     tool; the verdict and cast routes are the only writers (`setVerdict`, `castVoice`).
 *  2. **A page-held token.** Those routes require `x-voice-gate: <token>`, an HMAC over an expiry signed with
 *     a secret born in THIS server process (never written to disk, gone on restart). `GET .../voice/gate`
 *     mints one only for a browser fetch: `Sec-Fetch-Site: same-origin` + `Sec-Fetch-Mode: cors|same-origin`,
 *     headers a browser sets itself and Node's `fetch` (the CLI) never sends. The room fetches it on render
 *     and re-fetches before it expires (`GATE_TTL_MS`).
 *  3. **The click.** The room sends the verdict only from the Approve/Reject (or Cast) button handler, with the
 *     note the owner typed; the route also checks the browser fetch metadata on the write itself.
 *
 * Honest limit: a local process that deliberately forges browser headers can pass layer 2. The gate stops the
 * CLI, the agent's tools and any accidental scripted path (tested: they are refused 403); it is not a defence
 * against an adversarial process on the owner's machine, and the `/gta --voice` skill forbids that path.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const GATE_HEADER = 'x-voice-gate';
/** A page token lives 10 minutes; the room refreshes it at half-life. */
export const GATE_TTL_MS = 10 * 60 * 1000;

const SECRET = randomBytes(32);

type Headers = { get(name: string): string | null };

const sign = (payload: string): string => createHmac('sha256', SECRET).update(payload).digest('base64url');

/** True only for a request a browser page made with fetch() on this origin. */
export function isBrowserFetch(h: Headers): boolean {
  const site = h.get('sec-fetch-site');
  const mode = h.get('sec-fetch-mode');
  return site === 'same-origin' && (mode === 'cors' || mode === 'same-origin');
}

export function mintGateToken(now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + GATE_TTL_MS;
  const payload = `voice-gate.${expiresAt}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyGateToken(token: string | null, now = Date.now()): boolean {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const mac = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(sign(payload));
  if (mac.length !== want.length || !timingSafeEqual(mac, want)) return false;
  const expiresAt = Number(payload.split('.')[1]);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

/** `null` = the request may set a verdict/cast; otherwise the refusal reason (sent as a 403). */
export function gateRefusal(h: Headers, now = Date.now()): string | null {
  if (!isBrowserFetch(h)) {
    return 'Human gate: verdicts and casting are set only by a click in the PoF Voice room. '
      + 'This request did not come from the room page (no browser fetch metadata), so nothing was changed.';
  }
  if (!verifyGateToken(h.get(GATE_HEADER), now)) {
    return 'Human gate: the Voice room token is missing or expired. Reload the Voice room and click again.';
  }
  return null;
}
