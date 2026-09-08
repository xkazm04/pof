import { describe, it, expect } from 'vitest';
import { recognize, planFor, DEFAULT_VISION_TIMEOUT_MS } from '@/lib/vision/router';
import type { VisionProvider } from '@/lib/vision/types';
import type { VisionAnswer } from '@/lib/anim-critique/vision';

/**
 * The vision chokepoint. Every image-recognition call in the app enters here, naming a
 * CAPABILITY; the plan decides which provider answers. These tests pin the invariants the
 * registry's `capability-to-vendor-plan` + `non-silent-elimination` standards demand — the
 * ones that make a local-first policy a one-line table edit instead of a seven-file edit.
 */

function answer(text: string, model: string): VisionAnswer {
  return { text, model, attribution: 'answered', fellBackFrom: [] };
}

/** A stub provider. `configured` and `fail` make each elimination kind reachable. */
function stub(
  id: string,
  opts: { configured?: boolean; fail?: string; text?: string; cannotHonour?: string } = {},
): VisionProvider {
  return {
    id: id as VisionProvider['id'],
    capabilities: ['recognize'],
    isConfigured: () => opts.configured !== false,
    cannotHonour: () => opts.cannotHonour ?? null,
    recognize: async () => {
      if (opts.fail) throw new Error(opts.fail);
      return answer(opts.text ?? `${id} says ok`, `${id}-model`);
    },
  };
}

const req = { images: [{ base64: 'AAA', mime: 'image/png' }], prompt: 'what is this' };

describe('vision router — the plan decides, never the call site', () => {
  it('serves the first configured provider in the plan', async () => {
    const providers = [stub('ollama'), stub('gemini')];
    const res = await recognize(req, { providers, plan: ['ollama', 'gemini'] });
    expect(res.provider).toBe('ollama');
    expect(res.text).toBe('ollama says ok');
  });

  it('skips an unconfigured provider and records the skip in the trail', async () => {
    const providers = [stub('ollama', { configured: false }), stub('gemini')];
    const res = await recognize(req, { providers, plan: ['ollama', 'gemini'] });
    expect(res.provider).toBe('gemini');
    expect(res.trail).toEqual([
      { provider: 'ollama', kind: 'not-configured', detail: 'ollama is not configured on this machine' },
    ]);
  });

  it('exposes the plan so a diagnostics surface reports the truth the router acts on', () => {
    expect(planFor('recognize', 'dev')).toEqual(['ollama', 'qwen-cloud', 'gemini']);
  });
});

describe('vision router — a failure re-routes, and never returns an empty success', () => {
  it('re-routes to the next provider when one fails, recording the failure', async () => {
    const providers = [stub('ollama', { fail: 'daemon refused connection' }), stub('gemini')];
    const res = await recognize(req, { providers, plan: ['ollama', 'gemini'] });
    expect(res.provider).toBe('gemini');
    expect(res.trail).toEqual([
      { provider: 'ollama', kind: 'call-failed', detail: 'daemon refused connection' },
    ]);
  });

  it('treats an EMPTY answer as a refusal and re-routes, rather than returning it', async () => {
    // The registry's rule, transplanted from image generation: the safe reading of an empty
    // result is REFUSED, never "success with zero content". Misread one way the caller gets
    // a re-route to a provider that can serve them; misread the other, the caller gets
    // nothing, silently, with a green status attached.
    const providers = [stub('ollama', { text: '   ' }), stub('gemini')];
    const res = await recognize(req, { providers, plan: ['ollama', 'gemini'] });
    expect(res.provider).toBe('gemini');
    expect(res.trail[0]?.kind).toBe('call-failed');
    expect(res.trail[0]?.detail).toMatch(/empty/i);
  });

  it('throws with the whole trail when every provider dropped out', async () => {
    const providers = [
      stub('ollama', { configured: false }),
      stub('qwen-cloud', { fail: 'quota exhausted' }),
    ];
    await expect(
      recognize(req, { providers, plan: ['ollama', 'qwen-cloud'] }),
    ).rejects.toThrow(/ollama: not-configured; qwen-cloud: call-failed \(quota exhausted\)/);
  });
});

describe('vision router — steering moves within the plan, it never escapes it', () => {
  it('prefer REORDERS: a honourable preference goes first', async () => {
    const providers = [stub('ollama'), stub('gemini')];
    const res = await recognize(req, {
      providers, plan: ['ollama', 'gemini'], steer: { prefer: 'gemini' },
    });
    expect(res.provider).toBe('gemini');
  });

  it('prefer is ADVISORY: an unhonourable preference is dropped, not an error', async () => {
    // The caller asked for a better first try, not for a failure.
    const providers = [stub('ollama')];
    const res = await recognize(req, {
      providers, plan: ['ollama'], steer: { prefer: 'gemini' },
    });
    expect(res.provider).toBe('ollama');
  });

  it('avoid is BINDING: the avoided provider is removed even when it would have served', async () => {
    const providers = [stub('gemini'), stub('ollama')];
    const res = await recognize(req, {
      providers, plan: ['gemini', 'ollama'], steer: { avoid: ['gemini'] },
    });
    expect(res.provider).toBe('ollama');
  });

  it('fails with "no alternative" rather than landing back on the avoided provider', async () => {
    // The one caller who sends an avoid is a caller who was just refused; a re-route that
    // can land back on the refusing provider is not a re-route.
    const providers = [stub('gemini')];
    await expect(
      recognize(req, { providers, plan: ['gemini'], steer: { avoid: ['gemini'] } }),
    ).rejects.toThrow(/no alternative/i);
  });
});

