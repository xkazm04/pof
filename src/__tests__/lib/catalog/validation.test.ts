import { describe, it, expect } from 'vitest';
import { generationCallbackSchema, lifecycleStateSchema } from '@/lib/catalog/validation';

describe('generationCallbackSchema', () => {
  it('accepts ueAssets + a pass result', () => {
    expect(generationCallbackSchema.safeParse({
      ueAssets: ['/Script/PoF.GA_Fireball'], testResult: 'pass',
    }).success).toBe(true);
  });
  it('defaults ueAssets to an empty array when omitted', () => {
    expect(generationCallbackSchema.parse({}).ueAssets).toEqual([]);
  });
  it('rejects an invalid testResult', () => {
    expect(generationCallbackSchema.safeParse({ testResult: 'maybe' }).success).toBe(false);
  });
  it('rejects non-string ueAssets entries', () => {
    expect(generationCallbackSchema.safeParse({ ueAssets: [42] }).success).toBe(false);
  });
});

describe('lifecycleStateSchema', () => {
  it('accepts a known state', () => {
    expect(lifecycleStateSchema.safeParse('scaffolded').success).toBe(true);
  });
  it('rejects an unknown state', () => {
    expect(lifecycleStateSchema.safeParse('done').success).toBe(false);
  });
});
