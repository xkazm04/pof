import { describe, it, expect } from 'vitest';
import {
  UI_OVERHAUL_AREAS,
  UI_OVERHAUL_SUMMARY,
} from '@/lib/harness/ui-overhaul-areas';
import {
  CONTENT_OVERHAUL_AREAS,
  CONTENT_OVERHAUL_SUMMARY,
} from '@/lib/harness/content-overhaul-areas';
import type { ModuleArea } from '@/lib/harness/types';

/**
 * Regression guard for the overhaul-area catalogs. After hoisting the verbatim
 * Part 1/2/3 prompts into shared consts, this asserts (a) the per-phase area
 * counts are unchanged, and (b) the dedup invariant — every part of a multi-part
 * step shares one identical description, so editing a prompt can't silently
 * desync the other parts.
 */

/** Multi-part areas labelled "<Step> (Part N)" must share one description. */
function assertPartsSharePrompt(areas: ModuleArea[]) {
  const byBaseLabel = new Map<string, ModuleArea[]>();
  for (const a of areas) {
    const m = a.label.match(/^(.*) \(Part \d+\)$/);
    if (!m) continue;
    const base = m[1];
    (byBaseLabel.get(base) ?? byBaseLabel.set(base, []).get(base)!).push(a);
  }

  for (const [base, group] of byBaseLabel) {
    const descriptions = new Set(group.map((a) => a.description));
    expect(descriptions.size, `"${base}" parts must share one prompt`).toBe(1);
  }

  // Sanity: at least one multi-part step exists so the check isn't vacuous.
  expect(byBaseLabel.size).toBeGreaterThan(0);
}

describe('UI overhaul areas', () => {
  it('per-phase counts match the summary and total', () => {
    expect(UI_OVERHAUL_SUMMARY).toEqual({
      phase0_infrastructure: 9,
      phase1_featureMetrics: 15,
      phase2_scaling: 14,
      phase3_flow: 7,
      phase4_visual: 12,
      phase5_integration: 4,
      total: 61,
    });
    expect(UI_OVERHAUL_AREAS).toHaveLength(UI_OVERHAUL_SUMMARY.total);
    const phaseSum =
      UI_OVERHAUL_SUMMARY.phase0_infrastructure +
      UI_OVERHAUL_SUMMARY.phase1_featureMetrics +
      UI_OVERHAUL_SUMMARY.phase2_scaling +
      UI_OVERHAUL_SUMMARY.phase3_flow +
      UI_OVERHAUL_SUMMARY.phase4_visual +
      UI_OVERHAUL_SUMMARY.phase5_integration;
    expect(phaseSum).toBe(UI_OVERHAUL_SUMMARY.total);
  });

  it('area ids are unique', () => {
    const ids = UI_OVERHAUL_AREAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every part of a multi-part step shares one prompt', () => {
    assertPartsSharePrompt(UI_OVERHAUL_AREAS);
  });

  it('builds well-formed areas (features mirror featureNames)', () => {
    for (const a of UI_OVERHAUL_AREAS) {
      expect(a.moduleId).toBe('arpg-character');
      expect(a.status).toBe('pending');
      expect(a.features.map((f) => f.name)).toEqual(a.featureNames);
      expect(a.features.every((f) => f.status === 'pending')).toBe(true);
    }
  });
});

describe('Content overhaul areas', () => {
  it('per-phase counts match the summary and total', () => {
    expect(CONTENT_OVERHAUL_SUMMARY).toEqual({
      phase0_infrastructure: 3,
      phase1_animations: 3,
      phase1_audio: 3,
      phase1_level: 3,
      phase1_materials: 2,
      phase1_models: 1,
      phase1_uihud: 3,
      phase2_audit: 1,
      total: 19,
    });
    expect(CONTENT_OVERHAUL_AREAS).toHaveLength(CONTENT_OVERHAUL_SUMMARY.total);
  });

  it('area ids are unique', () => {
    const ids = CONTENT_OVERHAUL_AREAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds well-formed areas via the shared helper', () => {
    for (const a of CONTENT_OVERHAUL_AREAS) {
      expect(a.moduleId).toBe('animations');
      expect(a.status).toBe('pending');
      expect(a.features.map((f) => f.name)).toEqual(a.featureNames);
    }
  });
});
