import { describe, it, expect } from 'vitest';
import { ollamaProvider } from '@/lib/vision/providers/ollama';
import { geminiProvider, geminiThinkingConfig } from '@/lib/vision/providers/gemini';
import { defaultProviders, qwenCloudProvider } from '@/lib/vision/providers';
import { makeRoutedVision, makeRoutedVisionText } from '@/lib/vision/seam';
import type { VisionProvider } from '@/lib/vision/types';

const req = { images: [{ base64: 'AAA', mime: 'image/png' }], prompt: 'what is this' };

describe('ollama provider — the local eye', () => {
  it('is NOT configured when no host is set, so a machine without a daemon skips it honestly', () => {
    const p = ollamaProvider({ host: '' });
    expect(p.isConfigured()).toBe(false);
  });

  it('is configured when a host is set, and serves recognize', () => {
    const p = ollamaProvider({ host: 'http://localhost:11434' });
    expect(p.isConfigured()).toBe(true);
    expect(p.capabilities).toContain('recognize');
  });

  it('posts the images to the host chat endpoint and returns the answering model', async () => {
    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    const fetchImpl = (async (url: string, init: { body: string }) => {
      seenUrl = url;
      seenBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ model: 'qwen3.8:27b', message: { content: 'a red potion' } }),
      };
    }) as unknown as typeof fetch;

    const p = ollamaProvider({ host: 'http://localhost:11434/', model: 'qwen3.8:27b', fetchImpl });
    const answer = await p.recognize(req);

    expect(seenUrl).toBe('http://localhost:11434/api/chat');
    expect(seenBody.model).toBe('qwen3.8:27b');
    expect(seenBody.stream).toBe(false);
    // Reasoning models burn minutes thinking about a frame description.
    expect(seenBody.think).toBe(false);
    const messages = seenBody.messages as { content: string; images: string[] }[];
    expect(messages[0].images).toEqual(['AAA']);
    expect(messages[0].content).toBe('what is this');
    expect(answer.text).toBe('a red potion');
    expect(answer.model).toBe('qwen3.8:27b');
    expect(answer.attribution).toBe('answered');
  });

  it('reports a non-ok response as an error so the router re-routes instead of returning empty', async () => {
    const fetchImpl = (async () => ({ ok: false, status: 500, text: async () => 'boom' })) as unknown as typeof fetch;
    const p = ollamaProvider({ host: 'http://localhost:11434', fetchImpl });
    await expect(p.recognize(req)).rejects.toThrow(/500/);
  });
});

describe('multi-frame is DECLARED per provider, never inferred from single-frame support', () => {
  it('the two cloud eyes declare it — they are the pair `verify/animation` has always used', () => {
    // Not a guess: `critiqueAnimation` has shipped N-frame filmstrips to both of these through
    // the inline ternary this migration removes. Declaring it is recording what already runs.
    expect(geminiProvider().capabilities).toContain('recognize-multiframe');
    expect(qwenCloudProvider().capabilities).toContain('recognize-multiframe');
  });

  it('the LOCAL eye does not declare it — multi-image-in-one-call is unmeasured here', () => {
    // Direction 2026-09-08: "multi-image-in-one-call support varies per ollama vision model;
    // that is a request-level constraint, not a preference". An undeclared capability is an
    // honest absence that lands in the trail as `no-capability`; declaring it on the strength
    // of single-frame success would be exactly the silent N-images-read-one failure the
    // chokepoint exists to prevent.
    expect(ollamaProvider({ host: 'http://x' }).capabilities).not.toContain('recognize-multiframe');
    expect(ollamaProvider({ host: 'http://x' }).capabilities).toContain('recognize');
  });
});

describe('the roster carries a caller model pin without the caller naming a vendor', () => {
  it('applies the pin to every provider that has one, and keeps the roster complete', () => {
    const ids = defaultProviders({ model: 'some-model' }).map((p) => p.id);
    expect(ids).toEqual(['ollama', 'qwen-cloud', 'gemini']);
  });

  it('reaches the local eye as its model, proving the pin is threaded and not dropped', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_u: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ model: 'm', message: { content: 'x' } }) };
    }) as unknown as typeof fetch;
    await ollamaProvider({ host: 'http://x', model: 'pinned-vl:7b', fetchImpl }).recognize(req);
    expect(bodies[0].model).toBe('pinned-vl:7b');
  });
});

describe('makeRoutedVision — the drop-in that replaces a named vendor at a call site', () => {
  it('has the existing seam shape (images, prompt) => VisionAnswer and routes through the plan', async () => {
    const providers: VisionProvider[] = [
      {
        id: 'ollama',
        capabilities: ['recognize'],
        isConfigured: () => true,
        recognize: async () => ({ text: 'local answer', model: 'qwen3.8:27b', attribution: 'answered', fellBackFrom: [] }),
      },
    ];
    const vision = makeRoutedVision({ providers, plan: ['ollama'] });
    const answer = await vision(req.images, req.prompt);
    expect(answer.text).toBe('local answer');
    expect(answer.model).toBe('qwen3.8:27b');
  });
});

describe('makeRoutedVisionText — the text-only drop-in for makeQwenVision()', () => {
  it('returns the raw text, matching the (images, prompt) => Promise<string> seam the gates declare', async () => {
    const providers: VisionProvider[] = [
      {
        id: 'ollama',
        capabilities: ['recognize'],
        isConfigured: () => true,
        recognize: async () => ({ text: '{"score":8}', model: 'qwen3.8:27b', attribution: 'answered', fellBackFrom: [] }),
      },
    ];
    const vision = makeRoutedVisionText({ providers, plan: ['ollama'] });
    const text = await vision(req.images, req.prompt);
    expect(text).toBe('{"score":8}');
  });
});

