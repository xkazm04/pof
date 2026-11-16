/**
 * Every paid / proxied visual-gen-core route leaves ONE structured server log line per
 * outcome (provider, status, duration), and never the prompt, image, path or error text.
 *
 * Each route's upstream seam is stubbed to fail with an error that carries a marker string;
 * no provider, Blender or network is touched. The assertion is the logger spy: exactly one
 * warn line, carrying provider/status/ms, whose serialized args do not contain the marker.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { NextRequest } from 'next/server';

const MARKER = 'SECRET-PROMPT-TEXT';

const h = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  start: vi.fn(),
  generateTwoDImage: vi.fn(),
  runContactSheet: vi.fn(),
  gateInputImage: vi.fn(),
  gateFootage: vi.fn(),
  renderIconFromMesh: vi.fn(),
  searchPolyHaven: vi.fn(),
  searchAmbientCG: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: h.info, warn: h.warn, debug: vi.fn(), log: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/visual-gen/runner-dispatch', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/runner-dispatch')>()),
  runnerDispatchFor: () => ({ modes: ['text-to-3d'], start: h.start }),
}));
vi.mock('@/lib/visual-gen/image-providers', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/image-providers')>()),
  generateTwoDImage: h.generateTwoDImage,
}));
vi.mock('@/lib/visual-gen/sheet-slice', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/sheet-slice')>()),
  runContactSheet: h.runContactSheet,
}));
vi.mock('node:fs/promises', async (orig) => ({
  ...(await orig<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(async () => undefined),
}));
vi.mock('@/lib/visual-gen/input-gate', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/input-gate')>()),
  gateInputImage: h.gateInputImage,
}));
vi.mock('@/lib/visual-gen/footage-gate', () => ({ gateFootage: h.gateFootage }));
vi.mock('@/lib/visual-gen/icon-from-mesh', () => ({ renderIconFromMesh: h.renderIconFromMesh }));
vi.mock('@/lib/visual-gen/asset-sources', () => ({
  searchPolyHaven: h.searchPolyHaven,
  searchAmbientCG: h.searchAmbientCG,
}));

const generate = (await import('@/app/api/visual-gen/generate/route')).POST;
const generate2d = (await import('@/app/api/visual-gen/generate-2d/route')).POST;
const contactSheet = (await import('@/app/api/visual-gen/contact-sheet/route')).POST;
const inputGate = (await import('@/app/api/visual-gen/input-gate/route')).POST;
const footageGate = (await import('@/app/api/visual-gen/footage-gate/route')).POST;
const iconFromMesh = (await import('@/app/api/visual-gen/icon-from-mesh/route')).POST;
const browse = (await import('@/app/api/visual-gen/browse/route')).GET;

const PNG = `data:image/png;base64,${Buffer.from('x').toString('base64')}`;
const post = (body: unknown) =>
  new NextRequest('http://localhost/api/visual-gen/x', { method: 'POST', body: JSON.stringify(body) });

interface Line { provider: unknown; status: unknown; ms: unknown }

function expectOneWarn(route: string, status: number) {
  expect(h.warn).toHaveBeenCalledTimes(1);
  const [msg, fields] = h.warn.mock.calls[0] as [string, Line];
  expect(msg).toContain(route);
  expect(typeof fields.provider).toBe('string');
  expect(fields.status).toBe(status);
  expect(typeof fields.ms).toBe('number');
  expect(JSON.stringify([...h.warn.mock.calls, ...h.info.mock.calls])).not.toContain(MARKER);
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('visual-gen-core: one structured server log line per paid outcome', () => {
  it('generate: a refused job start', async () => {
    h.start.mockReturnValue({ ok: false, error: `boom ${MARKER}` });
    const res = await generate(post({ mode: 'text-to-3d', providerId: 'tripo', prompt: `a sword ${MARKER}` }));
    expect(res.status).toBe(400);
    expectOneWarn('visual-gen/generate', 400);
  });

  it('generate-2d: a provider 502', async () => {
    h.generateTwoDImage.mockResolvedValue({ ok: false, error: `upstream ${MARKER}`, providerName: 'Qwen Image' });
    const res = await generate2d(post({ prompt: MARKER }));
    expect(res.status).toBe(502);
    expectOneWarn('visual-gen/generate-2d', 502);
  });

  it('contact-sheet: a provider 502', async () => {
    h.runContactSheet.mockResolvedValue({ ok: false, error: `upstream ${MARKER}` });
    const res = await contactSheet(post({
      catalogId: 'bestiary', step: 'Concept 2D Art', cols: 1, rows: 1, cast: [{ entityId: 'a', brief: MARKER }],
    }));
    expect(res.status).toBe(502);
    expectOneWarn('visual-gen/contact-sheet', 502);
  });

  it('input-gate: a gate that cannot run', async () => {
    h.gateInputImage.mockResolvedValue({ ok: false, error: `vision ${MARKER}` });
    const res = await inputGate(post({ imageDataUrl: PNG, subject: MARKER }));
    expect(res.status).toBe(502);
    expectOneWarn('visual-gen/input-gate', 502);
  });

  it('footage-gate: a gate that cannot run', async () => {
    h.gateFootage.mockResolvedValue({ ok: false, error: `ffmpeg ${MARKER}` });
    const res = await footageGate(post({ videoPath: `${MARKER}.mp4` }));
    expect(res.status).toBe(502);
    expectOneWarn('visual-gen/footage-gate', 502);
  });

  it('icon-from-mesh: a failed render', async () => {
    h.renderIconFromMesh.mockResolvedValue({ ok: false, error: `blender ${MARKER}`, reason: 'x' });
    const res = await iconFromMesh(post({ meshPath: 'package.json', catalogId: 'items', step: 'Icon' }));
    expect(res.status).toBe(500);
    expectOneWarn('visual-gen/icon-from-mesh', 500);
  });

  it('browse: an upstream 502', async () => {
    h.searchPolyHaven.mockRejectedValue(new Error(`down ${MARKER}`));
    const res = await browse(new NextRequest(`http://localhost/api/visual-gen/browse?source=polyhaven&q=${MARKER}`));
    expect(res.status).toBe(502);
    expectOneWarn('visual-gen/browse', 502);
  });

  it('a successful outcome logs one info line and no warn', async () => {
    h.generateTwoDImage.mockResolvedValue({ ok: true, providerName: 'Qwen Image', url: '/u', name: 'n' });
    const res = await generate2d(post({ prompt: MARKER }));
    expect(res.status).toBe(200);
    expect(h.warn).not.toHaveBeenCalled();
    expect(h.info).toHaveBeenCalledTimes(1);
  });
});
