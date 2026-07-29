import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyForgeError } from '@/lib/forge-errors';

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerate };
  },
}));

import { POST } from '@/app/api/agents/forge-ability/route';

const VALID_ABILITY = {
  className: 'GA_FrostNova',
  displayName: 'Frost Nova',
  description: 'Freezes nearby foes.',
  headerCode: '#pragma once\n// header',
  cppCode: '// cpp',
  tags: {
    abilityTag: 'Ability_FrostNova',
    cooldownTag: 'Cooldown_FrostNova',
    ownedTags: ['State_Attacking'],
    blockedTags: ['State_Dead', 'State_Stunned'],
  },
  stats: { baseDamage: 30, manaCost: 25, cooldownSec: 8, damageType: 'Ice' },
  comboEntry: { animDuration: 0.9, damageWindow: [0.3, 0.5], recovery: 0.2, comboMultiplier: 1.2 },
  radarValues: [0.6, 0.3, 0.8, 0.4, 0.5],
};

function req(body: unknown): Request {
  return new Request('http://localhost/api/agents/forge-ability', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function geminiReturns(text: string, finishReason = 'STOP') {
  mockGenerate.mockResolvedValueOnce({
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.GEMINI_FORGE_MODEL;
});

describe('POST /api/agents/forge-ability', () => {
  it('ok: returns the forged ability and calls a CURRENT model with a raised token ceiling', async () => {
    geminiReturns(JSON.stringify(VALID_ABILITY));

    const res = await POST(req({ prompt: 'a frost nova' }) as never);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.className).toBe('GA_FrostNova');

    const call = mockGenerate.mock.calls[0][0];
    expect(call.model).toBe('gemini-2.5-flash');
    expect(call.model).not.toBe('gemini-2.0-flash');
    expect(call.config.maxOutputTokens).toBeGreaterThan(4096);
  });

  it('ok: honours the GEMINI_FORGE_MODEL override', async () => {
    process.env.GEMINI_FORGE_MODEL = 'gemini-2.5-pro';
    geminiReturns(JSON.stringify(VALID_ABILITY));

    await POST(req({ prompt: 'x' }) as never);
    expect(mockGenerate.mock.calls[0][0].model).toBe('gemini-2.5-pro');
  });

  it('truncated: reports the token limit, not "unreadable answer"', async () => {
    geminiReturns('{"className":"GA_Half","headerCode":"#pragma on', 'MAX_TOKENS');

    const res = await POST(req({ prompt: 'x' }) as never);
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/truncated/i);
    expect(classifyForgeError(new Error(json.error)).kind).toBe('truncated');
  });

  it('partial: a shape-invalid payload is rejected with the missing fields named', async () => {
    const partial = { ...VALID_ABILITY, stats: { baseDamage: 30 }, radarValues: [0.1] };
    geminiReturns(JSON.stringify(partial));

    const res = await POST(req({ prompt: 'x' }) as never);
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.success).toBe(false);
    expect(json.error).toContain('stats.manaCost');
    expect(json.error).toContain('radarValues');
    expect(classifyForgeError(new Error(json.error)).kind).toBe('schema-mismatch');
  });

  it('404-model: a decommissioned model is a CONFIG error, not gibberish', async () => {
    mockGenerate.mockRejectedValueOnce(
      new Error('[404 Not Found] models/gemini-2.0-flash is not found for API version v1beta'),
    );

    const res = await POST(req({ prompt: 'x' }) as never);
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.success).toBe(false);
    const card = classifyForgeError(new Error(json.error));
    expect(card.kind).toBe('config');
    expect(card.actions).toContain('configure');
  });

  it('rejects a missing prompt before calling the model', async () => {
    const res = await POST(req({}) as never);
    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
