/**
 * scene-decompose refuses an oversized upload before it decodes, crops or bills it.
 *
 * Ceilings (route.ts): image 16 MiB decoded, hint 2000 characters. The vision seam is
 * mocked, so "refused before billing" is asserted as zero vision calls.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { NextRequest } from 'next/server';

const vision = vi.fn();
vi.mock('@/lib/vision/seam', () => ({
  makeRoutedVisionText: () => vision,
  makeRoutedVision: () => vision,
}));

const { POST } = await import('@/app/api/visual-gen/scene-decompose/route');

const IMAGE_CEILING = 16 * 1024 * 1024;
const HINT_CEILING = 2000;

const dataUrlOfBytes = (n: number) => `data:image/png;base64,${Buffer.alloc(n).toString('base64')}`;

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3001/api/visual-gen/scene-decompose', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vision.mockReset();
  vision.mockResolvedValue('NO_PROPS');
});
afterEach(cleanup);

describe('scene-decompose size ceilings', () => {
  it('refuses an image one byte over the ceiling with a 413 and never calls vision', async () => {
    const res = await POST(req({ imageDataUrl: dataUrlOfBytes(IMAGE_CEILING + 1), gateCrops: false }));
    expect(res.status).toBe(413);
    expect(vision).not.toHaveBeenCalled();
  });

  it('admits an image exactly at the ceiling', async () => {
    const res = await POST(req({ imageDataUrl: dataUrlOfBytes(IMAGE_CEILING), gateCrops: false }));
    expect(res.status).not.toBe(413);
    expect(vision).toHaveBeenCalled();
  });

  it('refuses a hint one character over the ceiling with a 413 and never calls vision', async () => {
    const res = await POST(
      req({ imageDataUrl: dataUrlOfBytes(64), hint: 'x'.repeat(HINT_CEILING + 1), gateCrops: false }),
    );
    expect(res.status).toBe(413);
    expect(vision).not.toHaveBeenCalled();
  });

  it('admits a hint exactly at the ceiling', async () => {
    const res = await POST(
      req({ imageDataUrl: dataUrlOfBytes(64), hint: 'x'.repeat(HINT_CEILING), gateCrops: false }),
    );
    expect(res.status).not.toBe(413);
    expect(vision).toHaveBeenCalled();
  });
});
