/**
 * The three remaining POST bodies of visual-gen-core: icon-from-mesh (starts Blender),
 * input-gate and footage-gate (each a paid vision call). Malformed input is the caller's
 * mistake, answered 400 before the render or the model.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { renderIconFromMesh, gateInputImage, gateFootage } = vi.hoisted(() => ({
  renderIconFromMesh: vi.fn(),
  gateInputImage: vi.fn(),
  gateFootage: vi.fn(),
}));
vi.mock('@/lib/visual-gen/icon-from-mesh', () => ({ renderIconFromMesh }));
vi.mock('@/lib/visual-gen/input-gate', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/input-gate')>()),
  gateInputImage,
}));
vi.mock('@/lib/visual-gen/footage-gate', () => ({ gateFootage }));

const iconPost = (await import('@/app/api/visual-gen/icon-from-mesh/route')).POST;
const inputPost = (await import('@/app/api/visual-gen/input-gate/route')).POST;
const footagePost = (await import('@/app/api/visual-gen/footage-gate/route')).POST;

type Post = (request: NextRequest) => Promise<Response>;

const raw = (post: Post, body: string) =>
  post(new NextRequest('http://localhost/api/visual-gen/x', { method: 'POST', body }));
const send = (post: Post, body: unknown) => raw(post, JSON.stringify(body));

const MESH = { meshPath: 'package.json', catalogId: 'items', step: 'Icon' };
const PNG = `data:image/png;base64,${Buffer.from('x').toString('base64')}`;

beforeEach(() => {
  vi.clearAllMocks();
  renderIconFromMesh.mockResolvedValue({ ok: true });
  gateInputImage.mockResolvedValue({ ok: true });
  gateFootage.mockResolvedValue({ ok: true });
});

describe.each([
  ['icon-from-mesh', iconPost],
  ['input-gate', inputPost],
  ['footage-gate', footagePost],
] as const)('%s malformed body', (_n, post) => {
  it.each(['{not json', 'null', '[]'])('refuses %s with a 400', async (body) => {
    expect((await raw(post, body)).status).toBe(400);
  });
});

describe('icon-from-mesh fields', () => {
  it.each([
    ['meshPath', 5],
    ['catalogId', {}],
    ['step', 1],
    ['entityId', 2],
    ['heroYaw', 'front'],
    ['resolution', 0],
    ['resolution', 1.5],
    ['resolution', 100000],
    ['resolution', '512'],
  ])('refuses %s=%j before Blender', async (field, value) => {
    expect((await send(iconPost, { ...MESH, [field]: value })).status).toBe(400);
    expect(renderIconFromMesh).not.toHaveBeenCalled();
  });

  it('[guard] a well-formed body renders', async () => {
    expect((await send(iconPost, { ...MESH, heroYaw: 45, resolution: 512 })).status).toBe(200);
    expect(renderIconFromMesh).toHaveBeenCalledTimes(1);
  });
});

describe('input-gate fields', () => {
  it.each([['imageDataUrl', 5], ['subject', {}]])('refuses %s=%j before the model', async (field, value) => {
    expect((await send(inputPost, { imageDataUrl: PNG, [field]: value })).status).toBe(400);
    expect(gateInputImage).not.toHaveBeenCalled();
  });

  it('[guard] a well-formed body is judged', async () => {
    expect((await send(inputPost, { imageDataUrl: PNG, subject: 'a shield' })).status).toBe(200);
    expect(gateInputImage).toHaveBeenCalledTimes(1);
  });
});

describe('footage-gate fields', () => {
  it.each([
    ['videoPath', 5],
    ['purpose', 'face'],
    ['frameCount', 0],
    ['frameCount', 1.5],
    ['frameCount', 500],
    ['frameCount', '8'],
  ])('refuses %s=%j before ffmpeg or the model', async (field, value) => {
    expect((await send(footagePost, { videoPath: 'clip.mp4', [field]: value })).status).toBe(400);
    expect(gateFootage).not.toHaveBeenCalled();
  });

  it('[guard] a well-formed body is judged with its frame count', async () => {
    expect((await send(footagePost, { videoPath: 'clip.mp4', purpose: 'body+face', frameCount: 12 })).status).toBe(200);
    expect(gateFootage).toHaveBeenCalledWith('clip.mp4', { purpose: 'body+face', frameCount: 12 });
  });
});
