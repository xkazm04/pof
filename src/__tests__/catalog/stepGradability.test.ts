import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Isolate from the user's real ~/.pof/pof.db — the route test below WRITES a row, and live
// judge_verdicts would otherwise be overlaid onto every grade. `vi.hoisted` runs before the
// import graph, so `src/lib/db.ts` picks the throwaway path up at init.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-step-gradability-${process.pid}.db`;
});
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { POST } from '@/app/api/pipeline-artifacts/route';
import { serverCheckerFor, hasRegisteredChecker, gradeArtifact } from '@/lib/catalog/headless';
import {
  stepGradability,
  bespokeCheckerFor,
  describeUngraded,
  UNGRADED_MARKER,
} from '@/lib/catalog/acceptance/stepGradability';
import { ITEMS_BESPOKE_CHECKERS } from '@/lib/catalog/acceptance/itemsBespokeCheckers';
import { itemsAllStepLabels } from '@/components/layout-lab/catalogManifest';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * EVERY PERSISTED STEP LABEL IS GRADABLE, OR SAYS WHY NOT — no third silent state.
 *
 * `gradeArtifact` returns `graded: false` when no server checker resolves for a
 * `(catalog, step)`, and the produce POST then keeps whatever status the PRODUCER wrote.
 * That is the one door the server re-grade exists to close, and it was ajar for the
 * project's own reference pipeline: measured against the real `~/.pof/pof.db` on
 * 2026-08-18, `items` held 90 rows across 18 distinct step labels, and 15 of those rows
 * carried one of the 7 labels the registered `items` pipeline never declares —
 * `Attributes` ×9, plus `3D Generation`, `Animations`, `Inventory UI Integration`,
 * `Material / Texture`, `SFX`, `VFX` ×1 each.
 *
 * These tests hold the fix in place from both directions: the known labels must resolve,
 * AND an unknown label must be REPORTED as ungraded rather than quietly trusted — so the
 * gap stays visible wherever it remains.
 */

/** The 7 bespoke Items labels that the registered pipeline does not declare. */
const BESPOKE_ITEMS_LABELS = [
  'Attributes',
  '3D Generation',
  'Material / Texture',
  'Animations',
  'VFX',
  'SFX',
  'Inventory UI Integration',
];

const E: LabEntity = { id: 'gradability-entity', name: 'Gradability Longsword', lifecycle: 'planned', data: {} };

describe('items — every persisted step label resolves to a server checker', () => {
  it('covers all 18 labels the two Items specs put in pipeline_artifacts', () => {
    const labels = itemsAllStepLabels();
    // The DB measurement: 18 distinct `items` step labels on 2026-08-18.
    expect(labels.length).toBe(18);
    const unresolved = labels.filter((l) => serverCheckerFor('items', l) === null);
    expect(unresolved).toEqual([]);
  });

  it('classifies each one as registered or bespoke — never `unknown`', () => {
    const byKind = { registered: [] as string[], bespoke: [] as string[], other: [] as string[] };
    for (const label of itemsAllStepLabels()) {
      const g = stepGradability('items', label, hasRegisteredChecker);
      if (g.kind === 'registered' || g.kind === 'bespoke') byKind[g.kind].push(label);
      else byKind.other.push(label);
    }
    expect(byKind.other).toEqual([]);
    expect(byKind.bespoke.sort()).toEqual([...BESPOKE_ITEMS_LABELS].sort());
    expect(byKind.registered.length).toBe(11);
  });

  it('resolves the bespoke labels through the bespoke registry, not the pipeline', () => {
    for (const label of BESPOKE_ITEMS_LABELS) {
      expect(hasRegisteredChecker('items', label)).toBe(false);
      expect(bespokeCheckerFor('items', label)).not.toBeNull();
    }
  });

  it('grades a bespoke step\'s real Produce output to `pass` on the server', () => {
    for (const label of BESPOKE_ITEMS_LABELS) {
      const data = (ITEM_STEP_SPECS[label].produce(E).data ?? {}) as Record<string, unknown>;
      const g = gradeArtifact('items', label, data);
      expect(g.graded, label).toBe(true);
      expect(g.raw?.status, label).toBe('pass');
    }
  });

  it('grades an EMPTY artifact to a non-pass with a reason — a producer cannot fabricate one', () => {
    for (const label of BESPOKE_ITEMS_LABELS) {
      const g = gradeArtifact('items', label, {});
      expect(g.graded, label).toBe(true);
      expect(g.raw?.status, label).not.toBe('pass');
      expect(g.raw?.reason, label).toBeTruthy();
    }
  });

  // The on-screen banner and the server re-grade must be the SAME function, or the lab
  // and the DB disagree again — which is how the divergence this fixes arose.
  it('agrees byte-for-byte with the on-screen bespoke Acceptance', () => {
    for (const label of BESPOKE_ITEMS_LABELS) {
      for (const data of [(ITEM_STEP_SPECS[label].produce(E).data ?? {}) as Record<string, unknown>, {}]) {
        const ui = ITEM_STEP_SPECS[label].accept(data);
        const server = ITEMS_BESPOKE_CHECKERS[label](data);
        expect({ label, status: ui.status, detail: ui.detail })
          .toEqual({ label, status: server.status, detail: server.detail });
      }
    }
  });
});

