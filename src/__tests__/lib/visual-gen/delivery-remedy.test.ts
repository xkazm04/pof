/**
 * `remedyFor` — the delivered mesh's NEXT STEP, derived from the verdict the gate already
 * reached. Three kinds: `finish` ($0 local Blender, names what it addresses and what stays
 * broken), `reroll` (paid; stated, never offered as a new button) and `none` (with why).
 *
 * The route case pins that the status poll projects it server-side: the client never
 * receives `findings`, so it cannot compute this itself.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { remedyFor } from '@/lib/visual-gen/delivery-remedy';
import type { CritiqueResult } from '@/lib/visual-gen/mesh-critique';

const hunyuan = vi.fn();
const triposr = vi.fn();
const tripo = vi.fn();
const trellis = vi.fn();

vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ getHunyuanJob: (id: string) => hunyuan(id) }));
vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ getTriposrJob: (id: string) => triposr(id) }));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ getTripoJob: (id: string) => tripo(id) }));
vi.mock('@/lib/visual-gen/trellis-job-store', () => ({ getTrellisJob: (id: string) => trellis(id) }));

const PARTS_FAIL: CritiqueResult = {
  ok: true,
  verdict: 'fail',
  score: 50,
  reasons: ['9 substantial disconnected parts'],
  findings: [{ code: 'parts-over-budget', severity: 'fail', reason: '9 substantial disconnected parts' }],
};

describe('remedyFor — the defect class picks the remedy', () => {
  it('case 1: a parts-over-budget prop offers a $0 finish naming what it addresses', () => {
    const r = remedyFor({ critique: PARTS_FAIL, assetClass: 'prop', meshPath: 'C:/pof/generated/tripo3d/crate.glb' });
    expect(r).toMatchObject({
      kind: 'finish',
      paid: false,
      name: 'crate.glb',
      dir: 'tripo3d',
      addresses: ['parts-over-budget'],
      unaddressed: [],
    });
  });

  it('case 2: a floater-only failure is REFUSED with its reason, never offered', () => {
    const r = remedyFor({
      critique: {
        ok: true, verdict: 'fail', score: 40, reasons: ['12 floater fragments'],
        findings: [{ code: 'floaters', severity: 'fail', reason: '12 floater fragments' }],
      },
      assetClass: 'prop',
      meshPath: 'C:/pof/generated/tripo3d/crate.glb',
    });
    expect(r?.kind).toBe('none');
    if (r?.kind !== 'none') throw new Error('unreachable');
    expect(r.reason).toMatch(/floater/);
  });

  it('case 3: an empty mesh is a paid reroll, and no finish is offered', () => {
    const r = remedyFor({
      critique: {
        ok: true, verdict: 'fail', score: 0, reasons: ['mesh is empty'],
        findings: [{ code: 'empty-mesh', severity: 'fail', reason: 'mesh is empty' }],
      },
      assetClass: 'prop',
      meshPath: 'C:/pof/generated/tripo3d/crate.glb',
    });
    expect(r).toMatchObject({ kind: 'reroll', paid: true });
    if (r?.kind !== 'reroll') throw new Error('unreachable');
    expect(r.note).toMatch(/paid/i);
    expect(r.note).toMatch(/generation/i);
  });

  it('case 4: a green budget-deferred character is not finished yet — finish addresses face-count', () => {
    const r = remedyFor({
      critique: {
        ok: true, verdict: 'warn', score: 85, reasons: ['1800000 faces'],
        metrics: {
          verts: 900_000, faces: 1_800_000, watertight: true, windingConsistent: true, components: 1,
          euler: 2, bbox: [1, 2, 0.5], volume: 1, area: 10, degenerateFaces: 0,
          componentFaces: [1_800_000], componentFacesOmitted: 0,
        },
        findings: [{ code: 'face-count', severity: 'warn', reason: '1800000 faces' }],
      },
      assetClass: 'character',
      meshPath: 'C:/pof/generated/tripo3d/hero.glb',
    });
    expect(r).toMatchObject({ kind: 'finish', paid: false, name: 'hero.glb', dir: 'tripo3d', addresses: ['face-count'] });
  });

  it('case 5: an unavailable critic, or a mesh outside ASSET_DIRS, yields none with the reason', () => {
    const unavailable = remedyFor({
      critique: { ok: false, unavailable: true, error: 'POF_TRIPOSR_ROOT is not set' },
      assetClass: 'prop',
      meshPath: 'C:/pof/generated/tripo3d/crate.glb',
    });
    expect(unavailable?.kind).toBe('none');
    if (unavailable?.kind !== 'none') throw new Error('unreachable');
    expect(unavailable.reason).toMatch(/critic could not run/);

    const outside = remedyFor({ critique: PARTS_FAIL, assetClass: 'prop', meshPath: 'C:/tmp/scratch/crate.glb' });
    expect(outside?.kind).toBe('none');
    if (outside?.kind !== 'none') throw new Error('unreachable');
    expect(outside.reason).toContain('scratch');
  });
});

describe('GET /api/visual-gen/generate/status — projects the remedy server-side', () => {
  beforeEach(() => {
    hunyuan.mockReturnValue(undefined);
    triposr.mockReturnValue(undefined);
    tripo.mockReturnValue(undefined);
    trellis.mockReturnValue(undefined);
  });

  it('case 6: a done job whose critique fails on parts-over-budget carries remedy.kind finish', async () => {
    tripo.mockReturnValue({
      status: 'done',
      spec: { assetClass: 'prop' },
      result: { meshPath: 'C:/pof/generated/tripo3d/crate.glb' },
      critique: PARTS_FAIL,
      accepted: false,
      ungated: false,
      gateReason: 'Tier-1 gate FAIL (score 50)',
    });
    const { GET } = await import('@/app/api/visual-gen/generate/status/route');
    const res = await GET(new NextRequest('http://localhost:3001/api/visual-gen/generate/status?jobId=t1'));
    const body = (await res.json()) as { success: boolean; data: { remedy?: { kind: string; addresses?: string[] }; critique?: Record<string, unknown> } };
    expect(body.success).toBe(true);
    expect(body.data.remedy?.kind).toBe('finish');
    expect(body.data.remedy?.addresses).toEqual(['parts-over-budget']);
    // The findings themselves still never reach the wire — only the projected remedy does.
    expect(body.data.critique && 'findings' in body.data.critique).toBe(false);
  });
});
