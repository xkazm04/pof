/** Integrate fields are refused with a 400 before generateIntegration calls string methods on them. */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-psa-marketplace-${process.pid}.db`;
});

import { POST as marketplacePOST } from '@/app/api/marketplace/route';
import { ASSET_CATALOG } from '@/lib/marketplace/asset-catalog';

const post = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  handler(new NextRequest(`http://localhost/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

describe('POST /api/marketplace — integrate fields', () => {
  const assetId = ASSET_CATALOG[0].id;
  it.each([
    ['non-string projectName', { assetId, moduleId: 'arpg-combat', projectName: 42 }],
    ['non-string apiMacro', { assetId, moduleId: 'arpg-combat', projectName: 'PoF', apiMacro: 1 }],
    ['non-array existingClasses', { assetId, moduleId: 'arpg-combat', projectName: 'PoF', existingClasses: 'AFoo' }],
    ['unknown moduleId', { assetId, moduleId: 'nope', projectName: 'PoF' }],
  ])('refuses %s with 400', async (_l, body) => {
    expect((await post(marketplacePOST, 'marketplace', { action: 'integrate', ...body })).status).toBe(400);
  });
  it('still integrates a valid request', async () => {
    const res = await post(marketplacePOST, 'marketplace', { action: 'integrate', assetId, moduleId: 'arpg-combat', projectName: 'PoF' });
    expect(res.status).toBe(200);
  });
});
