import { describe, it, expect } from 'vitest';
import { TEXT_SCALE } from '@/lib/typography-scale';

// Guards the type-scale rule for sub-`sm` text: descriptive copy lives at the
// `text-xs` floor, dense metadata at `text-2xs`. The tactical game-systems views
// (AIBehaviorView, SquadChoreographyEditor, EQS/cover diagrams, …) read these
// tokens so hierarchy stays consistent instead of drifting below the floor.
describe('TEXT_SCALE', () => {
  it('maps descriptive copy to the text-xs readable floor', () => {
    expect(TEXT_SCALE.body).toBe('text-xs');
  });

  it('reserves text-2xs strictly for dense metadata', () => {
    expect(TEXT_SCALE.meta).toBe('text-2xs');
  });

  it('keeps body above the metadata floor — they are distinct tiers', () => {
    expect(TEXT_SCALE.body).not.toBe(TEXT_SCALE.meta);
  });

  it('never lets descriptive copy fall to a sub-floor size', () => {
    // The whole point: body must not be the 10px metadata size.
    expect(TEXT_SCALE.body).not.toBe('text-2xs');
    // Nor an arbitrary sub-floor literal that the normalization removes.
    expect(TEXT_SCALE.body).not.toMatch(/text-\[(?:9|10|11)px\]/);
  });
});
