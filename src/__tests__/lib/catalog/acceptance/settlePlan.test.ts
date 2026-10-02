import { describe, it, expect, vi } from 'vitest';
import {
  planSettle,
  confirmDropsRefusal,
  stagedFs,
  createArtifactStage,
  SETTLE_ORDER,
} from '@/lib/catalog/acceptance/settlePlan';
import type { PackagingFsDeps } from '@/lib/catalog/packaging/packageArtifacts';

/**
 * The settle preview folds the three filesystem passes' own summaries (they share the
 * `{ catalogId, entityId, step, from, to, changed }` row) into ordered pass lines with lifts,
 * drops and the cause — so a silent pass → deferred downgrade becomes a named line BEFORE apply.
 */
const staticRow = (i: number) => ({
  catalogId: 'bestiary', entityId: `e${i}`, step: 'Stat Blocks', from: 'pass', to: 'deferred',
  reason: 'UE root not resolved', changed: true,
});

describe('planSettle', () => {
  it('orders the passes, counts the drops and names each cause (acceptance 1)', () => {
    const plan = planSettle({
      bindIcons: { library: 0, results: [] },
      static: { ueRoot: null, results: Array.from({ length: 8 }, (_, i) => staticRow(i)) },
      packaging: { results: [] },
    });
    expect(plan.passes.map((p) => p.pass)).toEqual(['bind-icons', 'verify-static', 'verify-packaging']);
    expect(SETTLE_ORDER).toEqual(['bind-icons', 'verify-static', 'verify-packaging']);
    expect(plan.passes[1]).toMatchObject({ lifts: 0, drops: 8, cause: 'UE root not resolved' });
    expect(plan.passes[0]).toMatchObject({ cause: 'icon library empty' });
    expect(plan.totals.drops).toBe(8);
    expect(plan.passes[1].moves).toEqual([{ label: 'pass → deferred', count: 8 }]);
  });

  it('counts a deferred → pass re-grade as a lift, and an unmoved row as neither', () => {
    const plan = planSettle({
      bindIcons: { library: 3, results: [
        { catalogId: 'b', entityId: 'e1', step: 'Icon', from: 'deferred', to: 'pass', detail: '/api/x', changed: true },
        { catalogId: 'b', entityId: 'e2', step: 'Icon', from: 'deferred', to: 'deferred', detail: 'no-history', changed: false },
      ] },
      static: { ueRoot: 'C:/ue', results: [] },
      packaging: { results: [{ catalogId: 'b', entityId: 'e1', step: 'UE Packaging', from: 'pass', to: 'deferred', reason: 'missing mesh', changed: true }] },
    });
    expect(plan.passes[0]).toMatchObject({ lifts: 1, drops: 0, cause: null });
    expect(plan.passes[1]).toMatchObject({ lifts: 0, drops: 0, cause: null });
    expect(plan.passes[2]).toMatchObject({ lifts: 0, drops: 1, cause: 'missing mesh' });
    expect(plan.totals).toMatchObject({ lifts: 1, drops: 1 });
  });

  it('names a packaging exemption instead of an empty pass', () => {
    const plan = planSettle({
      bindIcons: { library: 1, results: [] },
      static: { ueRoot: 'C:/ue', results: [] },
      packaging: { results: [], exempt: [{ catalogId: 'lore', reason: 'text only' }] },
    });
    expect(plan.passes[2].cause).toBe('exempt by declaration: text only');
  });
});

describe('confirmDropsRefusal — apply only what you previewed', () => {
  it('lets a drop-free settle through without a confirmation', () => {
    expect(confirmDropsRefusal(undefined, 0)).toBeNull();
  });
  it('refuses unconfirmed drops, naming the count', () => {
    expect(confirmDropsRefusal(undefined, 8)).toMatch(/\b8\b/);
  });
  it('refuses a stale confirmation, naming both numbers', () => {
    const msg = confirmDropsRefusal(3, 8) ?? '';
    expect(msg).toMatch(/\b3\b/);
    expect(msg).toMatch(/\b8\b/);
  });
  it('accepts the fresh count', () => {
    expect(confirmDropsRefusal(8, 8)).toBeNull();
  });
});

describe('stagedFs — the packaging preview never touches disk', () => {
  const writeFile = vi.fn();
  const mkdir = vi.fn();
  const base = (): PackagingFsDeps => ({
    exists: (p) => p === 'on-disk.png',
    readFile: () => Buffer.from('disk'),
    writeFile,
    mkdir,
    packagesRoot: 'generated/packages',
    now: () => 't',
    ueRoot: () => null,
  });

  it('keeps writes and dirs in memory and reads them back before disk', () => {
    const b = base();
    const fs = stagedFs(b);
    fs.mkdir('generated/packages/b/e1');
    fs.writeFile('generated/packages/b/e1/a.png', Buffer.from('mem'));
    expect(writeFile).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(fs.exists('generated/packages/b/e1/a.png')).toBe(true);
    expect(fs.readFile('generated/packages/b/e1/a.png').toString()).toBe('mem');
    expect(fs.exists('on-disk.png')).toBe(true);
    expect(fs.readFile('on-disk.png').toString()).toBe('disk');
    expect(fs.exists('nowhere.png')).toBe(false);
  });
});

describe('createArtifactStage — a later pass reads an earlier pass\'s staged write', () => {
  it('overlays staged status and data over the stored rows', () => {
    const stage = createArtifactStage();
    stage.save('b', 'e1', 'Icon', { status: 'pass', data: { bound: true } });
    const rows = stage.overlay([
      { catalogId: 'b', entityId: 'e1', step: 'Icon', status: 'deferred', data: {} },
      { catalogId: 'b', entityId: 'e2', step: 'Icon', status: 'deferred', data: {} },
    ]);
    expect(rows[0]).toMatchObject({ status: 'pass', data: { bound: true } });
    expect(rows[1]).toMatchObject({ status: 'deferred', data: {} });
    // A status-only write keeps the earlier staged data.
    stage.save('b', 'e1', 'Icon', { status: 'fail' });
    expect(stage.get('b', 'e1', 'Icon')).toMatchObject({ status: 'fail', data: { bound: true } });
  });
});