describe('an ungradable row is REPORTED, never trusted', () => {
  const UNKNOWN = { catalogId: 'items', step: '___no_such_items_step___' };

  it('reports `graded: false` rather than accepting the producer verdict', () => {
    const g = gradeArtifact(UNKNOWN.catalogId, UNKNOWN.step, { anything: true });
    expect(g.graded).toBe(false);
    expect(g.raw).toBeNull();
    expect(g.result).toBeNull();
  });

  it('classifies it `unknown` — the finding, not a silent fourth state', () => {
    expect(stepGradability(UNKNOWN.catalogId, UNKNOWN.step, hasRegisteredChecker))
      .toEqual({ kind: 'unknown' });
  });

  it('stamps a loud UNGRADED reason naming the catalog and the step', () => {
    const reason = describeUngraded(UNKNOWN.catalogId, UNKNOWN.step, hasRegisteredChecker);
    expect(reason.startsWith(UNGRADED_MARKER)).toBe(true);
    expect(reason).toContain(UNKNOWN.step);
    expect(reason).toContain(UNKNOWN.catalogId);
    expect(reason).toContain('has not been verified by the server');
  });

  it('preserves the producer\'s own reason alongside the stamp, never in place of it', () => {
    const reason = describeUngraded(UNKNOWN.catalogId, UNKNOWN.step, hasRegisteredChecker, 'producer says fine');
    expect(reason.startsWith(UNGRADED_MARKER)).toBe(true);
    expect(reason).toContain('producer says fine');
  });

  it('gives the synthetic loot-filter catalog an EXPLICIT unservable reason', () => {
    const g = stepGradability('loot-filter', 'datatable', hasRegisteredChecker);
    expect(g.kind).toBe('unservable');
    if (g.kind === 'unservable') expect(g.reason.length).toBeGreaterThan(40);
    // …and its synthetic per-run ids inherit it rather than reading as an unknown gap.
    expect(stepGradability('loot-filter-synthetic-shiploop-test', 'Generate', hasRegisteredChecker).kind)
      .toBe('unservable');
    // Still ungraded — an explained limitation is not a licence to trust the producer.
    expect(gradeArtifact('loot-filter-synthetic-shiploop-test', 'Generate', {}).graded).toBe(false);
    expect(describeUngraded('loot-filter', 'datatable', hasRegisteredChecker).startsWith(UNGRADED_MARKER))
      .toBe(true);
  });
});

describe('the produce POST stamps an ungradable row as UNGRADED', () => {
  function post(body: Record<string, unknown>) {
    return POST(new NextRequest('http://localhost/api/pipeline-artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  // The producer's status is preserved (there is nothing truer to replace it with) — but the
  // ROW now says the server never verified it. A silently-kept producer `pass` is exactly the
  // fabricated-pass hole the re-grade closed, so the annotation is the point.
  it('keeps the producer status but records that nothing graded it', async () => {
    const res = await post({
      catalogId: 'loot-filter-synthetic-gradability-test', entityId: 'e1', step: 'datatable',
      data: {}, ueAssets: [], status: 'pass', tier: 'L1', reason: 'produced locally',
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pass'); // preserved — the server cannot re-derive it
    expect(String(body.data.reason).startsWith(UNGRADED_MARKER)).toBe(true);
    expect(body.data.reason).toContain('synthetic catalog'); // the explicit unservable reason
    expect(body.data.reason).toContain('produced locally'); // ...and the producer's own words
  });

  it('does NOT stamp a row the server actually graded', async () => {
    const label = 'Attributes'; // bespoke, now server-gradable
    const data = (ITEM_STEP_SPECS[label].produce(E).data ?? {}) as Record<string, unknown>;
    const res = await post({
      catalogId: 'items', entityId: 'item-1', step: label,
      data, ueAssets: [], status: 'fail', tier: 'L4', reason: 'a lie the server must discard',
    });
    const body = await res.json();
    expect(body.data.status).toBe('pass');           // re-graded, caller's `fail` discarded
    expect(body.data.tier).toBe('L0');               // and the caller's inflated tier with it
    expect(String(body.data.reason ?? '')).not.toContain(UNGRADED_MARKER);
  });
});
