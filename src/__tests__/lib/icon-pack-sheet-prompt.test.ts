/**
 * The hardened icon prompt pack reaches the contact-sheet prompt: a mapped catalog carries its
 * family clause + NEG_TAIL, an unmapped one is byte-identical to the pre-pack prompt, and the
 * preview (`sheetPrompt`) and the route (spec handed to the runner) compose the same prompt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { CATALOG_TO_FAMILY, ICON_FAMILIES, NEG_TAIL } from '@/lib/media-prompts/iconPrompts';
import { buildContactSheetPrompt, DEFAULT_SHEET_PX } from '@/lib/visual-gen/contact-sheet';
import { planIconSet, sheetPrompt, SHEET_DEFAULTS, type PlannedSheet } from '@/lib/visual-gen/icon-set-plan';

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/visual-gen/sheet-slice', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/sheet-slice')>()),
  runContactSheet: run,
}));
vi.mock('node:fs/promises', async (orig) => ({
  ...(await orig<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(async () => undefined),
}));
vi.mock('@/lib/db', () => ({ getDb: () => { throw new Error('no DB'); } }));
const { POST } = await import('@/app/api/visual-gen/contact-sheet/route');

const MAPPED = 'bestiary';
const UNMAPPED = 'no-such-catalog';
const STEP = 'Concept 2D Art';
const entities = [{ id: 'c', name: 'C' }, { id: 'd', name: 'D' }];

function sheetFor(catalogId: string): PlannedSheet {
  const r = planIconSet({ catalogId, step: STEP, entities, icons: [] });
  if (!r.ok) throw new Error(r.error);
  return r.data.sheets[0];
}

/** The pre-pack prompt: no catalogId on the spec at all. */
function legacyPrompt(sheet: PlannedSheet): string {
  const r = buildContactSheetPrompt({
    cols: sheet.cols, rows: sheet.rows, ...SHEET_DEFAULTS,
    cast: sheet.cast.map((c) => ({ id: c.entityId, brief: c.brief })),
    width: DEFAULT_SHEET_PX, height: DEFAULT_SHEET_PX,
  });
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

async function routePrompt(catalogId: string): Promise<string> {
  run.mockResolvedValue({ ok: false, error: 'stub' });
  await POST(new NextRequest('http://localhost/api/visual-gen/contact-sheet', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalogId, step: STEP, cols: 2, rows: 1,
      cast: [{ entityId: 'c', brief: 'C' }, { entityId: 'd', brief: 'D' }],
    }),
  }));
  const r = buildContactSheetPrompt(run.mock.calls[0][0].spec);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

beforeEach(() => run.mockReset());

describe('icon pack in the sheet prompt', () => {
  it('(a) a mapped catalog carries its family clause and NEG_TAIL', () => {
    const p = sheetPrompt(sheetFor(MAPPED));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.data).toContain(ICON_FAMILIES[CATALOG_TO_FAMILY[MAPPED]].clause);
    expect(p.data).toContain(NEG_TAIL);
  });

  it('(b) an unmapped catalog is byte-identical to the pre-pack prompt', () => {
    const sheet = sheetFor(UNMAPPED);
    const p = sheetPrompt(sheet);
    expect(p.ok && p.data).toBe(legacyPrompt(sheet));
    expect(p.ok && p.data).not.toContain(NEG_TAIL);
  });

  it.each([MAPPED, UNMAPPED])('(c) preview and route compose the same prompt for %s', async (cat) => {
    const preview = sheetPrompt(sheetFor(cat));
    expect(preview.ok && preview.data).toBe(await routePrompt(cat));
  });
});
