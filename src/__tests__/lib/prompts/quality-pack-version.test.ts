import { describe, it, expect } from 'vitest';
import { PROMPT_VERSION, packFingerprint } from '@/lib/prompts/quality';

/**
 * The bump guard for the quality pack's version axis.
 *
 * `PROMPT_VERSION` is what judge-fitness aggregates scores on
 * (`lib/prompt-evolution/judge-fitness.ts`). If the pack's CONTENT changes while the
 * version label stays put, two materially different prompt packs collapse into one
 * fitness bucket — and the "did the revision help?" comparison the loop exists for
 * silently compares a pack against itself.
 *
 * So the pair below is pinned. Changing pack content is expected and fine; changing it
 * WITHOUT bumping the version is the bug this catches.
 */
const PINNED = {
  version: 'q1',
  fingerprint: '1lm6bv4',
};

describe('quality pack version guard', () => {
  it('pack content has not drifted away from its PROMPT_VERSION', () => {
    expect(
      { version: PROMPT_VERSION, fingerprint: packFingerprint() },
      'Quality pack content changed. Bump PROMPT_VERSION in src/lib/prompts/quality/index.ts ' +
        'to the next q<n>, then update PINNED in this test to the new {version, fingerprint} pair. ' +
        'Do NOT just update the fingerprint — that silently merges two different packs into one ' +
        'judge-fitness bucket.',
    ).toEqual(PINNED);
  });

  it('fingerprint is deterministic and short', () => {
    expect(packFingerprint()).toBe(packFingerprint());
    expect(packFingerprint()).toMatch(/^[0-9a-z]{7}$/);
  });
});
