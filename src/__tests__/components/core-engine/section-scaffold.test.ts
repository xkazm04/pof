import { describe, it, expect } from 'vitest';
import {
  scaffoldTargets,
  sectionScaffoldState,
  scaffoldQueue,
} from '@/components/modules/core-engine/unique-tabs/sectionScaffold';
import { getFeatureInitPrompt } from '@/components/modules/core-engine/unique-tabs/feature-init-prompts';

/**
 * Feature Map reads the UE project (scan-sweep --challenge core-engine-genre-tabs/B).
 * A section's scaffold targets are the classes its init prompt CREATES (numbered
 * "Create" lines of getFeatureInitPrompt — not a second hand list), and a section is
 * graded only against the project's scanned UCLASS/USTRUCT/UENUM names.
 */

const names = (...n: string[]) => n.map((name) => ({ name }));

describe('scaffoldTargets — parsed from the init prompt', () => {
  it('arpg-combat traces -> the hit detection component on its Create line', () => {
    expect(scaffoldTargets('arpg-combat', 'traces')).toEqual(['UARPGHitDetectionComponent']);
    const prompt = getFeatureInitPrompt('arpg-combat', 'traces')!.prompt;
    expect(prompt).toMatch(/^\d+\. Create UARPGHitDetectionComponent\b/m);
  });

  it('arpg-character curve-editor -> UARPGFeelProfile only (the player character is modified, not created)', () => {
    expect(scaffoldTargets('arpg-character', 'curve-editor')).toEqual(['UARPGFeelProfile']);
  });

  it('a class the line only quantifies or mentions is not a target ("Create 3 UARPGFeelProfile presets")', () => {
    expect(scaffoldTargets('arpg-character', 'optimizer')).toEqual([]);
    expect(scaffoldTargets('arpg-character', 'scaling')).toEqual([]);
  });
});

describe('sectionScaffoldState — graded against scanned names', () => {
  it('a prompt that creates no ARPG class is unverifiable; a section with no prompt is no-prompt', () => {
    expect(sectionScaffoldState('arpg-gas', 'tags', [])).toEqual({ state: 'unverifiable' });
    expect(sectionScaffoldState('arpg-save', 'groups', [])).toEqual({ state: 'no-prompt' });
  });

  it('no project scan -> unscanned', () => {
    expect(sectionScaffoldState('arpg-combat', 'traces', null)).toMatchObject({ state: 'unscanned' });
  });

  it('waves: one of two classes present -> partial naming the missing one; both -> scaffolded', () => {
    expect(sectionScaffoldState('arpg-enemy-ai', 'waves', names('FARPGWaveConfig'))).toEqual({
      state: 'partial',
      present: ['FARPGWaveConfig'],
      missing: ['UARPGEncounterManager'],
    });
    expect(
      sectionScaffoldState('arpg-enemy-ai', 'waves', names('FARPGWaveConfig', 'UARPGEncounterManager')),
    ).toMatchObject({ state: 'scaffolded' });
  });

  it('a U-prefixed "struct" target is found under its UE F-prefix (UHT forbids the same body name twice)', () => {
    expect(sectionScaffoldState('arpg-loot', 'beacon', names('FARPGLootBeacon'))).toMatchObject({
      state: 'scaffolded',
      present: ['UARPGLootBeacon'],
    });
  });
});

describe('scaffoldQueue — feature-map order, absent|partial only', () => {
  it('enemy-ai with only the archetype scanned starts at modifiers; scaffolded and unverifiable sections are excluded', () => {
    const q = scaffoldQueue('arpg-enemy-ai', names('UARPGEnemyArchetype'));
    expect(q[0]).toBe('modifiers');
    expect(q).toEqual(['modifiers', 'behavior-tree', 'decision-log', 'aggro', 'formations', 'waves']);
    expect(q).not.toContain('cards');
    expect(q).not.toContain('radar');
    expect(q).not.toContain('difficulty');
  });
});
