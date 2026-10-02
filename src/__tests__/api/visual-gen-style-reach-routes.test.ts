/**
 * Style DNA reaches every SERVER 2D route through the one resolver (style-apply.ts):
 * POST /api/visual-gen/generate-2d (the app's 2D front) and POST /api/visual-gen/contact-sheet
 * (a catalog-bound sheet, canon-aware). The paid provider seam `generateTwoDImage` is mocked —
 * no provider is ever called — and the DB is a per-file in-memory SQLite.
 *
 * Absent `applyStyleDna`, both routes hand the provider exactly what they did before.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

const { gen, dbBox } = vi.hoisted(() => ({
  gen: vi.fn(),
  dbBox: {} as { db?: import('better-sqlite3').Database },
}));

vi.mock('@/lib/visual-gen/image-providers', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/image-providers')>()),
  generateTwoDImage: gen,
}));
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  dbBox.db = new Database(':memory:');
  return { getDb: () => dbBox.db };
});

const { POST: generate2d } = await import('@/app/api/visual-gen/generate-2d/route');
const { POST: contactSheet } = await import('@/app/api/visual-gen/contact-sheet/route');
const { getDb } = await import('@/lib/db');
const { saveStyleDna } = await import('@/lib/visual-gen/style-dna-db');
const { styleDnaToPromptFragment } = await import('@/lib/visual-gen/style-dna');
const { DIABLO1_CREATURE_STYLE_DNA } = await import('@/lib/catalog/canon/profiles/diablo1Style');

afterAll(() => dbBox.db?.close());

const POF_DNA = {
  palette: ['desaturated teal'], materials: ['aged brass'], mood: ['whimsical'], render: ['gouache wash'], motifs: ['clockwork'],
};
const POF_ITEMS = Object.values(POF_DNA).flat();

const post = <T>(route: (r: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  route(new NextRequest(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).then(async (res) => ({ status: res.status, json: (await res.json()) as { success: boolean; data?: T; error?: string } }));

interface StyleData { styleDnaApplied: string | null; styleDnaWithheld: string | null }

beforeEach(() => {
  gen.mockReset();
  gen.mockResolvedValue({
    ok: true, providerId: 'qwen-image', providerName: 'Qwen-Image', url: '/api/visual-gen/image/q.png', name: 'q.png', durationMs: 1,
  });
  getDb().exec('DROP TABLE IF EXISTS style_dna');
  saveStyleDna(getDb(), { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
});

const sentPrompt = () => (gen.mock.calls[0][0] as { prompt: string }).prompt;

describe('POST /api/visual-gen/generate-2d — Style DNA via the resolver', () => {
  it('case 5a: applyStyleDna appends the active fragment and names the profile', async () => {
    const { status, json } = await post<StyleData>(generate2d, '/api/visual-gen/generate-2d', {
      prompt: 'a sword', providerId: 'qwen-image', applyStyleDna: true,
    });
    expect(status).toBe(200);
    expect(sentPrompt()).toBe(`a sword. ${styleDnaToPromptFragment(POF_DNA)}`);
    expect(sentPrompt().endsWith(styleDnaToPromptFragment(POF_DNA))).toBe(true);
    expect(json.data?.styleDnaApplied).toBe('Alice gothic');
  });

  it('case 5b: without applyStyleDna the provider gets exactly "a sword" and styleDnaApplied is null', async () => {
    const { json } = await post<StyleData>(generate2d, '/api/visual-gen/generate-2d', { prompt: 'a sword', providerId: 'qwen-image' });
    expect(sentPrompt()).toBe('a sword');
    expect(gen.mock.calls[0][0]).toEqual({ prompt: 'a sword', providerId: 'qwen-image', size: undefined, width: undefined, height: undefined });
    expect(json.data?.styleDnaApplied).toBeNull();
  });

  it('a canon the server holds no style for is withheld with the reason, prompt untouched', async () => {
    const { json } = await post<StyleData>(generate2d, '/api/visual-gen/generate-2d', {
      prompt: 'a sword', providerId: 'qwen-image', applyStyleDna: true, canonProfile: 'no-such-canon',
    });
    expect(sentPrompt()).toBe('a sword');
    expect(json.data?.styleDnaWithheld).toMatch(/no Style DNA is bound to canon profile "no-such-canon"/);
  });
});

const CAST = [{ entityId: 'zombie', brief: 'a rotting zombie' }];
const sheetBody = { catalogId: 'bestiary', step: 'icon', cols: 1, rows: 1, cast: CAST };
const styleLine = () => sentPrompt().split('\n').find((l) => l.startsWith('Style/medium:'));

describe('POST /api/visual-gen/contact-sheet — canon-aware Style DNA', () => {
  beforeEach(() => gen.mockResolvedValue({ ok: false, error: 'mocked provider: no bytes', providerId: 'qwen-image', providerName: 'Qwen-Image', durationMs: 1 }));

  it("case 6a: a diablo1 bestiary sheet carries diablo1's creature style, never PoF's", async () => {
    const { json } = await post<StyleData>(contactSheet, '/api/visual-gen/contact-sheet', {
      ...sheetBody, applyStyleDna: true, canonProfile: 'diablo1',
    });
    const fragment = styleDnaToPromptFragment(DIABLO1_CREATURE_STYLE_DNA);
    expect(styleLine()).toContain(fragment.slice(0, -1));
    expect(styleLine()).not.toContain('painterly dark-fantasy ARPG art');
    for (const item of POF_ITEMS) expect(sentPrompt()).not.toContain(item);
    // the provider failed (mocked): a 502 carrying the provider's reason, as before
    expect(json.success).toBe(false);
    expect(json.error).toContain('mocked provider');
  });

  it('case 6b [guard]: without applyStyleDna the sheet keeps its default medium', async () => {
    await post(contactSheet, '/api/visual-gen/contact-sheet', { ...sheetBody, canonProfile: 'diablo1' });
    expect(styleLine()).toMatch(/^Style\/medium: painterly dark-fantasy ARPG art\./);
  });

  it('applyStyleDna with a withheld canon falls back to the default medium (no project style)', async () => {
    await post(contactSheet, '/api/visual-gen/contact-sheet', { ...sheetBody, applyStyleDna: true, canonProfile: 'no-such-canon' });
    expect(styleLine()).toMatch(/^Style\/medium: painterly dark-fantasy ARPG art\./);
    for (const item of POF_ITEMS) expect(sentPrompt()).not.toContain(item);
  });

  it("a PoF sheet (no canon) with applyStyleDna carries the project's active style", async () => {
    gen.mockResolvedValue({ ok: false, refused: true, error: 'refused', providerId: 'qwen-image', providerName: 'Qwen-Image', durationMs: 1 });
    const { status } = await post(contactSheet, '/api/visual-gen/contact-sheet', { ...sheetBody, applyStyleDna: true });
    expect(status).toBe(400);
    expect(styleLine()).toContain(styleDnaToPromptFragment(POF_DNA).slice(0, -1));
  });
});

describe('one resolver — no app route re-implements the style rule', () => {
  it('no file under src/app or src/components calls styleDnaForProfile directly', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (/\.(ts|tsx)$/.test(e) && /\bstyleDnaForProfile\s*\(/.test(readFileSync(full, 'utf8'))) hits.push(full);
      }
    };
    walk(join(process.cwd(), 'src', 'app'));
    walk(join(process.cwd(), 'src', 'components'));
    expect(hits).toEqual([]);
  });

  it('every server 2D route that generates from a prompt adopts style-apply', () => {
    for (const f of ['src/app/api/leonardo/route.ts', 'src/app/api/visual-gen/generate-2d/route.ts', 'src/app/api/visual-gen/contact-sheet/route.ts']) {
      expect(readFileSync(join(process.cwd(), f), 'utf8')).toMatch(/from '@\/lib\/visual-gen\/style-apply'/);
    }
  });
});
