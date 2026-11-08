/**
 * POST /api/visual-gen/contact-sheet — the seam reading covers BOTH cut axes.
 *
 * The provider and the icon library are stubbed; sharp is real and reads a synthetic
 * PNG written to the OS temp dir. The sheet is mild noise with 1px dark lines drawn on
 * the ROW cuts only, so a measurement that only looks at column cuts reads it as clean.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import sharp from 'sharp';

const { gen } = vi.hoisted(() => ({ gen: vi.fn() }));

vi.mock('@/lib/visual-gen/image-providers', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/image-providers')>()),
  generateTwoDImage: gen,
}));
vi.mock('@/lib/visual-gen/icon-library', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/icon-library')>()),
  commitLibraryIcon: vi.fn(async () => undefined),
}));
vi.mock('node:fs/promises', async (orig) => ({
  ...(await orig<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(async () => undefined),
}));
vi.mock('@/lib/db', () => ({ getDb: () => { throw new Error('the DB must not open'); } }));

const { POST } = await import('@/app/api/visual-gen/contact-sheet/route');

const SIZE = 512;
const GRID = 4;
const dirs: string[] = [];

async function sheetWith(lines: 'rows' | 'cols' | 'none'): Promise<string> {
  const buf = Buffer.alloc(SIZE * SIZE);
  let s = 12345;
  for (let i = 0; i < buf.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    buf[i] = 128 + ((s >> 16) % 11) - 5;
  }
  const cell = SIZE / GRID;
  for (let k = 1; k < GRID; k++) {
    for (let i = 0; i < SIZE; i++) {
      if (lines === 'rows') buf[(k * cell) * SIZE + i] = 0;
      if (lines === 'cols') buf[i * SIZE + k * cell] = 0;
    }
  }
  const dir = mkdtempSync(join(tmpdir(), 'pof-sheet-'));
  dirs.push(dir);
  const file = join(dir, 'sheet.png');
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toFile(file);
  return file;
}

async function ratioFor(lines: 'rows' | 'cols' | 'none'): Promise<number | null> {
  const file = await sheetWith(lines);
  const outDir = join(process.cwd(), 'generated', 'images');
  gen.mockResolvedValue({ ok: true, name: relative(outDir, file).split(sep).join('/'), url: '/api/visual-gen/image/sheet.png', model: 'stub' });
  const cast = Array.from({ length: GRID * GRID }, (_, i) => ({ entityId: `e${i}`, brief: `B${i}` }));
  const res = await POST(new NextRequest('http://localhost/api/visual-gen/contact-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogId: 'c', step: 's', cols: GRID, rows: GRID, cast }),
  }));
  const json = (await res.json()) as {
    data?: { verdict?: { seamRatio: number | null } };
    details?: { verdict?: { seamRatio: number | null } };
  };
  const verdict = json.data?.verdict ?? json.details?.verdict;
  expect(verdict).toBeDefined();
  return verdict!.seamRatio;
}

afterEach(() => {
  cleanup();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('contact-sheet seam contrast covers both axes', () => {
  it('drawn ROW lines raise the seam ratio well above the clean sheet', async () => {
    const clean = await ratioFor('none');
    const rows = await ratioFor('rows');
    expect(clean).not.toBeNull();
    expect(rows).not.toBeNull();
    expect(rows!).toBeGreaterThan(5 * clean!);
    expect(rows!).toBeGreaterThan(1);
  });

  it('drawn COLUMN lines still raise it (the old axis is not lost)', async () => {
    const clean = await ratioFor('none');
    const cols = await ratioFor('cols');
    expect(cols!).toBeGreaterThan(5 * clean!);
  });
});
