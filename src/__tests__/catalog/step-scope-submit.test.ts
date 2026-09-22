// /diablo W05 (D18): the server refuses a submit to a step that is not part of the entity's pipeline —
// a row for it would put a step the entity does not have into its lifecycle and /status.
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-step-scope-${process.pid}.db`;
});

import { submitStepArtifact } from '@/lib/catalog/headless';
import { seededEntities } from '@/lib/catalog/seed';

describe('submitStepArtifact honours step scope', () => {
  it('refuses Sprite Render for a PoF bestiary entity, naming the profiles', () => {
    const pof = seededEntities('bestiary').find((e) => !e.provenance)!;
    expect(() => submitStepArtifact('bestiary', pof.id, 'Sprite Render', { sprites: {} }, []))
      .toThrow(/applies only to canon profile\(s\) diablo1/);
  });

  it('still accepts an unscoped step for the same entity', () => {
    const pof = seededEntities('bestiary').find((e) => !e.provenance)!;
    expect(submitStepArtifact('bestiary', pof.id, 'Lore / Codex', { lore: 'x'.repeat(10) }, []).artifact.step).toBe('Lore / Codex');
  });
});
