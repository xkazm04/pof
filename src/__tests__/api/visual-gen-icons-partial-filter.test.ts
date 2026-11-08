/**
 * GET /api/visual-gen/icons: a half-given filter is refused (400), never answered with the
 * whole library under a 200. Callers (useGeneratedImageAssets) always send the (catalogId, step)
 * pair or nothing, so only the malformed shapes change.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/visual-gen/icons/route';
import { invalidateListingCache } from '@/lib/visual-gen/generated-assets';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pof-icons-partial-'));
  const dir = join(root, 'generated', 'icons');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'other-catalog_other-step.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  invalidateListingCache();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/visual-gen/icons${qs}`));

describe('GET /api/visual-gen/icons partial filters', () => {
  it.each(['?catalogId=items', '?step=Icon', '?entityId=sword', '?catalogId=items&entityId=sword'])(
    '%s is a 400, not the whole library',
    async (qs) => {
      const res = await get(qs);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { success: boolean; data?: unknown };
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
    },
  );

  it('no filter still lists everything, the pair filters, and slug stays exact', async () => {
    const all = (await (await get('')).json()) as { data: { icons: unknown[] } };
    expect(all.data.icons).toHaveLength(1);
    expect((await get('?catalogId=items&step=Icon')).status).toBe(200);
    expect((await get('?slug=nope')).status).toBe(200);
  });
});
