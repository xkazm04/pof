/**
 * POST /api/visual-gen/contact-sheet — the paid sheet's url survives a failed cut.
 *
 * The route's header promises "a sheet that generated but could not be cut is a 502 that
 * still hands back the sheet url and the verdict". `runContactSheet` is mocked (no provider,
 * no sharp, no disk) and `mkdir` is stubbed so nothing is created under the repo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { run } = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock('@/lib/visual-gen/sheet-slice', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/sheet-slice')>()),
  runContactSheet: run,
}));
vi.mock('node:fs/promises', async (orig) => ({
  ...(await orig<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(async () => undefined),
}));
vi.mock('@/lib/db', () => ({ getDb: () => { throw new Error('the DB must not open without applyStyleDna'); } }));

const { POST } = await import('@/app/api/visual-gen/contact-sheet/route');

const BODY = {
  catalogId: 'bestiary',
  step: 'Concept 2D Art',
  cols: 2,
  rows: 1,
  cast: [{ entityId: 'c', brief: 'C' }, { entityId: 'd', brief: 'D' }],
};

async function post(body: unknown) {
  const res = await POST(new NextRequest('http://localhost/api/visual-gen/contact-sheet', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: res.status, json: (await res.json()) as { success: boolean; error?: string; details?: Record<string, unknown> } };
}

beforeEach(() => run.mockReset());

describe('POST /api/visual-gen/contact-sheet — failure envelopes', () => {
  it('case 4: an uncut sheet is a 502 whose details carry the sheet url and the gate verdict', async () => {
    run.mockResolvedValue({
      ok: false,
      error: 'the sheet was generated but not cut: seams do not line up',
      sheetUrl: '/api/visual-gen/image/sheet-1.png',
      verdict: { sliceable: false, reasons: ['seams do not line up'] },
    });
    const { status, json } = await post(BODY);
    expect(status).toBe(502);
    expect(json.success).toBe(false);
    expect(json.error).toContain('generated but not cut');
    const details = json.details as { sheetUrl?: string; verdict?: { reasons?: string[] } } | undefined;
    expect(details?.sheetUrl).toBe('/api/visual-gen/image/sheet-1.png');
    expect(details?.verdict?.reasons?.length).toBeGreaterThan(0);
  });

  it('a provider failure (no sheet) stays a detail-less 502; a refusal stays a 400', async () => {
    run.mockResolvedValueOnce({ ok: false, error: 'provider timed out' });
    const failed = await post(BODY);
    expect(failed.status).toBe(502);
    expect(failed.json.details).toBeUndefined();

    run.mockResolvedValueOnce({ ok: false, refused: true, error: 'cast does not fill the grid: 2x1 needs 2 subjects, got 1' });
    const refused = await post(BODY);
    expect(refused.status).toBe(400);
  });

  it('the sheet provider defaults to the one the icon-set panel checks capability for', async () => {
    run.mockResolvedValue({ ok: false, error: 'x' });
    await post(BODY);
    const { SHEET_PROVIDER_ID } = await import('@/lib/visual-gen/icon-set-plan');
    expect(SHEET_PROVIDER_ID).toBe('qwen-image');
    // The spec handed to the runner uses the plan module's defaults, so the preview prompt is the sent one.
    const { SHEET_DEFAULTS } = await import('@/lib/visual-gen/icon-set-plan');
    const spec = run.mock.calls[0][0].spec as { style: string; cellSubject: string; background: string };
    expect(spec).toMatchObject(SHEET_DEFAULTS);
  });
});
