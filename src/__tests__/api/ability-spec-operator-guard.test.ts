/**
 * POST /api/ability-spec and /api/ability-spec/codegen write the ability_specs
 * source-of-record (the GAS codegen input), keyed by catalogId/entityId like
 * /api/catalog-entities, so they are operator-guarded the same way: a cross-site
 * browser request is refused (403) and, when POF_OPERATOR_TOKEN is set, a
 * token-less call is refused (401). Header-less server-to-server callbacks pass.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { upsert, setReport } = vi.hoisted(() => ({ upsert: vi.fn(), setReport: vi.fn() }));
vi.mock('@/lib/ability/ability-spec-db', () => ({
  getSpec: () => null,
  upsertSpec: (w: unknown) => upsert(w),
  setCodegenReport: (...a: unknown[]) => setReport(...a),
}));

import { POST as specPost } from '@/app/api/ability-spec/route';
import { POST as codegenPost } from '@/app/api/ability-spec/codegen/route';

const savedToken = process.env.POF_OPERATOR_TOKEN;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.POF_OPERATOR_TOKEN;
  upsert.mockReturnValue({ ok: true });
  setReport.mockReturnValue({ ok: true });
});
afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

function mk(path: string, body: unknown, headers: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost:3001${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', host: 'localhost:3001', ...headers },
    body: JSON.stringify(body),
  });
}
const SPEC = { catalogId: 'spellbook', entityId: 'e1', effects: [], tagRules: [] };
const REPORT = { catalogId: 'spellbook', entityId: 'e1', filesWritten: [], buildOk: true, seedRan: true, dataTableRows: 1, missingTags: [] };

describe('ability-spec operator guard', () => {
  it('refuses a cross-site spec POST with 403 and writes nothing', async () => {
    const res = await specPost(mk('/api/ability-spec', SPEC, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('refuses a token-less spec POST with 401 when a token is set', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await specPost(mk('/api/ability-spec', SPEC, {}));
    expect(res.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('accepts a header-less spec POST', async () => {
    const res = await specPost(mk('/api/ability-spec', SPEC, {}));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
  it('refuses a cross-site codegen POST with 403 and writes nothing', async () => {
    const res = await codegenPost(mk('/api/ability-spec/codegen', REPORT, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(setReport).not.toHaveBeenCalled();
  });
  it('refuses a token-less codegen POST with 401 when a token is set', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await codegenPost(mk('/api/ability-spec/codegen', REPORT, {}));
    expect(res.status).toBe(401);
  });
  it('accepts a header-less codegen POST', async () => {
    const res = await codegenPost(mk('/api/ability-spec/codegen', REPORT, {}));
    expect(res.status).toBe(200);
    expect(setReport).toHaveBeenCalledTimes(1);
  });
});