describe('effort maps onto each provider\'s real knob, and the map is declared not assumed', () => {
  it('gemini declares the three levels its API actually accepts', () => {
    // Probed live against gemini-3.8-flash on 2026-09-08: `none` / `minimal` / `max` are
    // rejected with "Invalid value at generation_config.thinking_config.thinking_level".
    expect(geminiProvider().effortLevels).toEqual(['low', 'medium', 'high']);
  });

  it('translates an effort level into the thinkingConfig the API takes', () => {
    expect(geminiThinkingConfig('high')).toEqual({ thinkingLevel: 'high' });
    expect(geminiThinkingConfig('low')).toEqual({ thinkingLevel: 'low' });
    expect(geminiThinkingConfig(undefined)).toBeUndefined();
  });

  it('ollama declares only the two its boolean `think` knob can express', () => {
    // The daemon has no three-level dial — `think` is a boolean. Declaring low+high is the
    // honest shape: a caller asking for `medium` gets `low` and is TOLD it was downgraded,
    // rather than having the request quietly ignored.
    expect(ollamaProvider({ host: 'http://x' }).effortLevels).toEqual(['low', 'high']);
  });

  it('sends think:true only when the served effort is high', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_u: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ model: 'm', message: { content: 'x' } }) };
    }) as unknown as typeof fetch;
    const p = ollamaProvider({ host: 'http://x', fetchImpl });
    await p.recognize({ ...req, effort: 'high' });
    await p.recognize({ ...req, effort: 'low' });
    expect(bodies[0].think).toBe(true);
    expect(bodies[1].think).toBe(false);
  });
});

describe('ollama call shape — the fields gravitone learned by failure', () => {
  function capture(responses: unknown[] = [{ ok: true, json: async () => ({ model: 'm', message: { content: 'x' } }) }]) {
    const bodies: Record<string, unknown>[] = [];
    let n = 0;
    const fetchImpl = (async (_u: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return responses[Math.min(n++, responses.length - 1)];
    }) as unknown as typeof fetch;
    return { bodies, fetchImpl };
  }

  it('pins temperature 0 and a context window — determinism is the whole mechanism', async () => {
    const { bodies, fetchImpl } = capture();
    await ollamaProvider({ host: 'http://x', fetchImpl }).recognize(req);
    expect((bodies[0].options as Record<string, unknown>).temperature).toBe(0);
    expect((bodies[0].options as Record<string, unknown>).num_ctx).toBe(8192);
  });

  it('RETRIES WITHOUT `think` on a 400 — a model with no thinking mode rejects the key outright', async () => {
    // Measured in gravitone's probe.py: the 400 IS the model refusing an unknown key, so the
    // one honest recovery is to drop it and ask again. Retrying on any other status would be
    // guessing; a 500 is retried by the transport, and a 401 will fail identically forever.
    const { bodies, fetchImpl } = capture([
      { ok: false, status: 400, text: async () => 'unknown key: think' },
      { ok: true, json: async () => ({ model: 'm', message: { content: 'ok' } }) },
    ]);
    const answer = await ollamaProvider({ host: 'http://x', fetchImpl }).recognize({ ...req, effort: 'high' });
    expect(bodies).toHaveLength(2);
    expect(bodies[0].think).toBe(true);
    expect('think' in bodies[1]).toBe(false);
    expect(answer.text).toBe('ok');
  });

  it('does NOT retry a non-400 failure — that is the transport\'s job, not a shape problem', async () => {
    const { bodies, fetchImpl } = capture([{ ok: false, status: 500, text: async () => 'boom' }]);
    await expect(ollamaProvider({ host: 'http://x', fetchImpl }).recognize(req)).rejects.toThrow(/500/);
    expect(bodies).toHaveLength(1);
  });

  it('forwards a JSON schema as `format`, which the local daemon enforces natively', async () => {
    const { bodies, fetchImpl } = capture();
    const schema = { type: 'object', properties: { verdict: { type: 'string' } }, required: ['verdict'] };
    await ollamaProvider({ host: 'http://x', fetchImpl }).recognize({ ...req, schema });
    expect(bodies[0].format).toEqual(schema);
  });

  it('omits `format` entirely when no schema was asked for', async () => {
    const { bodies, fetchImpl } = capture();
    await ollamaProvider({ host: 'http://x', fetchImpl }).recognize(req);
    expect('format' in bodies[0]).toBe(false);
  });
});

describe('ollama honours the router\'s abort signal — abandoning is not cancelling', () => {
  it('forwards the signal to fetch so a timed-out call really stops', async () => {
    let seenSignal: AbortSignal | undefined;
    const fetchImpl = (async (_u: string, init: { signal?: AbortSignal }) => {
      seenSignal = init.signal;
      return { ok: true, json: async () => ({ model: 'm', message: { content: 'x' } }) };
    }) as unknown as typeof fetch;
    const controller = new AbortController();
    await ollamaProvider({ host: 'http://x', fetchImpl }).recognize(req, controller.signal);
    expect(seenSignal).toBe(controller.signal);
  });

  it('works with no signal at all — the parameter is optional, not required plumbing', async () => {
    const fetchImpl = (async () => ({ ok: true, json: async () => ({ model: 'm', message: { content: 'ok' } }) })) as unknown as typeof fetch;
    const answer = await ollamaProvider({ host: 'http://x', fetchImpl }).recognize(req);
    expect(answer.text).toBe('ok');
  });
});
