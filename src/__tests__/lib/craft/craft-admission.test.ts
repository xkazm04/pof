/**
 * The craft gauge admission door + the read-side defence for gauges already stored.
 *
 * The server owns the lens (`lensForStep` over the audited step fact), the lens version
 * (`LENS_VERSIONS`) and the medium's roof (`craft-ceilings.json`); a writer may no longer
 * re-label a gauge, stamp a version not in force, or award a level above the roof. Everything
 * here refuses or projects A0 — nothing reads better.
 */
import { describe, it, expect } from 'vitest';
import { admitCraftGauge } from '@/lib/craft/admission';
import { craftForCell } from '@/lib/craft/craftCell';
import { LENS_VERSIONS } from '@/lib/craft/lens-versions';
import { craftOf } from '@/lib/status/craft';

const gauge = (over: Record<string, unknown> = {}) => ({
  catalogId: 'items', entityId: 'e1', step: 'Concept Brief', aLevel: 'A3' as const, ...over,
});

describe('admitCraftGauge — the write door', () => {
  it('derives the lens and version when the writer omits them', () => {
    const r = admitCraftGauge(gauge({ catalogId: 'dialog-trees' }));
    expect(r).toEqual({ ok: true, data: { lens: 'dialogue', lensVersion: LENS_VERSIONS.dialogue } });
  });

  it('refuses a re-labelled lens, naming the lens the step is gauged by', () => {
    const r = admitCraftGauge(gauge({ catalogId: 'dialog-trees', lens: 'game-systems-code' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.join(' ')).toContain("'dialogue'");
  });

  it('refuses a lens version not in force', () => {
    const r = admitCraftGauge(gauge({ lens: 'game-systems-code', lensVersion: LENS_VERSIONS['game-systems-code'] + 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.join(' ')).toContain('not in force');
  });

  it('refuses a level above the medium roof, naming the ceiling and its source', () => {
    const r = admitCraftGauge(gauge({ step: '3D Mesh', aLevel: 'A3' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.join(' ')).toContain('A2');
      expect(r.error.join(' ')).toContain('craft-ceilings.json');
    }
  });

  it('[guard] existing writer shapes stay admitted', () => {
    // craft-verdicts-route.test BASE: items::Concept Brief under game-systems-code v1
    expect(admitCraftGauge(gauge({ lens: 'game-systems-code', lensVersion: 1 })).ok).toBe(true);
    // stepBinding.test: items::Stats has no audited step fact — the writer's lens is kept
    expect(admitCraftGauge(gauge({ step: 'Stats', lens: 'game-systems-code', lensVersion: 1 }))).toEqual({
      ok: true, data: { lens: 'game-systems-code', lensVersion: 1 },
    });
    // at the roof is still awardable
    expect(admitCraftGauge(gauge({ step: '3D Mesh', aLevel: 'A2' })).ok).toBe(true);
  });

  it('a step with no audited fact still has its version checked', () => {
    expect(admitCraftGauge(gauge({ step: 'Stats', lens: 'game-systems-code', lensVersion: 9 })).ok).toBe(false);
  });
});

describe('craftOf — read-side defence for stored gauges', () => {
  it('a lens version above the one in force projects A0, never current', () => {
    const c = craftOf({ verdict: { aLevel: 'A4', lensVersion: 2 }, currentLensVersion: 1, ceiling: 'A4' });
    expect(c.level).toBe('A0');
    expect(c.because).toContain('lens v2 is not in force (v1)');
  });

  it('a level above the recorded roof projects A0 — not at-ceiling achievement', () => {
    const c = craftOf({ verdict: { aLevel: 'A3', lensVersion: 1 }, currentLensVersion: 1, ceiling: 'A2' });
    expect(c.level).toBe('A0');
    expect(c.state).not.toBe('at-ceiling');
    expect(c.because).toContain("A3 is above this medium's recorded roof A2");
    expect(c.because).toContain('not awardable');
  });

  it('[guard] AT the roof is still at-ceiling achievement', () => {
    const c = craftOf({ verdict: { aLevel: 'A2', lensVersion: 1 }, currentLensVersion: 1, ceiling: 'A2' });
    expect(c).toMatchObject({ level: 'A2', state: 'at-ceiling' });
  });
});

describe('craftForCell — a gauge under the wrong lens never projects', () => {
  const row = (lens: string) => ({
    catalogId: 'dialog-trees', entityId: 'e1', step: 'Concept Brief', lens, aLevel: 'A4' as const, lensVersion: 1,
  });

  it('a dialog-trees text gauge stored under game-systems-code projects A0', () => {
    const cell = craftForCell('dialog-trees', 'Concept Brief', [row('game-systems-code')], new Map());
    expect(cell?.lens).toBe('dialogue');
    expect(cell?.craft.level).toBe('A0');
    expect(cell?.craft.because).toContain('game-systems-code');
  });

  it('[guard] the same gauge under the dialogue lens still projects A4 at-ceiling', () => {
    const cell = craftForCell('dialog-trees', 'Concept Brief', [row('dialogue')], new Map());
    expect(cell?.craft).toMatchObject({ level: 'A4', state: 'at-ceiling' });
  });
});
