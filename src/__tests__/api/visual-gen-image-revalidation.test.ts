/**
 * GET /api/visual-gen/image/:name revalidates like the icon and asset routes instead of
 * re-sending every image on every gallery mount.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { GET as serveImage } from '@/app/api/visual-gen/image/[name]/route';
import { GENERATED_IMAGE_DIR } from '@/lib/visual-gen/image-providers';

const url = 'http://localhost/api/visual-gen/image/x';
const ctx = (name: string) => ({ params: Promise.resolve({ name }) });

describe('image route revalidation', () => {
  const dir = join(process.cwd(), 'generated', GENERATED_IMAGE_DIR);
  const name = `pof_vgc_${process.pid}.png`;

  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), Buffer.from('image-bytes'));
  });
  afterAll(() => rmSync(join(dir, name), { force: true }));

  it('serves an ETag and answers a matching revalidation with an empty 304', async () => {
    const first = await serveImage(new NextRequest(url), ctx(name));
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).not.toBe('no-store');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = await serveImage(new NextRequest(url, { headers: { 'if-none-match': etag as string } }), ctx(name));
    expect(second.status).toBe(304);
    expect((await second.arrayBuffer()).byteLength).toBe(0);
  });
});
