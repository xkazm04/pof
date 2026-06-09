import { describe, it, expect } from 'vitest';
import { computePromptHash } from '@/lib/audio-gen/prompt-hash';

describe('computePromptHash', () => {
  const base = { provider: 'elevenlabs', kind: 'sfx' as const, prompt: 'footstep on stone', durationSeconds: 1.5 };

  it('is stable + 64-hex for identical input', () => {
    const a = computePromptHash(base);
    const b = computePromptHash({ ...base });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores surrounding/collapsible whitespace in the prompt', () => {
    expect(computePromptHash({ ...base, prompt: '  footstep   on stone  ' }))
      .toBe(computePromptHash(base));
  });

  it('differs when provider, kind, prompt, or duration change', () => {
    const h = computePromptHash(base);
    expect(computePromptHash({ ...base, provider: 'other' })).not.toBe(h);
    expect(computePromptHash({ ...base, kind: 'ambient' })).not.toBe(h);
    expect(computePromptHash({ ...base, prompt: 'footstep on wood' })).not.toBe(h);
    expect(computePromptHash({ ...base, durationSeconds: 2 })).not.toBe(h);
  });

  it('treats omitted duration ("auto") distinctly from a number', () => {
    const auto = computePromptHash({ provider: 'elevenlabs', kind: 'sfx', prompt: 'x' });
    const one = computePromptHash({ provider: 'elevenlabs', kind: 'sfx', prompt: 'x', durationSeconds: 1 });
    expect(auto).not.toBe(one);
  });
});
