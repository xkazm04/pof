import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ start: vi.fn(() => 'job-1') }));
vi.mock('@/lib/visual-gen/style-dna-job-store', () => ({ startStyleDnaJob: h.start, getStyleDnaJob: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/visual-gen/style-dna-db', () => ({
  getActiveStyleDna: vi.fn(() => null),
  listStyleDna: vi.fn(() => []),
  setActiveStyleDna: vi.fn(() => false),
  forkStyleDna: vi.fn(),
  getStyleDna: vi.fn(() => null),
  saveStyleDna: vi.fn(),
}));

const { POST, PATCH } = await import('@/app/api/visual-gen/style-dna/route');
const { POST: FORK } = await import('@/app/api/visual-gen/style-dna/fork/route');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const raw = (body: string) => new Request('http://localhost/api/visual-gen/style-dna', { method: 'POST', body }) as never;
const json = (body: unknown) => raw(JSON.stringify(body));

beforeEach(() => h.start.mockClear());

describe('style-dna routes classify a bad body as a caller mistake', () => {
  for (const body of ['{nope', 'null', '[1]']) {
    it(`POST, PATCH and fork answer 400 for ${body}`, async () => {
      expect((await POST(raw(body))).status).toBe(400);
      expect((await PATCH(raw(body))).status).toBe(400);
      expect((await FORK(raw(body))).status).toBe(400);
    });
  }

  it.each([
    ['a string for images', { images: PNG }],
    ['a number in images', { images: [PNG, 5] }],
    ['a non-string name', { images: [PNG], name: 5 }],
  ])('POST refuses %s without starting a job', async (_l, body) => {
    expect((await POST(json(body))).status).toBe(400);
    expect(h.start).not.toHaveBeenCalled();
  });

  it('PATCH refuses a non-string id', async () => {
    expect((await PATCH(json({ id: 5 }))).status).toBe(400);
  });

  it('POST still starts a job for a valid board', async () => {
    expect((await POST(json({ images: [PNG], name: ' A ' }))).status).toBe(202);
    expect(h.start).toHaveBeenCalledOnce();
  });
});
