import { describe, it, expect } from 'vitest';
import { ollamaProvider } from '@/lib/vision/providers/ollama';
import { geminiProvider, geminiThinkingConfig } from '@/lib/vision/providers/gemini';
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
