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
const textShot = join(tmpdir(), `pof-visual-integrity-${process.pid}-text.png`);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
beforeAll(() => {
  writeFileSync(shot, Buffer.concat([PNG_HEADER, Buffer.from('bytes')]));
  writeFileSync(emptyShot, '');
  writeFileSync(textShot, 'not an image, just text');
});
afterAll(() => { for (const f of [shot, emptyShot, textShot]) { try { rmSync(f); } catch { /* noop */ } } });

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

describe('a non-PNG file is refused before the paid call', () => {
  it('a text file named .png is a 422 and never reaches the provider', async () => {
    const res = await call({ ...valid, screenshotPath: textShot });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain('not a PNG');
    expect(mockRecognize).not.toHaveBeenCalled();
    expect(mockRecord).not.toHaveBeenCalled();
  });
});

describe('what the model answered', () => {
  it.each(['null', '[1]', '"pass"', '7'])('%s is a 502, not a crash', async (text) => {
    answers(text);
    const res = await call(valid);
    expect(res.status).toBe(502);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('an invalid verdict names the eye that actually answered', async () => {
    answers('{"verdict":"maybe"}', 'qwen');
    const res = await call(valid);
    expect(res.status).toBe(502);
    const { error } = await res.json();
    expect(error).toContain('qwen');
    expect(error).not.toContain('Gemini');
  });

  it('coerces wrong-typed notes and elements rather than failing the insert', async () => {
    answers('{"verdict":"pass","notes":{"x":1},"visibleElements":"hp bar"}');
    const res = await call(valid);
    expect(res.status).toBe(200);
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ notes: '', elements: [] }));
  });

  it('keeps only the string entries of a mixed element list', async () => {
    answers('{"verdict":"pass","visibleElements":["hp",3,null,"mp"]}');
    await call(valid);
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ elements: ['hp', 'mp'] }));
  });

});

describe('a verdict the store could not record', () => {
  it('a verdict the store refused still reaches the caller and says it was not recorded', async () => {
    answers('{"verdict":"pass"}');
    mockRecord.mockImplementationOnce(() => { throw new Error('SQLITE_BUSY'); });
    const res = await call(valid);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.verdict).toBe('pass');
    expect(body.data.recorded).toBe(false);
    expect(body.data.recordError).toContain('SQLITE_BUSY');
    expect(mockEmit).not.toHaveBeenCalled(); // no server-side eval.visual receiver exists
  });
});
