import { describe, it, expect, afterEach } from 'vitest';
import { requireOperator } from '@/lib/api-auth';

/** Minimal stand-in for NextRequest — the guard only reads headers. */
function req(headers: Record<string, string>) {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null } };
}

const ORIGINAL = process.env.POF_OPERATOR_TOKEN;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = ORIGINAL;
});

describe('requireOperator — token mode (POF_OPERATOR_TOKEN set)', () => {
  const TOKEN = 's3cret-operator-token';

  it('accepts the token as a Bearer credential', () => {
    process.env.POF_OPERATOR_TOKEN = TOKEN;
    expect(requireOperator(req({ authorization: `Bearer ${TOKEN}` }))).toBeNull();
  });

  it('accepts the token in x-operator-token', () => {
    process.env.POF_OPERATOR_TOKEN = TOKEN;
    expect(requireOperator(req({ 'x-operator-token': TOKEN }))).toBeNull();
  });

  it('is case-insensitive on the Bearer scheme but not on the token', () => {
    process.env.POF_OPERATOR_TOKEN = TOKEN;
    expect(requireOperator(req({ authorization: `bearer ${TOKEN}` }))).toBeNull();
    expect(requireOperator(req({ authorization: `Bearer ${TOKEN.toUpperCase()}` }))).not.toBeNull();
  });

  it('rejects a wrong token, a malformed header, and no credential at all with 401', async () => {
    process.env.POF_OPERATOR_TOKEN = TOKEN;
    const cases: Record<string, string>[] = [
      { authorization: 'Bearer wrong' },
      { authorization: TOKEN }, // no scheme
      { 'x-operator-token': 'wrong' },
      {},
    ];
    for (const headers of cases) {
      const denied = requireOperator(req(headers));
      expect(denied, JSON.stringify(headers)).not.toBeNull();
      expect(denied!.status).toBe(401);
    }
  });

  it('ignores Origin entirely once a token is configured', () => {
    process.env.POF_OPERATOR_TOKEN = TOKEN;
    // A cross-site Origin is irrelevant when the credential is valid...
    expect(requireOperator(req({ authorization: `Bearer ${TOKEN}`, origin: 'https://evil.test' }))).toBeNull();
    // ...and a same-origin request still cannot skip the token.
    const denied = requireOperator(req({ origin: 'http://localhost:3000', host: 'localhost:3000' }));
    expect(denied!.status).toBe(401);
  });
});

describe('requireOperator — local-dev mode (no token configured)', () => {
  afterEach(() => delete process.env.POF_OPERATOR_TOKEN);

  it('allows a header-less server-to-server call', () => {
    delete process.env.POF_OPERATOR_TOKEN;
    // The @@CALLBACK POST from cli-task carries no Origin; it must keep working.
    expect(requireOperator(req({}))).toBeNull();
    expect(requireOperator(req({ host: 'localhost:3000' }))).toBeNull();
  });

  it('allows a same-origin browser request', () => {
    delete process.env.POF_OPERATOR_TOKEN;
    expect(requireOperator(req({ origin: 'http://localhost:3000', host: 'localhost:3000' }))).toBeNull();
  });

  it('rejects a cross-site browser request with 403 — the CSRF vector', () => {
    delete process.env.POF_OPERATOR_TOKEN;
    const denied = requireOperator(req({ origin: 'https://evil.test', host: 'localhost:3000' }));
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(403);
  });

  it('treats a different port on the same hostname as cross-site', () => {
    delete process.env.POF_OPERATOR_TOKEN;
    // Cookies do not isolate by port, so a sibling dev server is a real vector.
    const denied = requireOperator(req({ origin: 'http://localhost:4000', host: 'localhost:3000' }));
    expect(denied!.status).toBe(403);
  });

  it('rejects an unparseable Origin rather than treating it as same-origin', () => {
    delete process.env.POF_OPERATOR_TOKEN;
    const denied = requireOperator(req({ origin: 'not-a-url', host: 'localhost:3000' }));
    expect(denied!.status).toBe(403);
  });

  it('rejects when Origin is present but Host is missing — it cannot be compared', () => {
    delete process.env.POF_OPERATOR_TOKEN;
    const denied = requireOperator(req({ origin: 'http://localhost:3000' }));
    expect(denied!.status).toBe(403);
  });
});