describe('vision router — a provider that cannot honour THIS request is eliminated before it is called', () => {
  it('records unsupported-request and re-routes without billing the provider', async () => {
    // The worst failure this layer can produce is a perfectly good answer to a different
    // question: a provider that accepts five frames and reads one returns on-time,
    // on-budget output that fails the brief with nothing reporting a problem.
    let called = false;
    const oneFrameOnly: VisionProvider = {
      ...stub('ollama'),
      cannotHonour: (r) => (r.images.length > 1 ? 'reads only the first of 2 images' : null),
      recognize: async () => { called = true; return answer('x', 'y'); },
    };
    const multi = { images: [{ base64: 'A', mime: 'image/png' }, { base64: 'B', mime: 'image/png' }], prompt: 'p' };
    const res = await recognize(multi, {
      providers: [oneFrameOnly, stub('gemini')], plan: ['ollama', 'gemini'],
    });
    expect(called).toBe(false);
    expect(res.provider).toBe('gemini');
    expect(res.trail).toEqual([
      { provider: 'ollama', kind: 'unsupported-request', detail: 'reads only the first of 2 images' },
    ]);
  });
});

describe('vision router — effort is requested, and what was SERVED is reported', () => {
  it('passes the requested effort to the provider', async () => {
    let seen: string | undefined;
    const provider: VisionProvider = {
      id: 'gemini', capabilities: ['recognize'], isConfigured: () => true,
      effortLevels: ['low', 'medium', 'high'],
      recognize: async (r) => { seen = r.effort; return answer('ok', 'gemini-3.8-flash'); },
    };
    const res = await recognize({ ...req, effort: 'high' }, { providers: [provider], plan: ['gemini'] });
    expect(seen).toBe('high');
    expect(res.effortServed).toBe('high');
  });

  it('reports the DOWNGRADE when a provider cannot serve the requested effort', async () => {
    // The silent near-miss this prevents: a caller asks for high effort because the task is
    // hard, the provider quietly serves its only level, and the answer looks fine while
    // being the cheap answer to a question that needed the expensive one.
    const provider: VisionProvider = {
      id: 'ollama', capabilities: ['recognize'], isConfigured: () => true,
      effortLevels: ['low'],
      recognize: async () => answer('ok', 'qwen3.8:27b'),
    };
    const res = await recognize({ ...req, effort: 'high' }, { providers: [provider], plan: ['ollama'] });
    expect(res.effortServed).toBe('low');
    expect(res.effortDowngraded).toBe(true);
  });

  it('does not report a downgrade when the effort was served as asked', async () => {
    const provider: VisionProvider = {
      id: 'gemini', capabilities: ['recognize'], isConfigured: () => true,
      effortLevels: ['low', 'medium', 'high'],
      recognize: async () => answer('ok', 'gemini-3.8-flash'),
    };
    const res = await recognize({ ...req, effort: 'medium' }, { providers: [provider], plan: ['gemini'] });
    expect(res.effortDowngraded).toBe(false);
  });

  it('serves the provider default when no effort is requested', async () => {
    const provider: VisionProvider = {
      id: 'gemini', capabilities: ['recognize'], isConfigured: () => true,
      effortLevels: ['low', 'medium', 'high'],
      recognize: async () => answer('ok', 'gemini-3.8-flash'),
    };
    const res = await recognize(req, { providers: [provider], plan: ['gemini'] });
    expect(res.effortServed).toBeUndefined();
    expect(res.effortDowngraded).toBe(false);
  });
});

describe('vision router — a call that never settles is eliminated, not waited on forever', () => {
  const never: VisionProvider = {
    id: 'ollama', capabilities: ['recognize'], isConfigured: () => true,
    timeoutMs: 20,
    recognize: () => new Promise(() => { /* never settles — a hung daemon */ }),
  };

  it('times out a hung provider and RE-ROUTES to the next arm', async () => {
    const res = await recognize(req, { providers: [never, stub('gemini')], plan: ['ollama', 'gemini'] });
    expect(res.provider).toBe('gemini');
    expect(res.trail[0]?.kind).toBe('call-failed');
    expect(res.trail[0]?.detail).toMatch(/timed out after 20ms/);
  });

  it('reports the timeout in the thrown error when it was the last arm', async () => {
    await expect(recognize(req, { providers: [never], plan: ['ollama'] }))
      .rejects.toThrow(/ollama: call-failed \(timed out after 20ms\)/);
  });

  it('leaves a provider that answers in time completely alone', async () => {
    const quick: VisionProvider = { ...stub('ollama'), timeoutMs: 5000 };
    const res = await recognize(req, { providers: [quick], plan: ['ollama'] });
    expect(res.text).toBe('ollama says ok');
    expect(res.trail).toEqual([]);
  });

  it('defaults GENEROUSLY — this app waits for a correct answer rather than racing', () => {
    // Operator policy 2026-09-08: single-machine app, latency is a secondary factor. A local
    // eye measured at up to 118s under GPU contention must not be cut off mid-answer, because
    // a timeout here does not just lose the call — it re-routes to a METERED eye, turning a
    // slow free answer into a paid one. The ceiling exists to catch a HUNG daemon, nothing
    // faster.
    expect(DEFAULT_VISION_TIMEOUT_MS).toBeGreaterThanOrEqual(600_000);
  });
});
