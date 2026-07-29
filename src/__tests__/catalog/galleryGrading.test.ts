import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { allOfMembers } from '@/lib/catalog/acceptance/combinators';
import { gallerySeed, gradeGallerySelection, candidateAsset } from '@/lib/catalog/acceptance/galleryArtifact';
import { readHistory, selectedCandidate } from '@/components/layout-lab/steps/shared/genHistory';
import type { GenCandidate } from '@/components/layout-lab/steps/shared/genHistory';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * THE GALLERY GRADES THE ASSET.
 *
 * Every generative step in the fleet used to pass on the existence of an INTEGER: `selected()`
 * was `typeof v === 'number' && v >= 0`, and nothing else was examined. Measured over the LIVE
 * registry with the same two mutation probes `step-facts-derived.test.ts` uses (scale one
 * numeric leaf · replace every string with a same-length nonsense token), **44 of the 47
 * registered gallery steps were insensitive to any change in their own content** — `gallery`
 * was the second-worst archetype in the fleet.
 *
 * This file is the ratchet. It measures the same number and pins it at 0, and it pins the four
 * verdict rules the number comes from (see `acceptance/galleryArtifact.ts`).
 */

const ENTITY: LabEntity = { id: 'gal-probe', name: 'Gallery Probe', lifecycle: 'planned', data: {} };
type D = Record<string, unknown>;

const GALLERY = allCatalogPipelines().flatMap((p) =>
  p.steps.filter((s) => s.archetype === 'gallery').map((s) => ({ catalogId: p.catalogId, spec: s })),
);
const at = (g: (typeof GALLERY)[number]) => `${g.catalogId} · ${g.spec.label}`;
const stub = (g: (typeof GALLERY)[number]): D => ({ ...((g.spec.produce(ENTITY).data ?? {}) as D) });

/* ── the four verdict rules ──────────────────────────────────────────────── */

const REAL: GenCandidate = { id: 'b0-c0', swatch: 'linear-gradient(1deg, a, b)', caption: 'ember.png', imageUrl: '/api/visual-gen/icon/ember.png', payload: { selected: 0 } };
const SWATCH: GenCandidate = { id: 'b0-c0', swatch: 'linear-gradient(1deg, a, b)', caption: 'Variant 1', payload: { selected: 0 } };
const withCandidate = (c: GenCandidate, extra?: D): D => ({
  selected: 0,
  genHistory: { batches: [{ id: 'b0', at: '2026-01-01T00:00:00.000Z', direction: 'd', prompt: 'p', candidates: [c] }], selectedId: c.id },
  ...extra,
});

describe('gradeGallerySelection — the selected CANDIDATE is the verdict', () => {
  it('passes only when the selected candidate carries a REAL generated asset, and names it', () => {
    const r = gradeGallerySelection(withCandidate(REAL), 'selected', 'icon');
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L1');
    expect(r.detail).toContain('/api/visual-gen/icon/ember.png');
  });

  it('defers (L4) WITH A REASON on a deterministic swatch — never a manufactured pass', () => {
    const r = gradeGallerySelection(withCandidate(SWATCH), 'selected', 'icon');
    expect(r.status).toBe('deferred');
    expect(r.tier).toBe('L4'); // a missing visual asset is not locally fixable — Rule 5 + the walker's L3/L4 rule
    expect(r.reason).toContain('swatch');
  });

  it('counts the shapes a real asset is recorded in (mesh url, on-disk path, injected data-URL swatch)', () => {
    expect(candidateAsset({ ...SWATCH, payload: { glbUrl: '/api/visual-gen/asset/j.glb' } })).toContain('.glb');
    expect(candidateAsset({ ...SWATCH, payload: { assetPath: 'generated/icons/vfx_Icon.jpg' } })).toContain('vfx_Icon.jpg');
    // scripts/gap-loop/* injects a gated Leonardo render as `swatch: url(data:image/jpeg;base64,…)`.
    expect(candidateAsset({ ...SWATCH, swatch: 'url(data:image/jpeg;base64,AAAA)' })).toContain('data:image/jpeg');
    // …and the placeholder is always a computed gradient, so the two can never be confused.
    expect(candidateAsset(SWATCH)).toBeNull();
    // The detail line never carries a megabyte of base64.
    expect((candidateAsset({ ...SWATCH, swatch: `url(data:image/jpeg;base64,${'A'.repeat(5000)})` }) ?? '').length).toBeLessThan(120);
  });

  it('fails when the selection resolves to nothing, or to a candidate projecting another index', () => {
    const dangling = withCandidate(REAL);
    (dangling.genHistory as { selectedId: string }).selectedId = 'b9-c9';
    expect(gradeGallerySelection(dangling, 'selected', 'icon').status).toBe('fail');

    const mismatched = withCandidate(REAL, { selected: 3 });
    const r = gradeGallerySelection(mismatched, 'selected', 'icon');
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('not the selected candidate');
  });

  it('is pending with no selection, and deferred (not pass) when an index exists with no history', () => {
    expect(gradeGallerySelection({}, 'selected', 'icon').status).toBe('pending');
    const bare = gradeGallerySelection({ selected: 0 }, 'selected', 'icon');
    expect(bare.status).toBe('deferred');
    expect(bare.reason).toContain('no generation history');
  });
});

