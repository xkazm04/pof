import { describe, it, expect, vi } from 'vitest';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getStepComponent } from '@/components/layout-lab/steps';
import { resolveAccept } from '@/components/layout-lab/labAcceptance';
import { ITEM_STEP_NAMES, ITEM_STEP_SPECS, deriveGateChecks } from '@/components/layout-lab/steps/itemsSteps';
import { serverCheckerFor } from '@/lib/catalog/headless';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * The Items Test Gate is the step that GATES THE WHOLE ITEM.
 *
 * Until 2026-09-29 the lab rendered it through the bespoke `ItemTestGate`, whose derived "Checks"
 * panel read each sibling's RESOLVED verdict (checker → drain → judge) via `deriveGateChecks` +
 * `CheckerContext.siblingVerdict` — while the server, /status and the headless drains graded the
 * same label with the REGISTERED `entityRuntimeDeferred` L3 gate. One row, two graders: 9 live
 * Test Gate rows the server held `deferred L3` read `pending` in the lab, whose banner told the
 * operator to "Run Produce", which overwrote the real fixture with the exemplar stub.
 *
 * 'Test Gate' is now REGISTRY-owned (`itemsLabelOwner`): it renders through ArchetypeStep and grades
 * exactly as the server does. CAPABILITY LOSS, stated: the bespoke per-check sibling breakdown is
 * no longer on screen. `deriveGateChecks` stays (pure, pinned below) for the unrouted component
 * and for a future registered gate that derives from siblings.
 */

const entity: LabEntity = { id: 'gate-layers-1', name: 'Iron Longsword', lifecycle: 'planned', data: {} };

describe('the Items Test Gate has ONE grader — the registered one', () => {
  it('no bespoke component renders it; the lab grades it like the server (deferred L3)', () => {
    expect(getStepComponent('items', 'Test Gate')).toBeNull();
    const row = { testGate: { test: 'VSItemsDefinitionsTest', acceptanceTier: 'L3' } };
    const ctx: CheckerContext = { catalog: 'items', siblings: {}, has: () => true };
    const lab = resolveAccept('items', 'Test Gate')!(row, ctx);
    expect(lab.status).toBe('deferred');
    expect(lab.tier).toBe('L3');
    expect(lab.status).toBe(serverCheckerFor('items', 'Test Gate')!(row, ctx).status);
  });

  it('deriveGateChecks stays PURE — with no resolver it falls back to the sibling checker', () => {
    const siblings: Record<string, Record<string, unknown>> = {};
    for (const step of ITEM_STEP_NAMES) {
      siblings[step] = (ITEM_STEP_SPECS[step].produce(entity).data ?? {}) as Record<string, unknown>;
    }
    const noResolver = deriveGateChecks(siblings);
    const visual = noResolver.find((r) => r.name === 'Visual QA (icon + mesh)')!;
    expect(visual.blockers.every((b) => b.layer === 'checker')).toBe(true);

    // …and an injected resolver is what moves it, with no store involved at all.
    const injected = deriveGateChecks(siblings, (s) => (s === 'Attributes' ? { status: 'fail', source: 'judge' } : undefined));
    const stats = injected.find((r) => r.name === 'Stat/rules unit test')!;
    expect(stats.ok).toBe(false);
    expect(stats.blockedBy).toContain('Attributes (fail · judge)');
  });
});
