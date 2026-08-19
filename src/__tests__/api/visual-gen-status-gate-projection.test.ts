/**
 * GET /api/visual-gen/generate/status projects the WHOLE gate axis.
 *
 * Forced-failure suite for `forge-asset-class-picker`'s stated follow-up. Every job store
 * has written `ungated` (from `summarizeGate`) and `gradedAs` (from `resolveAssetClass` /
 * `localCritiqueDeps`) since wave 12, and this route projected neither — so a mesh nothing
 * measured arrived at the client indistinguishable from one a gate ran on and rejected,
 * and the budget a verdict used was unreadable. Both assertions below are red at HEAD~1.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const hunyuan = vi.fn();
const triposr = vi.fn();
const tripo = vi.fn();

vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ getHunyuanJob: (id: string) => hunyuan(id) }));
vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ getTriposrJob: (id: string) => triposr(id) }));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ getTripoJob: (id: string) => tripo(id) }));

const { GET } = await import('@/app/api/visual-gen/generate/status/route');

const req = (id: string) =>
  new NextRequest(`http://localhost:3001/api/visual-gen/generate/status?jobId=${id}`);

async function statusOf(job: unknown): Promise<Record<string, unknown>> {
  triposr.mockReturnValue(job);
  const res = await GET(req('j1'));
  const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
  expect(body.success).toBe(true);
  return body.data;
}

beforeEach(() => {
  hunyuan.mockReturnValue(undefined);
  triposr.mockReturnValue(undefined);
  tripo.mockReturnValue(undefined);
});

describe('status route — ungated is projected, not collapsed into accepted:false', () => {
  it('carries the store\'s ungated flag and the reason nothing measured the mesh', async () => {
    const data = await statusOf({
      status: 'done',
      result: { meshPath: 'C:/x/generated/triposr/1.glb', faces: 12 },
      accepted: false,
      ungated: true,
      gateReason: 'critique unavailable: venv python not found — mesh delivered ungated',
      gradedAs: 'no assetClass supplied — graded class-blind against the default ceilings',
    });

    expect(data.accepted).toBe(false);
    expect(data.ungated).toBe(true);
    expect(String(data.gateReason)).toContain('delivered ungated');
  });

  it('reports a gate that DID run and rejected the mesh as not-ungated', async () => {
    const data = await statusOf({
      status: 'done',
      result: { meshPath: 'C:/x/generated/triposr/2.glb' },
      accepted: false,
      ungated: false,
      gateReason: 'Tier-1 gate FAIL (score 20): 500000 faces',
    });

    expect(data.accepted).toBe(false);
    expect(data.ungated).toBe(false);
  });
});

describe('status route — the class budget in force is readable', () => {
  it('projects the class-aware gradedAs sentence the store recorded', async () => {
    const data = await statusOf({
      status: 'done',
      result: { meshPath: 'C:/x/generated/triposr/3.glb' },
      accepted: true,
      ungated: false,
      gradedAs: 'graded against the Weapon / held item budget (15000 tri target, warn above 22500, up to 6 parts)',
    });

    expect(String(data.gradedAs)).toContain('Weapon / held item');
    expect(String(data.gradedAs)).toContain('15000');
  });

  it('projects the class-blind sentence just as loudly when no class was sent', async () => {
    const data = await statusOf({
      status: 'done',
      result: { meshPath: 'C:/x/generated/triposr/4.glb' },
      gradedAs: 'no assetClass supplied — graded class-blind against the default ceilings; send one of character, weapon, prop, environment, modular-part to grade against a class budget',
    });

    expect(String(data.gradedAs)).toContain('no assetClass supplied');
    expect(String(data.gradedAs)).toContain('class-blind');
  });

  it('still 404s an unknown job', async () => {
    const res = await GET(req('nope'));
    expect(res.status).toBe(404);
  });
});
