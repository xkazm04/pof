/**
 * The three byte-serving routes of visual-gen-core: a name that is not valid percent-encoding
 * is the caller's mistake (400).
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as serveAsset } from '@/app/api/visual-gen/asset/[name]/route';
import { GET as serveIcon } from '@/app/api/visual-gen/icon/[name]/route';
import { GET as serveImage } from '@/app/api/visual-gen/image/[name]/route';

const url = 'http://localhost/api/visual-gen/x';
const ctx = (name: string) => ({ params: Promise.resolve({ name }) });

describe.each([
  ['asset', serveAsset],
  ['icon', serveIcon],
  ['image', serveImage],
] as const)('%s route', (_n, get) => {
  it('answers 400 for a name that is not valid percent-encoding', async () => {
    expect((await get(new NextRequest(url), ctx('%E0%A4%A'))).status).toBe(400);
  });

  it('[guard] still refuses a traversal name with a 400', async () => {
    expect((await get(new NextRequest(url), ctx('..%2Fsecret.png'))).status).toBe(400);
  });
});
