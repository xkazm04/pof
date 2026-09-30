import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted so the (hoisted) vi.mock factories can see them.
const m = vi.hoisted(() => ({
  listAllArtifacts: vi.fn(),
  getArtifact: vi.fn(),
  upsertArtifact: vi.fn(),
  getCatalogPipeline: vi.fn(),
  buildPackage: vi.fn(),
  staticVerdictFor: vi.fn(),
  contentVerdictFor: vi.fn(),
  gradeArtifact: vi.fn(),
}));

vi.mock('@/lib/pipeline-artifacts-db', () => ({
  listAllArtifacts: m.listAllArtifacts, getArtifact: m.getArtifact, upsertArtifact: m.upsertArtifact,
}));
vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));
vi.mock('@/lib/catalog/pipeline-registry', () => ({
  getCatalogPipeline: m.getCatalogPipeline, allCatalogPipelines: () => [],
}));
vi.mock('@/lib/catalog/packaging/packageArtifacts', () => ({
  buildPackage: m.buildPackage,
  defaultPackagingFsDeps: () => ({}),
}));
vi.mock('@/lib/catalog/acceptance/staticVerify', () => ({
  staticVerdictFor: m.staticVerdictFor, contentVerdictFor: m.contentVerdictFor,
}));
vi.mock('@/lib/catalog/headless', () => ({ gradeArtifact: m.gradeArtifact }));
vi.mock('@/lib/status/judge-verdicts-db', () => ({ listVerdicts: () => [] }));

import { GET } from '@/app/api/pipeline-artifacts/package/route';

const req = (qs: string) => new NextRequest(`http://localhost/api/pipeline-artifacts/package${qs}`);
const PIPELINE = { catalogId: 'affixes', steps: [{ label: 'Concept 2D Art' }, { label: 'UE Packaging' }] };
const ROWS = [
  { catalogId: 'affixes', entityId: 'e1', step: 'Concept 2D Art', status: 'pass', tier: 'L0', data: { art: 'generated/a.png' }, ueAssets: [] },
  { catalogId: 'affixes', entityId: 'e1', step: 'UE Packaging', status: 'deferred', tier: 'L2', reason: 'package is empty', data: { assets: ['x'] }, ueAssets: [] },
];
const CLEAN = {
  catalogId: 'affixes', entityId: 'e1', packagedAt: 't',
  files: [{ name: 'generated/a.png', sourceStep: 'Concept 2D Art', origin: 'referenced', path: 'generated/a.png', bytes: 9, sha1: 'abc' }],
  missing: [], ueDeclarations: [],
};

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.getCatalogPipeline.mockReturnValue(PIPELINE);
  m.listAllArtifacts.mockReturnValue(ROWS);
  m.getArtifact.mockImplementation((_c: string, _e: string, step: string) => ROWS.find((r) => r.step === step) ?? null);
  m.buildPackage.mockReturnValue(CLEAN);
  m.staticVerdictFor.mockReturnValue(null);
  m.contentVerdictFor.mockReturnValue(null);
  m.gradeArtifact.mockReturnValue({ graded: true, raw: { label: 'x', tier: 'L0', status: 'pass', detail: '' }, result: null });
});

describe('GET /api/pipeline-artifacts/package', () => {
  it('returns the stored row, the one writer\'s would-be verdict and the ledger — and writes no artifact', async () => {
    const res = await GET(req('?catalogId=affixes&entityId=e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.step).toBe('UE Packaging');
    expect(body.data.stored).toEqual({ status: 'deferred', tier: 'L2', reason: 'package is empty' });
    expect(body.data.verdict).toBe('pass');
    expect(body.data.ledger.state).toBe('ready');
    expect(body.data.manifest.files).toHaveLength(1);
    expect(m.upsertArtifact).not.toHaveBeenCalled();
  });

  it('verdict is the writer\'s full fold, not the disk half: a failing static check over a clean package reads fail', async () => {
    m.staticVerdictFor.mockReturnValue({ label: 'UE Packaging', tier: 'L2', status: 'fail', detail: 'static', reason: 'DT_Affixes row absent' });
    const body = await (await GET(req('?catalogId=affixes&entityId=e1'))).json();
    expect(body.data.verdict).toBe('fail');
    expect(body.data.ledger.state).toBe('ready'); // the package itself is clean — the fail is the static half
    expect(m.upsertArtifact).not.toHaveBeenCalled();
  });

  it('a sibling held at TEMPLATE shows as unverified content in the ledger', async () => {
    m.gradeArtifact.mockReturnValue({ graded: true, raw: { label: 'x', tier: 'L0', status: 'pending', detail: '', reason: 'TEMPLATE: exemplar stub' }, result: null });
    const body = await (await GET(req('?catalogId=affixes&entityId=e1'))).json();
    expect(body.data.ledger.unverified[0]).toMatchObject({ step: 'Concept 2D Art', status: 'pending', files: 1 });
    expect(body.data.ledger.state).toBe('blocked');
  });

  it('a packaging-exempt pipeline is a 404 naming the exemption reason', async () => {
    m.getCatalogPipeline.mockReturnValue({ catalogId: 'character-pipeline', steps: [{ label: 'Rig' }], packagingExempt: 'rigs ship through the character pipeline' });
    const res = await GET(req('?catalogId=character-pipeline&entityId=e1'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('rigs ship through the character pipeline');
  });

  it('missing catalogId or entityId is a 400', async () => {
    expect((await GET(req('?catalogId=affixes'))).status).toBe(400);
    expect((await GET(req('?entityId=e1'))).status).toBe(400);
  });
});
