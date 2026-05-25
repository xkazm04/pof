import { describe, it, expect } from 'vitest';
import { buildMontagePrompt } from '@/lib/animation/montage-prompt';

describe('buildMontagePrompt', () => {
  it('names the montage, category, and trimmed instruction', () => {
    const p = buildMontagePrompt('AM_Combo1', 'Attack', '  add recovery window  ');
    expect(p).toContain('AM_Combo1');
    expect(p).toContain('Attack');
    expect(p).toContain('add recovery window');
    expect(p).not.toContain('  add recovery');
  });

  it('instructs reuse of the AnimBP/montage pipeline + root motion', () => {
    const p = buildMontagePrompt('X', 'Attack', 'faster');
    expect(p).toMatch(/AnimBP|montage/i);
    expect(p).toMatch(/root motion/i);
  });

  it('works with an empty instruction', () => {
    expect(buildMontagePrompt('Y', 'Idle', '').length).toBeGreaterThan(0);
  });
});