describe('gallerySeed — a produce stub writes the shape the lab writes', () => {
  it('seeds a kept batch of honest swatches and auto-selects one (never a fake asset)', () => {
    const d = gallerySeed('selected', 4);
    expect(d.selected).toBe(0);
    const h = readHistory(d);
    expect(h.batches[0].candidates).toHaveLength(4);
    expect(h.autoSelected).toBe(true); // the MACHINE picked it — the provenance strip must keep saying so
    expect(candidateAsset(selectedCandidate(h)!)).toBeNull();
    expect(gradeGallerySelection(d, 'selected', 'x').status).toBe('deferred');
  });

  it('is PURE — the same field/count always yields the same artifact (no Date.now in produce)', () => {
    expect(JSON.stringify(gallerySeed('mesh', 3))).toBe(JSON.stringify(gallerySeed('mesh', 3)));
  });

  it('honours an explicit selectIndex without claiming a human chose it', () => {
    const h = readHistory(gallerySeed('selected', 3, 2));
    expect(h.selectedId).toBe('b0-c2');
    expect(h.autoSelected).toBe(true);
  });
});

/* ── the fleet ratchet ───────────────────────────────────────────────────── */

function numericLeaves(v: unknown, path: (string | number)[] = [], depth = 0, out: (string | number)[][] = []) {
  if (depth > 5 || out.length > 60) return out;
  if (typeof v === 'number' && Number.isFinite(v)) { out.push(path); return out; }
  if (Array.isArray(v)) { v.forEach((x, i) => numericLeaves(x, [...path, i], depth + 1, out)); return out; }
  if (v != null && typeof v === 'object') for (const [k, x] of Object.entries(v as D)) numericLeaves(x, [...path, k], depth + 1, out);
  return out;
}

let token = 0;
function scrambleStrings(v: unknown, depth = 0): unknown {
  if (depth > 6) return v;
  if (typeof v === 'string') return `z${(token++).toString(36)}`.padEnd(v.length, 'z').slice(0, Math.max(v.length, 1));
  if (Array.isArray(v)) return v.map((x) => scrambleStrings(x, depth + 1));
  if (v != null && typeof v === 'object') return Object.fromEntries(Object.entries(v as D).map(([k, x]) => [k, scrambleStrings(x, depth + 1)]));
  return v;
}

/** The SAME two probes step-facts-derived.test.ts uses, so the number is comparable. */
function contentSensitive(accept: (d: D) => { status: string }, data: D): boolean {
  let clean: string;
  try { clean = accept(data).status; } catch { return true; }
  for (const p of numericLeaves(data)) {
    const copy = structuredClone(data);
    let cur = copy as Record<string | number, unknown>;
    for (const k of p.slice(0, -1)) cur = cur[k] as Record<string | number, unknown>;
    const leaf = p[p.length - 1];
    cur[leaf] = Number(cur[leaf]) * 2.7 + 13;
    try { if (accept(copy).status !== clean) return true; } catch { return true; }
  }
  try { return accept(scrambleStrings(data) as D).status !== clean; } catch { return true; }
}

describe('the gallery archetype is content-sensitive fleet-wide', () => {
  it('covers every registered gallery step', () => {
    expect(GALLERY.length).toBeGreaterThanOrEqual(47);
  });

  it('NO gallery step is shape-only (was 44 of 47 before the selected candidate was graded)', () => {
    const insensitive = GALLERY.filter((g) => !contentSensitive(g.spec.accept as unknown as (d: D) => { status: string }, stub(g))).map(at);
    expect(insensitive, `gallery steps a content mutation cannot move: ${insensitive.join(', ')}`).toEqual([]);
  });

  it('every gallery produce stub seeds a resolvable selection (Rule 5: terminal, never fail/pending)', () => {
    const bad: string[] = [];
    for (const g of GALLERY) {
      const r = g.spec.accept(stub(g));
      if (r.status !== 'pass' && r.status !== 'deferred') { bad.push(`${at(g)} → ${r.status}`); continue; }
      if (r.status === 'deferred') {
        if (!r.reason) bad.push(`${at(g)} → deferred with no reason (Rule 4)`);
        // The walker requires a deferred banner to name its L3/L4 gate.
        if (r.tier !== 'L3' && r.tier !== 'L4') bad.push(`${at(g)} → deferred at ${r.tier} (the walker wants L3/L4)`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the selection gate is composed LAST, so it can never mask a link / value / wiring failure', () => {
    // `allOf` reports the FIRST non-pass. A gallery step that defers on a swatch would hide a
    // genuinely FAILING sibling check (props' LOD ladder, linksResolve, wiringContractSound) if
    // it spoke first — so it must speak last.
    const bad: string[] = [];
    for (const g of GALLERY) {
      const members = allOfMembers(g.spec.accept);
      if (!members || members.length < 2) continue;
      const data = stub(g);
      const galleryIdx = members.findIndex((m) => {
        try { const r = m(data); return r.tier === 'L4' && (r.reason ?? '').includes('swatch'); } catch { return false; }
      });
      if (galleryIdx >= 0 && galleryIdx !== members.length - 1) {
        bad.push(`${at(g)}: selection gate is member ${galleryIdx + 1} of ${members.length} — move it last in the allOf(...)`);
      }
    }
    expect(bad).toEqual([]);
  });
});
