/**
 * The house refusal shape across the mesh routes: a body or field the caller got wrong is a
 * 400 that starts nothing. Every process and vision seam is mocked, so no test here can reach
 * Blender, the editor or a paid provider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const seams = vi.hoisted(() => ({
  startFinish: vi.fn(() => 'finish-1'),
  startView: vi.fn(() => 'view-1'),
  getView: vi.fn(),
  startImport: vi.fn(() => 'import-1'),
  split: vi.fn(),
  critique: vi.fn(async () => ({ ok: false, unavailable: true, error: 'mocked' })),
  decompose: vi.fn(),
}));

vi.mock('@/lib/visual-gen/mesh-finish-job-store', () => ({ startMeshFinishJob: seams.startFinish }));
vi.mock('@/lib/visual-gen/view-gate-job-store', () => ({ startViewGateJob: seams.startView, getViewGateJob: seams.getView }));
vi.mock('@/lib/visual-gen/ue-import-job-store', () => ({ startUeImportJob: seams.startImport, importStageFor: () => 'raw' }));
vi.mock('@/lib/visual-gen/mesh-split', async (original) => ({
  ...(await original<typeof import('@/lib/visual-gen/mesh-split')>()),
  runMeshSplit: seams.split,
}));
vi.mock('@/lib/visual-gen/mesh-critique', () => ({ critiqueMesh: seams.critique }));
vi.mock('@/lib/visual-gen/generators/scene-decompose', async (original) => ({
  ...(await original<typeof import('@/lib/visual-gen/generators/scene-decompose')>()),
  decomposeScene: seams.decompose,
}));

import { POST as finish } from '@/app/api/visual-gen/mesh-finish/route';
import { POST as remediate } from '@/app/api/visual-gen/mesh-finish/remediate/route';
import { POST as split } from '@/app/api/visual-gen/mesh-split/route';
import { POST as decompose } from '@/app/api/visual-gen/scene-decompose/route';
import { POST as viewGate } from '@/app/api/visual-gen/view-gate/route';
import { GET as viewGateStatus } from '@/app/api/visual-gen/view-gate/status/route';
import { POST as ueImport } from '@/app/api/visual-gen/ue-import/route';
import { POST as uePlan } from '@/app/api/visual-gen/ue-import/plan/route';

type Handler = (req: NextRequest) => Promise<Response>;

const ROUTES: ReadonlyArray<readonly [string, Handler]> = [
  ['mesh-finish', finish],
  ['mesh-finish/remediate', remediate],
  ['mesh-split', split],
  ['scene-decompose', decompose],
  ['view-gate', viewGate],
  ['ue-import', ueImport],
  ['ue-import/plan', uePlan],
];

const raw = (body: string, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/visual-gen/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
const json = (body: unknown) => raw(JSON.stringify(body));

let root = '';
let glb = '';

beforeEach(() => {
  vi.clearAllMocks();
  root = mkdtempSync(join(tmpdir(), 'pof-mesh-routes-'));
  mkdirSync(join(root, 'generated', 'meshes'), { recursive: true });
  glb = join(root, 'generated', 'meshes', 'crate.glb').replace(/\\/g, '/');
  writeFileSync(glb, 'glb');
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

function expectNothingStarted() {
  for (const seam of [seams.startFinish, seams.startView, seams.startImport, seams.split, seams.critique, seams.decompose]) {
    expect(seam).not.toHaveBeenCalled();
  }
}

describe('malformed bodies', () => {
  for (const [name, handler] of ROUTES) {
    for (const [label, body] of [['broken JSON', '{nope'], ['an array', '[]'], ['null', 'null']] as const) {
      it(`${name} answers 400 to ${label} and starts nothing`, async () => {
        const res = await handler(raw(body));
        expect(res.status).toBe(400);
        expectNothingStarted();
      });
    }
  }
});

describe('operator guard', () => {
  for (const [name, handler] of ROUTES) {
    it(`${name} refuses a cross-site browser request before reading the body`, async () => {
      const res = await handler(raw('{}', { origin: 'https://evil.example', host: 'localhost' }));
      expect(res.status).toBe(403);
      expectNothingStarted();
    });
  }
});

describe('view-gate status', () => {
  it('reports the reference-conformance answer the caller asked for', async () => {
    const memberConformance = { verdict: 'fail', reason: 'a barrel, not a crate' };
    seams.getView.mockReturnValue({
      status: 'done',
      verdict: 'pass',
      conformance: 'fail',
      members: [{ name: 'crate', meshPath: 'crate.glb', conformance: memberConformance }],
      startedAt: 1,
    });
    const res = await viewGateStatus(new NextRequest('http://localhost/api/visual-gen/view-gate/status?jobId=v1'));
    const { data } = await res.json();
    expect(data.conformance).toBe('fail');
    expect(data.members[0].conformance).toEqual(memberConformance);
  });
});

// FINDINGS-APPEND
