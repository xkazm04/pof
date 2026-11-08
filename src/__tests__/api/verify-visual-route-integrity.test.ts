/**
 * What /api/verify/visual does around the paid call: refuse before spending, and never
 * lose or crash on what the model answered. The vision router and the DB are mocked.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mockRecognize, mockRecord, mockEmit } = vi.hoisted(() => ({
  mockRecognize: vi.fn(),
  mockRecord: vi.fn(),
  mockEmit: vi.fn(),
}));

vi.mock('@/lib/vision/router', async (orig) => ({
  ...(await orig<typeof import('@/lib/vision/router')>()),
  recognize: mockRecognize,
}));
vi.mock('@/lib/visual-verification-db', () => ({ recordVisualVerification: mockRecord }));
vi.mock('@/lib/event-bus', () => ({ eventBus: { emit: mockEmit } }));

import { POST } from '@/app/api/verify/visual/route';

const shot = join(tmpdir(), `pof-visual-integrity-${process.pid}.png`);
const emptyShot = join(tmpdir(), `pof-visual-integrity-${process.pid}-empty.png`);
beforeAll(() => { writeFileSync(shot, Buffer.from('bytes')); writeFileSync(emptyShot, ''); });
afterAll(() => { for (const f of [shot, emptyShot]) { try { rmSync(f); } catch { /* noop */ } } });

const valid = { moduleId: 'arpg-ui', itemId: 'au-1', screenshotPath: shot };
const req = (body: unknown) =>
  new Request('http://localhost/api/verify/visual', { method: 'POST', body: JSON.stringify(body) });
const call = (body: unknown) => POST(req(body) as never);

function answers(text: string, provider = 'qwen') {
  mockRecognize.mockResolvedValueOnce({
    text, model: 'm', attribution: 'answered', fellBackFrom: [], provider, trail: [],
    effortServed: 'medium', effortDowngraded: false,
  });
}

beforeEach(() => { vi.clearAllMocks(); mockRecord.mockReset(); });

describe('refused before the paid call', () => {
  it.each([
    ['moduleId', { a: 1 }],
    ['itemId', 7],
    ['screenshotPath', 7],
    ['projectPath', 7],
  ])('non-string %s is a 400', async (field, value) => {
    const res = await call({ ...valid, [field]: value });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(field);
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it('a zero-byte screenshot (capture still flushing) is refused, not judged', async () => {
    const res = await call({ ...valid, screenshotPath: emptyShot });
    expect(res.status).toBe(422);
    expect(mockRecognize).not.toHaveBeenCalled();
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
