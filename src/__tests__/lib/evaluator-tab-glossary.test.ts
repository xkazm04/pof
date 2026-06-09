import { describe, it, expect } from 'vitest';
import {
  EVALUATOR_TAB_INFO,
  EVALUATOR_SECTIONS,
  plainTabLabel,
  type EvaluatorTabId,
} from '@/lib/evaluator/tab-glossary';

// The full set of tab ids the EvaluatorModule renders. Keeping this list here
// (independent of the type) guards against a tab being added to the UI without a
// plain-language entry — the very gap this feature closes.
const ALL_TAB_IDS: EvaluatorTabId[] = [
  'overview', 'nexus', 'constellation', 'features', 'conflicts', 'quality',
  'dependencies', 'analytics', 'spend', 'scanner', 'deep-eval', 'gdd', 'compliance',
  'asset-scout', 'patterns', 'economy', 'perf', 'combat', 'i18n', 'crashes',
  'health', 'build-health', 'pp-studio', 'evolution', 'digest', 'wrapped',
  'roadmap', 'workflows', 'archeologist', 'oracle',
];

describe('evaluator tab glossary', () => {
  it('covers every tab id exactly once', () => {
    const keys = Object.keys(EVALUATOR_TAB_INFO).sort();
    expect(keys).toEqual([...ALL_TAB_IDS].sort());
  });

  it('gives every tab a non-empty label, plain alias, and description', () => {
    for (const id of ALL_TAB_IDS) {
      const info = EVALUATOR_TAB_INFO[id];
      expect(info, `missing info for ${id}`).toBeTruthy();
      expect(info.label.trim().length).toBeGreaterThan(0);
      expect(info.plain.trim().length).toBeGreaterThan(0);
      // Descriptions are full plain-language sentences, not one-word labels.
      expect(info.description.trim().length).toBeGreaterThan(10);
    }
  });

  it('translates the cryptic insider names into plain-language aliases', () => {
    // The whole point: these metaphor names get a human alias that differs from
    // the chip label.
    const cryptic: EvaluatorTabId[] = ['nexus', 'constellation', 'oracle', 'archeologist', 'wrapped', 'digest'];
    for (const id of cryptic) {
      expect(EVALUATOR_TAB_INFO[id].plain.toLowerCase()).not.toBe(
        EVALUATOR_TAB_INFO[id].label.toLowerCase(),
      );
    }
    // Spot-check the two named in the requirement.
    expect(EVALUATOR_TAB_INFO.nexus.plain).toBe('Module map');
    expect(EVALUATOR_TAB_INFO.oracle.plain.toLowerCase()).toContain('asset vs code');
  });

  it('plainTabLabel returns the plain alias', () => {
    expect(plainTabLabel('nexus')).toBe('Module map');
    expect(plainTabLabel('archeologist')).toBe(EVALUATOR_TAB_INFO.archeologist.plain);
  });

  it('describes all five tab-bar sections', () => {
    expect(EVALUATOR_SECTIONS).toHaveLength(5);
    const labels = EVALUATOR_SECTIONS.map((s) => s.label);
    expect(labels).toEqual(['Analysis', 'Quality', 'Simulation', 'Pipeline', 'Intelligence']);
    for (const s of EVALUATOR_SECTIONS) {
      expect(s.blurb.trim().length).toBeGreaterThan(10);
    }
  });
});
