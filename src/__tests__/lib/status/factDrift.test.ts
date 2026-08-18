import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { itemsAllStepLabels } from '@/components/layout-lab/catalogManifest';
import {
  factKey,
  headlessFactAddresses,
  orphanedFacts,
  stepFactAddresses,
  type FactAddress,
} from '@/lib/status/statusModel';
import { ceilingFactAddresses } from '@/lib/status/capabilityModel';
import { realizationAddresses } from '@/lib/preview/realization';

/**
 * AUDITED-FACT DRIFT — every audit must still point at a step that exists.
 *
 * Four JSONs decide how honest a /status cell is allowed to look, and ALL FOUR address a step
 * by `catalogId | step-LABEL`:
 *
 *   step-facts.json         → the audited true engine, judge class, generator wiring and
 *                             checker-meaningfulness. Losing it drops the step through to the
 *                             engine heuristic.
 *   headless-coverage.json  → whether a cell may grade `verified` at all (`gateHeadless`).
 *                             Losing it DEMOTES a green cell — the safe direction, but silently.
 *   ceiling-facts.json      → which cells are excluded from a capability median and which
 *                             classes are technique-capped. Losing one UN-caps a class.
 *   realization-facts.json  → the R5 SHIPPED rung. Losing one silently removes R5 eligibility.
 *
 * Labels are display strings authors reword freely, so a rename drops the audit with no error
 * and no warning: the map gets quieter and MORE confident at the same time. That is the one
 * failure mode a readiness instrument must not have, and until now nothing guarded three of
 * these four files (step-facts.json is also covered, bidirectionally, by
 * `src/__tests__/catalog/step-facts-derived.test.ts` — this file is the single place all four
 * are checked by the same rule).
 *
 * An orphan is REPORTED, never reattached: guessing which renamed step a stale audit meant
 * would fabricate provenance, which is strictly worse than losing it. The fix is a human
 * re-key of the JSON, or deleting the row.
 */

/** Every step address the app actually renders today. */
const LIVE: ReadonlySet<string> = (() => {
  const live = new Set<string>();
  for (const p of allCatalogPipelines()) for (const s of p.steps) live.add(factKey(p.catalogId, s.label));
  // `items` carries BOTH spec sets' labels (ITEMS_SPEC_DUALITY) — every one of them is live.
  for (const label of itemsAllStepLabels()) live.add(factKey('items', label));
  return live;
})();

function report(name: string, orphans: FactAddress[]): string {
  return `${name}: ${orphans.length} audited fact(s) no longer resolve to a registered step — `
    + `a step-label rename silently dropped the audit. Re-key or delete the row BY HAND `
    + `(never guess which step it meant):\n`
    + orphans.map((o) => `  ${o.catalogId} :: ${o.step}`).join('\n');
}

describe('audited-fact drift — every label-keyed audit still addresses a live step', () => {
  it('the live step universe is real (guard the guard)', () => {
    // If the registry failed to load, every fact would look orphaned and every assertion
    // below would be vacuous in the WRONG direction. Pin that we are comparing against a
    // populated universe.
    expect(LIVE.size).toBeGreaterThan(300);
  });

  it('step-facts.json — the engine / judge / checker audit', () => {
    const facts = stepFactAddresses();
    expect(facts.length).toBeGreaterThan(300);
    expect(orphanedFacts(facts, LIVE), report('step-facts.json', orphanedFacts(facts, LIVE))).toEqual([]);
  });

  it('headless-coverage.json — the gate on `verified`', () => {
    const facts = headlessFactAddresses();
    expect(facts.length).toBeGreaterThan(300);
    expect(orphanedFacts(facts, LIVE), report('headless-coverage.json', orphanedFacts(facts, LIVE))).toEqual([]);
  });

  it('ceiling-facts.json — the capability exclusions and technique caps', () => {
    const facts = ceilingFactAddresses();
    expect(facts.length).toBeGreaterThan(0);
    expect(orphanedFacts(facts, LIVE), report('ceiling-facts.json', orphanedFacts(facts, LIVE))).toEqual([]);
  });

  it('realization-facts.json — the R5 SHIPPED evidence', () => {
    const facts = realizationAddresses();
    expect(facts.length).toBeGreaterThan(0);
    expect(orphanedFacts(facts, LIVE), report('realization-facts.json', orphanedFacts(facts, LIVE))).toEqual([]);
  });

  it('detects a rename (the check is not vacuous)', () => {
    // The exact failure this guards: an audit whose step was reworded.
    const renamed: FactAddress[] = [
      { catalogId: 'items', step: 'Concept Brief' },
      { catalogId: 'items', step: 'Concept Brief (v2)' },
    ];
    const orphans = orphanedFacts(renamed, LIVE);
    expect(orphans).toEqual([{ catalogId: 'items', step: 'Concept Brief (v2)' }]);
    expect(report('x', orphans)).toContain('items :: Concept Brief (v2)');
  });
});
