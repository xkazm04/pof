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

  it('scopes the cache to the destination set/event (no cross-set cache bleed)', () => {
    // The same prompt aimed at a different set/event must be a cache MISS, so it
    // generates into the requested set instead of returning the foreign one.
    const h = computePromptHash({ ...base, setKey: 'weapon-impacts', eventKey: 'weapon_hit' });
    expect(computePromptHash({ ...base, setKey: 'boss-attacks', eventKey: 'weapon_hit' })).not.toBe(h);
    expect(computePromptHash({ ...base, setKey: 'weapon-impacts', eventKey: 'boss_swing' })).not.toBe(h);
  });

  it('still hits for an identical request to the same set/event', () => {
    const a = computePromptHash({ ...base, setKey: 's1', eventKey: 'e1' });
    const b = computePromptHash({ ...base, setKey: 's1', eventKey: 'e1' });
    expect(a).toBe(b);
  });
});
