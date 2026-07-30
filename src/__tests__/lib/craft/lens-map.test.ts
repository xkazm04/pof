/**
 * Lens map + ceilings completeness — the guarantees that make the A-axis total:
 * every audited deliverable class maps to a lens and has a recorded ceiling, catalog
 * overrides only redirect text-shaped classes, and lens versions cover every lens.
 */
import { describe, it, expect } from 'vitest';
import stepFactsJson from '@/lib/status/step-facts.json';
import ceilingsJson from '@/lib/craft/craft-ceilings.json';
import {
  LENS_IDS,
  DELIVERABLE_LENS,
  TEXT_CLASSES,
  lensForStep,
  type DeliverableClass,
} from '@/lib/craft/lens-map';
import { LENS_VERSIONS } from '@/lib/craft/lens-versions';
import { A_LADDER } from '@/lib/status/craft';

const FACTS = (stepFactsJson as { steps: { catalogId: string; step: string; deliverable: string }[] }).steps;
const CEILINGS = (ceilingsJson as {
  ceilings: Record<string, { ceiling: string; class: string; reason: string }>;
}).ceilings;

describe('lens-map completeness', () => {
  const auditedClasses = [...new Set(FACTS.map((f) => f.deliverable))];

  it('every deliverable class in step-facts.json maps to a lens', () => {
    for (const cls of auditedClasses) {
      expect(DELIVERABLE_LENS[cls as DeliverableClass], `unmapped deliverable class: ${cls}`).toBeDefined();
    }
  });

  it('every audited step resolves to a lens through lensForStep', () => {
    for (const f of FACTS) {
      const lens = lensForStep(f.deliverable as DeliverableClass, f.catalogId);
      expect(LENS_IDS).toContain(lens);
    }
  });

  it('production-process is never assigned to a step — it gauges catalogs', () => {
    for (const f of FACTS) {
      expect(lensForStep(f.deliverable as DeliverableClass, f.catalogId)).not.toBe('production-process');
    }
  });

  it('catalog overrides only redirect text-shaped classes — media lenses cannot be dodged', () => {
    for (const f of FACTS) {
      const cls = f.deliverable as DeliverableClass;
      if ((TEXT_CLASSES as readonly string[]).includes(cls) || cls === 'audio') continue;
      expect(lensForStep(cls, f.catalogId)).toBe(DELIVERABLE_LENS[cls]);
    }
  });

  it('dialogue and narrative overrides land where designed', () => {
    expect(lensForStep('text-config', 'dialog-trees')).toBe('dialogue');
    expect(lensForStep('graph-data', 'dialog-trees')).toBe('dialogue');
    expect(lensForStep('text-config', 'quests')).toBe('narrative');
    expect(lensForStep('text-config', 'items')).toBe('game-systems-code');
    expect(lensForStep('2d-art', 'dialog-trees')).toBe('2d-art');
    expect(lensForStep('audio', 'cutscenes')).toBe('voiceover');
    expect(lensForStep('audio', 'music')).toBe('audio');
  });
});

describe('craft ceilings', () => {
  const auditedClasses = [...new Set(FACTS.map((f) => f.deliverable))];

  it('every audited deliverable class has a recorded ceiling', () => {
    for (const cls of auditedClasses) {
      expect(CEILINGS[cls], `no ceiling recorded for deliverable class: ${cls}`).toBeDefined();
    }
  });

  it('every ceiling is a valid A-level with a class and a non-empty reason', () => {
    for (const [cls, c] of Object.entries(CEILINGS)) {
      expect(A_LADDER, `${cls} ceiling`).toContain(c.ceiling);
      expect(['permanent', 'arguable', 'uncapped'], `${cls} class`).toContain(c.class);
      expect(c.reason.length, `${cls} reason`).toBeGreaterThan(20);
    }
  });

  it('the market bet is recorded: 3D and animation capped, text/code uncapped', () => {
    expect(CEILINGS['3d-mesh'].ceiling).toBe('A2');
    expect(CEILINGS['3d-mesh'].class).toBe('permanent');
    expect(CEILINGS.animation.ceiling).toBe('A2');
    expect(CEILINGS['text-config'].ceiling).toBe('A4');
    expect(CEILINGS['ue-runtime'].ceiling).toBe('A4');
  });
});

describe('lens versions', () => {
  it('every lens has a current version ≥ 1', () => {
    for (const lens of LENS_IDS) {
      expect(LENS_VERSIONS[lens], `no version for lens: ${lens}`).toBeGreaterThanOrEqual(1);
    }
  });
});
