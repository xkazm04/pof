import { describe, it, expect } from 'vitest';
import { DEFAULT_EFFECTS } from '@/lib/post-process-studio/effects';
import { ALL_CUE_KINDS } from '@/components/modules/evaluator/ParamCue';

/**
 * Guards the plain-language decoder: every cryptic UE param must ship a
 * complete, non-jargon explanation and a cue the renderer actually supports.
 */
describe('post-process plain-language metadata', () => {
  const allParams = DEFAULT_EFFECTS.flatMap((e) =>
    e.params.map((p) => ({ effect: e.name, param: p })),
  );

  it('covers every effect param with plain metadata', () => {
    for (const { effect, param } of allParams) {
      expect(param.plain, `${effect} → ${param.name} is missing plain metadata`).toBeDefined();
    }
  });

  it('has non-empty label, explanation, and end labels', () => {
    for (const { effect, param } of allParams) {
      const plain = param.plain;
      expect(plain, `${effect} → ${param.name}`).toBeDefined();
      if (!plain) continue;
      expect(plain.label.trim().length).toBeGreaterThan(0);
      expect(plain.explanation.trim().length).toBeGreaterThan(0);
      expect(plain.lowLabel.trim().length).toBeGreaterThan(0);
      expect(plain.highLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('only uses cue kinds the ParamCue component can render', () => {
    for (const { effect, param } of allParams) {
      if (!param.plain) continue;
      expect(ALL_CUE_KINDS, `${effect} → ${param.name} cue "${param.plain.cue}"`).toContain(
        param.plain.cue,
      );
    }
  });

  it('keeps the raw UE jargon out of the plain label and explanation', () => {
    for (const { param } of allParams) {
      if (!param.plain) continue;
      // The friendly label is not just the UE property echoed back…
      expect(param.plain.label).not.toBe(param.ueProperty);
      // …and the raw UE identifier never leaks into the everyday explanation.
      expect(param.plain.explanation).not.toContain(param.ueProperty);
    }
  });
});
