import { describe, expect, it } from 'vitest';
import { summarizeAnimationPrompt } from '@/lib/animation/explain';

describe('summarizeAnimationPrompt', () => {
  it('returns the no-concepts fallback for unrelated text', () => {
    const s = summarizeAnimationPrompt('Pour milk and add cereal.');
    expect(s.detected).toEqual([]);
    expect(s.headline).toMatch(/no animation concepts/i);
    expect(s.bullets).toEqual([]);
  });

  it('emits a lifecycle bullet when NativeUpdateAnimation is referenced', () => {
    const s = summarizeAnimationPrompt(
      'Override NativeUpdateAnimation to read Speed from CharacterMovementComponent.'
    );
    expect(s.detected.length).toBeGreaterThan(0);
    expect(s.bullets.some((b) => /per-frame/i.test(b))).toBe(true);
  });

  it('emits a montage bullet when scripted clips are referenced', () => {
    const s = summarizeAnimationPrompt(
      'Use Montage_JumpToSection on AnimMontage to chain combo sections.'
    );
    expect(s.bullets.some((b) => /scripted clip/i.test(b))).toBe(true);
  });

  it('combines multiple themes when text spans concepts', () => {
    const s = summarizeAnimationPrompt(
      'Create a blend space driven by Speed, then play an AnimMontage for the attack with anim notify events.'
    );
    const joined = s.bullets.join(' || ');
    expect(joined).toMatch(/blend spaces?/i);
    expect(joined).toMatch(/scripted clip/i);
    expect(joined).toMatch(/gameplay event/i);
  });

  it('caps the summary at 4 bullets', () => {
    const s = summarizeAnimationPrompt(
      [
        'NativeUpdateAnimation',
        'blend space',
        'AnimMontage',
        'anim notify',
        'root motion',
        'priority cascade',
        'Mixamo',
        'IK Retargeter',
      ].join(' ')
    );
    expect(s.bullets.length).toBeLessThanOrEqual(4);
  });

  it('headline mentions plain English when themes match', () => {
    const s = summarizeAnimationPrompt('Set up the state machine with a blend space.');
    expect(s.headline.toLowerCase()).toContain('plain english');
  });
});
