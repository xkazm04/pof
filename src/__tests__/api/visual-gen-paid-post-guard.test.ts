import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Providers are stubbed: no network, no credit, no vision call.
const { generateImage, startJob } = vi.hoisted(() => ({
  generateImage: vi.fn().mockResolvedValue({ imageUrl: 'u', generationId: 'g', imageBase64: 'AA' }),
  startJob: vi.fn().mockReturnValue('job-1'),
}));
vi.mock('@/lib/leonardo', () => ({
  MAX_PROMPT_LENGTH: 1500,
  generateImage,
  upscaleImage: vi.fn(),
  unzoomImage: vi.fn(),
  generateTextureOn3DModel: vi.fn(),
}));
vi.mock('@/lib/visual-gen/style-dna-job-store', () => ({ startStyleDnaJob: startJob, getStyleDnaJob: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/visual-gen/style-dna-db', () => ({
  getActiveStyleDna: vi.fn(), listStyleDna: vi.fn(), setActiveStyleDna: vi.fn(), saveStyleDna: vi.fn(),
}));

import { POST as leonardoPost } from '@/app/api/leonardo/route';
import { POST as styleDnaPost } from '@/app/api/visual-gen/style-dna/route';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const CROSS = { origin: 'https://evil.example', host: 'localhost:3001', 'content-type': 'text/plain' };
const SAME = { origin: 'http://localhost:3001', host: 'localhost:3001' };
const leo = (headers: Record<string, string>) =>
  new Request('http://localhost:3001/api/leonardo', { method: 'POST', headers, body: JSON.stringify({ prompt: 'a shield' }) });
const dna = (headers: Record<string, string>) =>
  new Request('http://localhost:3001/api/visual-gen/style-dna', { method: 'POST', headers, body: JSON.stringify({ images: [PNG] }) });

describe('paid generation POSTs refuse cross-site requests', () => {
  const savedKey = process.env.LEONARDO_API_KEY;
  const savedTok = process.env.POF_OPERATOR_TOKEN;
  beforeEach(() => {
    process.env.LEONARDO_API_KEY = 'test';
    delete process.env.POF_OPERATOR_TOKEN;
    generateImage.mockClear();
    startJob.mockClear();
  });
  afterEach(() => {
    cleanup();
    process.env.LEONARDO_API_KEY = savedKey;
    if (savedTok === undefined) delete process.env.POF_OPERATOR_TOKEN; else process.env.POF_OPERATOR_TOKEN = savedTok;
  });

  it('POST /api/leonardo: cross-origin text/plain is 403 and spends nothing', async () => {
    const res = await leonardoPost(leo(CROSS));
    expect(res.status).toBe(403);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('POST /api/leonardo: same-origin still generates', async () => {
    const res = await leonardoPost(leo(SAME));
    expect(res.status).toBe(200);
    expect(generateImage).toHaveBeenCalledTimes(1);
  });

  it('POST /api/visual-gen/style-dna: cross-origin is 403 and starts no job', async () => {
    const res = await styleDnaPost(dna(CROSS) as never);
    expect(res.status).toBe(403);
    expect(startJob).not.toHaveBeenCalled();
  });

  it('POST /api/visual-gen/style-dna: same-origin still starts the job', async () => {
    const res = await styleDnaPost(dna(SAME) as never);
    expect(res.status).toBe(202);
    expect(startJob).toHaveBeenCalledTimes(1);
  });
});
