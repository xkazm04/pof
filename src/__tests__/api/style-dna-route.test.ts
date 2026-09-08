import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Distilling is now a JOB, because the vision ceiling is deliberately 15 minutes and the
 * panel cannot await that. The two fast operations on this route — listing profiles and
 * activating one — stay synchronous: they touch SQLite and nothing else.
 */

const { mockStart, mockGet, mockActive, mockList, mockSetActive } = vi.hoisted(() => ({
  mockStart: vi.fn(),
  mockGet: vi.fn(),
  mockActive: vi.fn(),
  mockList: vi.fn(),
  mockSetActive: vi.fn(),
}));

vi.mock('@/lib/visual-gen/style-dna-job-store', () => ({
  startStyleDnaJob: mockStart,
  getStyleDnaJob: mockGet,
}));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/visual-gen/style-dna-db', () => ({
  getActiveStyleDna: mockActive,
  listStyleDna: mockList,
  setActiveStyleDna: mockSetActive,
  saveStyleDna: vi.fn(),
}));

const { POST, GET, PATCH } = await import('@/app/api/visual-gen/style-dna/route');
const { GET: STATUS } = await import('@/app/api/visual-gen/style-dna/status/route');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
function req(body: unknown) {
  return new Request('http://localhost/api/visual-gen/style-dna', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/visual-gen/style-dna — starts a job, never blocks the panel', () => {
  it('returns 202 with a jobId instead of waiting for the distiller', async () => {
    mockStart.mockReturnValue('styledna-1');
    const res = await POST(req({ images: [PNG, PNG], name: 'Ashen' }) as never);
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json.data).toMatchObject({ jobId: 'styledna-1', images: 2 });
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ashen' }));
  });

  it('still refuses an empty board before starting anything', async () => {
    const res = await POST(req({ images: [] }) as never);
    expect(res.status).toBe(400);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('still refuses a non-image data URL before starting anything', async () => {
    const res = await POST(req({ images: ['not-a-data-url'] }) as never);
    expect(res.status).toBe(400);
    expect(mockStart).not.toHaveBeenCalled();
  });
});

describe('GET /api/visual-gen/style-dna/status', () => {
  const url = (q: string) => new Request(`http://localhost/api/visual-gen/style-dna/status${q}`);

  it('reports a running job without a profile', async () => {
    mockGet.mockReturnValue({ id: 'j', status: 'running', imageCount: 3, startedAt: 0 });
    const res = await STATUS(url('?jobId=j') as never);
    const json = await res.json();
    expect(json.data).toMatchObject({ status: 'running', imageCount: 3 });
    expect(json.data.profile).toBeUndefined();
  });

  it('carries the profile once the job is done', async () => {
    mockGet.mockReturnValue({ id: 'j', status: 'done', imageCount: 3, startedAt: 0, profile: { id: 'dna-9' }, raw: 'RAW' });
    const res = await STATUS(url('?jobId=j') as never);
    const json = await res.json();
    expect(json.data.status).toBe('done');
    expect(json.data.profile).toMatchObject({ id: 'dna-9' });
  });

  it('carries the REASON on a failed job so the panel can show it', async () => {
    mockGet.mockReturnValue({ id: 'j', status: 'error', imageCount: 1, startedAt: 0, error: 'every eye refused the board' });
    const res = await STATUS(url('?jobId=j') as never);
    const json = await res.json();
    expect(json.data.status).toBe('error');
    expect(json.data.error).toMatch(/every eye refused the board/);
  });

  it('404s an unknown job rather than reporting it as still running', async () => {
    // A missing job reported as `running` is a spinner that never ends.
    mockGet.mockReturnValue(undefined);
    const res = await STATUS(url('?jobId=nope') as never);
    expect(res.status).toBe(404);
  });

  it('400s when no jobId was given', async () => {
    const res = await STATUS(url('') as never);
    expect(res.status).toBe(400);
  });
});

describe('the fast operations stay synchronous', () => {
  it('GET still lists profiles directly', async () => {
    mockActive.mockReturnValue(null);
    mockList.mockReturnValue([{ id: 'dna-1' }]);
    const json = await (await GET()).json();
    expect(json.data.profiles).toHaveLength(1);
  });

  it('PATCH still activates directly', async () => {
    mockSetActive.mockReturnValue(true);
    mockActive.mockReturnValue({ id: 'dna-1', active: true });
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ id: 'dna-1' }) }) as never);
    expect((await res.json()).data.active).toMatchObject({ id: 'dna-1' });
  });
});
