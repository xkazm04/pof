import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTwoDImage } from '@/lib/visual-gen/image-providers';

/** Stubs only: fetch is stubbed, nothing leaves the process, nothing touches disk. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
const OPAQUE = new Uint8Array([1, 2, 3, 4]);

const stubFetch = (bytes: Uint8Array) => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('dashscope')
      ? new Response(JSON.stringify({ output: { choices: [{ message: { content: [{ image: 'https://cdn.example/x.img' }] } }] } }))
      : new Response(bytes as unknown as BodyInit)));
};

async function run(bytes: Uint8Array) {
  stubFetch(bytes);
  const writes: string[] = [];
  const r = await generateTwoDImage(
    { prompt: 'a key', providerId: 'qwen-image' },
    { env: { QWEN_API_KEY: 'k' }, outDir: '/tmp/out', now: () => 1700000000000, writeFile: async (p) => { writes.push(p); } },
  );
  return { r, writes };
}

afterEach(() => vi.unstubAllGlobals());

describe('Qwen output is named after its real bytes, like Leonardo', () => {
  it.each([
    ['jpg', JPEG],
    ['webp', WEBP],
    ['png', PNG],
  ] as const)('a %s body is written and reported as .%s', async (ext, bytes) => {
    const { r, writes } = await run(bytes);
    expect(r.ok).toBe(true);
    expect(r.name).toBe(`qwen-image_1700000000000.${ext}`);
    expect(r.url).toBe(`/api/visual-gen/image/qwen-image_1700000000000.${ext}`);
    expect(writes).toEqual([`/tmp/out/qwen-image_1700000000000.${ext}`]);
  });

  it('keeps the png name when the bytes match no known format', async () => {
    const { r } = await run(OPAQUE);
    expect(r.name).toBe('qwen-image_1700000000000.png');
  });
});
