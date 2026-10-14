/**
 * The craft coverage channel — a defect the auditor sees that no lens criterion covers.
 * Pure roll-up + the route seam (throwaway DB). The invariant under test is the technique's
 * second half: the channel is addressed to the rubric author and NEVER moves the grade.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-craft-coverage-${process.pid}.db`;
});
import { GET, POST } from '@/app/api/craft-verdicts/route';
import { listCraftVerdicts } from '@/lib/craft/craft-verdicts-db';
import { LENS_IDS } from '@/lib/craft/lens-map';
import { LENS_VERSIONS } from '@/lib/craft/lens-versions';
import { dedupeGaps, summarizeCoverageGaps, type CoverageGapRow } from '@/lib/craft/coverage-gaps';

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/craft-verdicts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
const get = (qs: string) => GET(new NextRequest(`http://localhost/api/craft-verdicts?${qs}`));

const finding = { criterion: 'any-criterion', detail: 'a criterion-bound finding with detail', class: 'content' as const };
const STEP_LENSES = LENS_IDS.filter((l) => l !== 'production-process');
// A step with no audited fact keeps the writer's lens (same shape craft-admission.test relies on).
const cell = (lens: (typeof LENS_IDS)[number]) => ({
  catalogId: 'items', entityId: `e-${lens}`, step: `NoFact-${lens}`,
  lens, lensVersion: LENS_VERSIONS[lens], model: 'opus-test', aLevel: 'A2' as const, findings: [finding],
});

describe('coverage gap roll-up (pure)', () => {
  it('drops blanks and within-gauge repeats, keeps first wording', () => {
    expect(dedupeGaps([{ detail: ' Camera shake  hides the telegraph ' }, { detail: 'camera shake hides the telegraph' }, { detail: '   ' }]))
      .toEqual([{ detail: 'Camera shake  hides the telegraph' }]);
  });

  it('counts cells, not rows, and names the remark — no percentage', () => {
    const row = (entityId: string, detail: string): CoverageGapRow => ({
      catalogId: 'c', entityId, step: 's', lens: 'vfx', lensVersion: 1, model: 'm', detail,
    });
    const out = summarizeCoverageGaps([
      row('a', 'no recovery state is described'), row('a', 'No recovery state is described'),
      row('b', 'no recovery state is described'), row('c', 'idle loop is never specified'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ lens: 'vfx', cells: 3 });
    expect(out[0].gaps[0]).toEqual({ detail: 'no recovery state is described', cells: 2 });
    expect(JSON.stringify(out)).not.toMatch(/percent|ratio|%/);
  });
});

describe('POST /api/craft-verdicts — coverageGaps', () => {
  it('[target] stores a visible-but-uncovered defect for every lens, surfaced per lens to the author', async () => {
    for (const lens of STEP_LENSES) {
      const res = await POST(post({ ...cell(lens), coverageGaps: [{ detail: `${lens}: a defect no criterion can express` }] }));
      expect(((await res.json()) as { success: boolean }).success).toBe(true);
    }
    const json = (await (await get('coverageGaps=1')).json()) as {
      data: { gaps: unknown[]; byLens: { lens: string; cells: number }[] };
    };
    expect(json.data.gaps).toHaveLength(STEP_LENSES.length);
    expect(json.data.byLens.map((b) => b.lens).sort()).toEqual([...STEP_LENSES].sort());
  });

  it('[floor] the channel never moves the level, the findings or the stored gauge', async () => {
    const withGaps = { ...cell('vfx'), entityId: 'with', coverageGaps: [{ detail: 'a fatal-looking defect in an uncovered dimension' }] };
    const without = { ...cell('vfx'), entityId: 'without' };
    await POST(post(withGaps));
    await POST(post(without));
    const rows = listCraftVerdicts('items');
    const a = rows.find((r) => r.entityId === 'with')!;
    const b = rows.find((r) => r.entityId === 'without')!;
    expect(a.aLevel).toBe(b.aLevel);
    expect(a.findings).toEqual(b.findings);
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });

  it('a re-gauge replaces the cell’s remarks; one that reports none clears them', async () => {
    const base = { ...cell('audio'), entityId: 'regauge' };
    await POST(post({ ...base, coverageGaps: [{ detail: 'first remark about the mix' }, { detail: 'second remark about the mix' }] }));
    const count = async () =>
      ((await (await get('coverageGaps=1&catalogId=items')).json()) as { data: { gaps: { entityId: string }[] } })
        .data.gaps.filter((g) => g.entityId === 'regauge').length;
    expect(await count()).toBe(2);
    await POST(post({ ...base, coverageGaps: [{ detail: 'only this remark remains seen' }] }));
    expect(await count()).toBe(1);
    await POST(post(base));
    expect(await count()).toBe(0);
  });

  it('refuses a remark too thin to audit and a flood of remarks', async () => {
    const thin = await POST(post({ ...cell('vfx'), entityId: 'thin', coverageGaps: [{ detail: 'bad' }] }));
    expect(((await thin.json()) as { success: boolean }).success).toBe(false);
    const flood = await POST(post({ ...cell('vfx'), entityId: 'flood', coverageGaps: Array.from({ length: 11 }, (_, i) => ({ detail: `remark number ${i} of many` })) }));
    expect(((await flood.json()) as { success: boolean }).success).toBe(false);
  });
});
