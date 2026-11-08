/** A build profile must have the shape generateUATCommand reads; a shapeless one is refused before it is stored. */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-psa-profiles-${process.pid}.db`;
});

import { POST as profilesPOST, GET as profilesGET } from '@/app/api/packaging/profiles/route';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';

const post = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  handler(new NextRequest(`http://localhost/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

describe('POST /api/packaging/profiles — profile shape', () => {
  const good = createDefaultProfile('Win64');
  it.each([
    ['missing profile', undefined],
    ['empty profile', {}],
    ['unknown platform', { ...good, platform: 'Switch' }],
    ['unknown config', { ...good, config: 'Release' }],
    ['no cookSettings', { ...good, cookSettings: undefined }],
    ['non-string map', { ...good, cookSettings: { ...good.cookSettings, mapsToInclude: [1] } }],
    ['no customFlags', { ...good, platformSettings: { architecture: 'x64' } }],
  ])('save refuses %s with 400 and stores nothing', async (_l, profile) => {
    const before = (await (await profilesGET(new NextRequest('http://localhost/api/packaging/profiles'))).json()).data.profiles.length;
    expect((await post(profilesPOST, 'packaging/profiles', { profile })).status).toBe(400);
    const after = (await (await profilesGET(new NextRequest('http://localhost/api/packaging/profiles'))).json()).data.profiles.length;
    expect(after).toBe(before);
  });
  it('generate-command refuses a shapeless profile with 400', async () => {
    const res = await post(profilesPOST, 'packaging/profiles', {
      action: 'generate-command', profile: {}, projectPath: 'C:/p', projectName: 'PoF', ueVersion: '5.8',
    });
    expect(res.status).toBe(400);
  });
  it('saves a default profile', async () => {
    expect((await post(profilesPOST, 'packaging/profiles', { profile: good })).status).toBe(200);
  });
});
