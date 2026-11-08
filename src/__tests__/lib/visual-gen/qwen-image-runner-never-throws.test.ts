import { describe, it, expect } from 'vitest';
import { runQwenImage } from '@/lib/visual-gen/qwen-image-runner';

// No network: every fetch is a stub. The runner's contract (header of runQwenImage) is
// "never throws": a failure comes back as { ok: false, error } so a Produce step can show it.
const spec = { prompt: 'a rusty sword icon', outputPath: 'unused.png', apiKey: 'test-key' };
const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const IMAGE_REPLY = { output: { choices: [{ message: { content: [{ image: 'https://example.invalid/i.png' }] } }] } };

describe('runQwenImage never throws', () => {
  it('a rejected generation fetch (network down) is { ok:false } with the reason', async () => {
    const r = await runQwenImage(spec, {
      fetch: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch,
      writeFile: async () => {},
      env: {},
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/fetch failed/);
  });

  it('a non-JSON 200 body is { ok:false }, not a SyntaxError', async () => {
    const r = await runQwenImage(spec, {
      fetch: (async () => new Response('<html>gateway</html>', { status: 200 })) as typeof fetch,
      writeFile: async () => {},
      env: {},
    });
    expect(r.ok).toBe(false);
  });

  it('a failed disk write is { ok:false } naming the image it fetched', async () => {
    let n = 0;
    const r = await runQwenImage(spec, {
      fetch: (async () => (n++ === 0 ? okJson(IMAGE_REPLY) : new Response(new Uint8Array([1, 2]), { status: 200 }))) as typeof fetch,
      writeFile: async () => { throw new Error('EACCES: permission denied'); },
      env: {},
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/EACCES/);
    expect(r.imageUrl).toBe('https://example.invalid/i.png');
  });
});
