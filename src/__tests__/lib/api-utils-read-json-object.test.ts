import { describe, it, expect } from 'vitest';
import { readJsonObject } from '@/lib/api-utils';

function req(raw: string): Request {
  return new Request('http://localhost/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw });
}

describe('readJsonObject', () => {
  it('returns the parsed object', async () => {
    const r = await readJsonObject(req('{"a":1}'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ a: 1 });
  });

  it.each(['null', '[]', '"s"', '7', 'true'])('refuses non-object JSON %s with a 400 envelope', async (raw) => {
    const r = await readJsonObject(req(raw));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.status).toBe(400);
      const body = await r.error.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Body must be a JSON object');
    }
  });

  it('refuses malformed JSON with a 400 envelope', async () => {
    const r = await readJsonObject(req('{"a":'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.status).toBe(400);
      expect((await r.error.json()).error).toBe('Invalid JSON body');
    }
  });
});
