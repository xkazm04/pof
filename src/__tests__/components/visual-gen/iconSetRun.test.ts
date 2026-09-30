/**
 * runIconSet — the ONE paid step of icon-set mode. Every request goes to a stub: nothing here
 * reaches the contact-sheet route, a provider or the disk.
 *
 * It posts one body per planned sheet, in plan order, and classifies each answer from the
 * envelope the route promises: cut icons, an UNCUT sheet whose url and gate reasons survive the
 * 502, a 400 refusal, or any other failure. One sheet's failure never stops the next.
 */
import { describe, it, expect, vi } from 'vitest';
import { runIconSet } from '@/components/modules/visual-gen/asset-forge/iconSetRun';
import type { IconSetPlan } from '@/lib/visual-gen/icon-set-plan';

const PLAN: IconSetPlan = {
  catalogId: 'bestiary',
  step: 'Concept 2D Art',
  covered: ['a'],
  missing: ['c', 'd', 'e', 'f'],
  sheets: [
    { cols: 2, rows: 1, squareCells: false, canonProfile: 'diablo1', cast: [{ entityId: 'c', brief: 'C' }, { entityId: 'd', brief: 'D' }] },
    { cols: 1, rows: 1, squareCells: true, cast: [{ entityId: 'e', brief: 'E' }] },
    { cols: 1, rows: 1, squareCells: true, cast: [{ entityId: 'f', brief: 'F' }] },
    { cols: 1, rows: 1, squareCells: true, cast: [{ entityId: 'g', brief: 'G' }] },
  ],
  generations: 4,
  perEntityCalls: 5,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch() {
  const answers = [
    () => json(200, {
      success: true,
      data: {
        ok: true, sheetUrl: '/api/visual-gen/image/s1.png', verdict: { sliceable: true, reasons: [] },
        icons: [
          { entityId: 'c', file: 'bestiary__c__concept_2d_art.png', url: '/api/visual-gen/icon/bestiary__c__concept_2d_art.png' },
          { entityId: 'd', file: 'bestiary__d__concept_2d_art.png', url: '/api/visual-gen/icon/bestiary__d__concept_2d_art.png' },
        ],
        styleDnaApplied: 'Diablo I — shipped style', styleDnaWithheld: null, styleDnaDropped: [],
      },
    }),
    () => json(502, {
      success: false,
      error: 'the sheet was generated but not cut: cell 0 is flat',
      details: { sheetUrl: '/api/visual-gen/image/s2.png', verdict: { sliceable: false, reasons: ['cell 0 is flat'] } },
    }),
    () => json(400, { success: false, error: 'cast does not fill the grid: 1x1 needs 1 subjects, got 0' }),
    () => { throw new TypeError('network down'); },
  ];
  let i = 0;
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => answers[i++]());
  return fn;
}

const bodies = (fn: ReturnType<typeof stubFetch>) =>
  fn.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)) as Record<string, unknown>);

describe('runIconSet — one POST per sheet, typed outcomes', () => {
  it('case 5: posts each sheet in plan order and returns cut / uncut / refused / failed without stopping', async () => {
    const fn = stubFetch();
    const out = await runIconSet(PLAN, fn as unknown as typeof fetch);

    expect(fn).toHaveBeenCalledTimes(4);
    for (const c of fn.mock.calls) {
      expect(c[0]).toBe('/api/visual-gen/contact-sheet');
      expect((c[1] as RequestInit).method).toBe('POST');
    }
    const sent = bodies(fn);
    PLAN.sheets.forEach((s, i) => {
      expect(sent[i]).toMatchObject({ catalogId: 'bestiary', step: 'Concept 2D Art', cols: s.cols, rows: s.rows, cast: s.cast });
    });
    expect(sent[0].canonProfile).toBe('diablo1');
    expect(sent[1]).not.toHaveProperty('canonProfile');

    expect(out.map((o) => o.kind)).toEqual(['cut', 'uncut', 'refused', 'failed']);
    const [cut, uncut, refused, failed] = out;
    if (cut.kind !== 'cut' || uncut.kind !== 'uncut' || refused.kind !== 'refused' || failed.kind !== 'failed') throw new Error('kinds');
    expect(cut.icons.map((i) => i.entityId)).toEqual(['c', 'd']);
    expect(cut.styleDnaApplied).toBe('Diablo I — shipped style');
    expect(uncut.sheetUrl).toBe('/api/visual-gen/image/s2.png');
    expect(uncut.reasons).toEqual(['cell 0 is flat']);
    expect(refused.error).toContain('cast does not fill the grid');
    expect(failed.error).toContain('network down');
  });

  it('forwards applyStyleDna in every sheet body — true when asked, false by default', async () => {
    const on = stubFetch();
    await runIconSet(PLAN, on as unknown as typeof fetch, { applyStyleDna: true });
    expect(bodies(on).map((b) => b.applyStyleDna)).toEqual([true, true, true, true]);

    const off = stubFetch();
    await runIconSet(PLAN, off as unknown as typeof fetch);
    expect(bodies(off).map((b) => b.applyStyleDna)).toEqual([false, false, false, false]);
  });

  it('reports each outcome as it lands, so a long run shows progress', async () => {
    const seen: string[] = [];
    await runIconSet(PLAN, stubFetch() as unknown as typeof fetch, { onSheet: (o, i) => seen.push(`${i}:${o.kind}`) });
    expect(seen).toEqual(['0:cut', '1:uncut', '2:refused', '3:failed']);
  });
});
