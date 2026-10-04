import { describe, it, expect } from 'vitest';
import { buildOrreryModel } from '@/lib/story/orrery/model';
import { FIXTURES_AVAILABLE, loadGraph } from './_fixtures';

/** Acceptance 3: the whole model, audit included, at 10,739 nodes. */
const SCALE_BUDGET_MS = 400;

describe.skipIf(!FIXTURES_AVAILABLE)('buildOrreryModel — the three staged documents', () => {
  it('builds the hierarchical wheel for a document that declares no axis', () => {
    const model = buildOrreryModel(loadGraph('pof-exemplars'), 'pof');
    // No `profile.axis` -> no dial, and the containment sunburst is what gets laid out.
    expect(model.flat).toBeNull();
    const root = model.R.findIndex((n) => n.docks !== null);
    expect(root).toBeGreaterThanOrEqual(0);
    expect(model.R[root].u0).toBe(0);
    expect(model.R[root].u1).toBe(1);
    expect(model.order.length).toBeGreaterThan(0);
    expect(model.can(root)).toBe(true);
  });

  it('builds the lane x axis dial for a document that declares an axis and lanes', () => {
    const model = buildOrreryModel(loadGraph('mage-arena-season'), 'mage');
    const flat = model.flat;
    expect(flat).not.toBeNull();
    if (!flat) return;
    // The 'ending' lane holds nothing but endings, which dock at the hub: five tracks, not six.
    expect(flat.lanes).toEqual(['main', 'knowledge', 'arena', 'danger', 'villain']);
    expect(flat.outer).toBe(flat.Rh + 18 + flat.lanes.length * flat.TH);
    expect(flat.RR).toBe(flat.outer);
    expect(flat.dayA).toBeCloseTo(flat.a0 + flat.per * 42, 10);
    // Every ending docks, and nothing that docks is on a track.
    expect(model.dockEnds.length).toBe(6);
    for (const i of model.dockEnds) {
      expect(flat.items.has(i)).toBe(false);
      const pos = model.dockPos.get(i);
      expect(pos?.rad).toBe(0.6); // six endings: a ring inside the dial's hub
      expect(pos?.size).toBeGreaterThan(0);
      expect(pos?.size).toBeLessThanOrEqual(0.17);
      expect(Number.isFinite(pos?.a)).toBe(true);
      expect(model.can(i)).toBe(false);
    }
    // Every dial item sits inside the dial, spans forward, and names a real track and sub-row.
    for (const [i, item] of flat.items) {
      expect(item.u).toBeGreaterThanOrEqual(0);
      expect(item.u).toBeLessThan(1);
      expect(item.u1).toBeGreaterThan(item.u);
      expect(item.u1).toBeLessThanOrEqual(1);
      expect(item.lane).toBeGreaterThanOrEqual(0);
      expect(item.lane).toBeLessThan(flat.lanes.length);
      expect(item.rows).toBeGreaterThanOrEqual(1);
      expect(item.row).toBeGreaterThanOrEqual(0);
      expect(item.row).toBeLessThan(item.rows);
      expect(model.R[i].axis).not.toBeNull();
    }
    // The season's one container holds beats across several days, so its arc is wider than a tick.
    const spans = [...flat.items].filter(([i]) => model.R[i].kids.length > 0);
    expect(spans.length).toBeGreaterThan(0);
    for (const [, item] of spans) expect(item.u1 - item.u).toBeGreaterThan(1 / 42 + 1e-9);
    // A choice that shares its day with another gets its own rim slot or none at all.
    for (const [i, item] of flat.items) {
      if (item.slots === undefined) continue;
      expect(item.slot).toBeGreaterThanOrEqual(0);
      expect(item.slot).toBeLessThan(item.slots);
      expect(model.R[i].ch !== null || model.R[i].nChoice > 0).toBe(true);
    }
  });

  it('builds the scale document and honours its honesty flags', () => {
    const model = buildOrreryModel(loadGraph('synthetic-scale'), 'synthetic');
    expect(model.R.length).toBe(10739 + 1);
    // An axis is declared but only two lanes are: not enough tracks to be worth a dial.
    expect(model.flat).toBeNull();
    expect(model.cohorts).toEqual(['completionist', 'speedrunner', 'diplomat', 'brawler']);
    // No run pins a graphHash -> unverified; the source note says GENERATED -> generated.
    expect(model.prov.unverified).toBe(true);
    expect(model.prov.generated).toBe(true);
    expect(model.prov.provisional).toBe(false);
    expect(model.prov.runs.length).toBe(1);
  });

  it('reads provisional off the document, never assumes it', () => {
    const mage = buildOrreryModel(loadGraph('mage-arena-season'), 'mage');
    expect(mage.prov.provisional).toBe(true); // run.provisional AND source.reachProvisional
    expect(mage.prov.generated).toBe(false); // transcribed, not generated
    const pof = buildOrreryModel(loadGraph('pof-exemplars'), 'pof');
    expect(pof.prov.provisional).toBe(false);
    expect(pof.prov.runs.length).toBe(0);
    expect(pof.prov.unverified).toBe(true); // no runs at all pins no graph version
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('buildOrreryModel — determinism', () => {
  it('lays the same document out identically twice', () => {
    const raw = loadGraph('synthetic-scale');
    const a = buildOrreryModel(raw, 'synthetic');
    const b = buildOrreryModel(raw, 'synthetic');
    const layoutOf = (m: typeof a) => m.R.map((n) => [n.u0, n.u1, n.depth, n.w]);
    expect(layoutOf(b)).toEqual(layoutOf(a));
    // Derived reach is part of the layout's honesty, so it has to be stable too.
    const reachOf = (m: typeof a) => m.R.map((n) => [n.reachMeasured, n.reachMean]);
    expect(reachOf(b)).toEqual(reachOf(a));
    // The derivations that feed the surface are stable too.
    expect(b.order).toEqual(a.order);
    expect(b.topDecisions).toEqual(a.topDecisions);
    expect(b.spreadRef).toBe(a.spreadRef);
    expect(b.auditTotal).toBe(a.auditTotal);
    // Every finding, in the same order, with the same text: the audit is part of the layout.
    expect(JSON.stringify(b.audit)).toBe(JSON.stringify(a.audit));
  });

  it('packs the dial identically twice, down to the sub-rows', () => {
    const raw = loadGraph('mage-arena-season');
    const a = buildOrreryModel(raw, 'mage');
    const b = buildOrreryModel(raw, 'mage');
    expect(JSON.stringify([...(b.flat?.items ?? [])])).toBe(JSON.stringify([...(a.flat?.items ?? [])]));
    expect(JSON.stringify([...b.dockPos])).toBe(JSON.stringify([...a.dockPos]));
  });

  it('is unchanged by a second document being built in between', () => {
    const raw = loadGraph('pof-exemplars');
    const a = buildOrreryModel(raw, 'pof');
    const snapshot = a.R.map((n) => [n.u0, n.u1, n.depth, n.w]);
    buildOrreryModel(loadGraph('mage-arena-season'), 'mage');
    const c = buildOrreryModel(raw, 'pof');
    expect(c.R.map((n) => [n.u0, n.u1, n.depth, n.w])).toEqual(snapshot);
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('buildOrreryModel — the sunburst invariants', () => {
  it('gives every sibling ring an exact partition of its parent span', () => {
    const model = buildOrreryModel(loadGraph('synthetic-scale'), 'synthetic');
    const R = model.R;
    for (const i of model.order) {
      const n = R[i];
      if (n.kids.length === 0) continue;
      expect(R[n.kids[0]].u0).toBe(n.u0);
      expect(R[n.kids[n.kids.length - 1]].u1).toBe(n.u1);
      for (let q = 1; q < n.kids.length; q++) {
        // No gap and no overlap at a seam: one child's end is the next one's start.
        expect(R[n.kids[q]].u0).toBe(R[n.kids[q - 1]].u1);
        expect(R[n.kids[q]].sib).toBe(q);
      }
      expect(R[i].depth + 1).toBe(R[n.kids[0]].depth);
    }
  });

  it('counts a subtree census that sums to the document', () => {
    const model = buildOrreryModel(loadGraph('pof-exemplars'), 'pof');
    const root = model.R.findIndex((n) => n.docks !== null);
    const cnt = model.R[root].cnt;
    expect(cnt).not.toBeNull();
    // The root's census covers everything it contains; its docks are counted separately.
    expect(cnt?.nodes).toBe(model.R[root].w);
    expect(cnt?.nodes).toBeGreaterThan(1);
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('buildOrreryModel — reach is never coerced to zero', () => {
  it('leaves every unmeasured node null, not {} and not zeros', () => {
    const raw = loadGraph('synthetic-scale');
    const model = buildOrreryModel(raw, 'synthetic');
    const measured = new Set(Object.keys(raw.evidence?.reach ?? {}));
    let nullCount = 0;
    let measuredCount = 0;
    let measuredZero = 0;
    for (let i = 0; i < raw.nodes.length; i++) {
      const n = model.R[i];
      if (measured.has(n.id)) {
        expect(n.reach).not.toBeNull();
        expect(Object.keys(n.reach ?? {}).length).toBe(model.cohorts.length);
        measuredCount++;
        if (Object.values(n.reach ?? {}).some((v) => v === 0)) measuredZero++;
      } else {
        expect(n.reach).toBeNull();
        nullCount++;
      }
    }
    expect(measuredCount).toBe(measured.size);
    expect(nullCount).toBe(raw.nodes.length - measured.size);
    expect(nullCount).toBeGreaterThan(0);
    // The distinction has to be usable: unmeasured is null, a measured zero is a number.
    expect(measuredZero).toBeGreaterThan(0);
  });

  it('leaves every node null when the document carries no evidence at all', () => {
    const model = buildOrreryModel(loadGraph('pof-exemplars'), 'pof');
    for (const n of model.R) {
      expect(n.reach).toBeNull();
      expect(n.reachMean).toBeNull();
      expect(n.reachMeasured).toBe(0);
    }
  });

  it('keeps unmeasured, measured-zero and derived apart — the honesty rule of this port', () => {
    const raw = loadGraph('synthetic-scale');
    const model = buildOrreryModel(raw, 'synthetic');
    const measured = new Set(Object.keys(raw.evidence?.reach ?? {}));

    // 1. UNMEASURED: no row of its own and nothing measured below it. Both null, never zeros.
    const unmeasured = model.R.find(
      (n) => !measured.has(n.id) && n.reachMeasured === 0 && n.kids.length === 0,
    );
    expect(unmeasured).toBeDefined();
    expect(unmeasured?.reach).toBeNull();
    expect(unmeasured?.reachMean).toBeNull();

    // 2. MEASURED ZERO: a real row that holds a 0. A number, not an absence.
    const measuredZero = model.R.find(
      (n) => n.reach !== null && Object.values(n.reach).some((v) => v === 0),
    );
    expect(measuredZero).toBeDefined();
    expect(Object.values(measuredZero?.reach ?? {}).includes(0)).toBe(true);

    // 3. DERIVED: a container with no row of its own, averaging the descendants that do have one.
    const derived = model.R.find(
      (n) => n.reach === null && n.reachMean !== null && n.kids.length > 0,
    );
    expect(derived).toBeDefined();
    expect(derived?.reachMeasured).toBeGreaterThan(0);
    expect(Object.keys(derived?.reachMean ?? {})).toEqual(model.cohorts);

    // The three states are distinguishable by the pair alone, which is what the surface reads.
    const stateOf = (n: typeof model.R[number]) =>
      n.reach !== null ? 'measured' : n.reachMean !== null ? 'derived' : 'unmeasured';
    expect(stateOf(unmeasured as typeof model.R[number])).toBe('unmeasured');
    expect(stateOf(measuredZero as typeof model.R[number])).toBe('measured');
    expect(stateOf(derived as typeof model.R[number])).toBe('derived');

    // A derived mean is an average of real numbers only: it can never be dragged to 0 by a
    // sibling nobody measured, so it stays inside the range of what was measured below.
    const kidsMeasured = (n: typeof model.R[number]) => {
      const vals: number[] = [];
      const st = [...n.kids];
      while (st.length) {
        const k = st.pop() as number;
        const row = model.R[k].reach;
        if (row) vals.push(...Object.values(row));
        for (const c of model.R[k].kids) st.push(c);
      }
      return vals;
    };
    const vals = kidsMeasured(derived as typeof model.R[number]);
    const mean = Object.values(derived?.reachMean ?? {});
    expect(Math.min(...mean)).toBeGreaterThanOrEqual(Math.min(...vals) - 1e-9);
    expect(Math.max(...mean)).toBeLessThanOrEqual(Math.max(...vals) + 1e-9);

    // The root's count is every measured row in the document, since every node hangs off it.
    const root = model.R.find((n) => n.docks !== null);
    expect(root?.reachMeasured).toBeGreaterThan(0);
    expect(root?.reachMeasured).toBeLessThanOrEqual(measured.size);
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('buildOrreryModel — scale', () => {
  it(`builds 10,739 nodes in under ${SCALE_BUDGET_MS} ms`, () => {
    const raw = loadGraph('synthetic-scale'); // parse is not part of the measurement
    const t0 = performance.now();
    const model = buildOrreryModel(raw, 'synthetic');
    const ms = performance.now() - t0;
    expect(model.auditTotal).toBeGreaterThan(0);
    // console.error is the lint-allowed channel; the measured number is the point of this test.
    console.error(`[orrery] buildOrreryModel(synthetic-scale, 10739 nodes) = ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(SCALE_BUDGET_MS);
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('buildOrreryModel — choice classes', () => {
  it('separates what a decision is for, and never calls a read set empty by default', () => {
    const model = buildOrreryModel(loadGraph('synthetic-scale'), 'synthetic');
    const byClass = new Map<string, number>();
    for (const n of model.R) {
      if (!n.ch) continue;
      byClass.set(n.ch.cls, (byClass.get(n.ch.cls) ?? 0) + 1);
    }
    // The document writes standing.* (read by endings), renown (read by a guard and an ending)
    // and trust.* (written 4,800 times and read by nothing) — so every class has to appear.
    expect(byClass.get('ending-shaping')).toBeGreaterThan(0);
    expect(byClass.get('routing')).toBeGreaterThan(0);
    expect(byClass.get('false')).toBe(5);
    expect(byClass.get('single')).toBeGreaterThan(0);
    // A spread is a share of a domain width, so it is comparable across variables.
    for (const n of model.R) {
      if (!n.ch) continue;
      expect(n.ch.spread).toBeGreaterThanOrEqual(0);
      expect(n.ch.wiredCount).toBeGreaterThan(0);
      expect(n.ch.optionCount).toBeGreaterThanOrEqual(1);
      if (n.ch.cls === 'single') expect(n.ch.wiredCount).toBeLessThan(2);
      if (n.ch.cls === 'false') {
        expect(n.ch.diverges).toBe(false);
        expect(n.ch.spread).toBe(0);
      }
    }
    // The impact rim's reference is a percentile, not the maximum.
    expect(model.spreadRef).toBeGreaterThan(0);
    expect(model.topDecisions.length).toBe(12);
    for (const i of model.topDecisions) {
      const ch = model.R[i].ch;
      expect(ch?.cls === 'false' || ch?.cls === 'single').toBe(false);
    }
  });
});
