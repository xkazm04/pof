import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const listPlanned = vi.fn();
const scaffoldAll = vi.fn();
const fakeScaffoldForTest = (testName: string) => ({ testName, suggestedPath: `Source/PoF/Test/${testName}.cpp`, code: '// scaffold\n' });
const fakeBuildTask = (sf: { testName: string }) => ({ type: 'ask-claude', moduleId: 'm', prompt: `author ${sf.testName}`, label: `Scaffold ${sf.testName}` });
const scaffoldForTestImpl = vi.fn(fakeScaffoldForTest);
const buildTaskImpl = vi.fn(fakeBuildTask);
// The artifacts DB is never opened: the real plannedTests is imported only for its pure
// buildScaffoldTask (case 4), and every DB-backed listing below is mocked.
vi.mock('@/lib/pipeline-artifacts-db', () => ({ listDeferredArtifacts: () => [] }));
vi.mock('@/lib/ue-test-scaffold', async () => {
  // The source-registry half is REAL: case 3 scans a real tmp Source tree.
  const registry = await vi.importActual<typeof import('@/lib/ue-test-scaffold/sourceRegistry')>(
    '@/lib/ue-test-scaffold/sourceRegistry',
  );
  return {
    ...registry,
    listPlannedTests: (...a: unknown[]) => listPlanned(...a),
    scaffoldAllPlanned: (...a: unknown[]) => scaffoldAll(...a),
    scaffoldForTest: (testName: string) => scaffoldForTestImpl(testName),
    buildScaffoldTask: (sf: { testName: string }) => buildTaskImpl(sf),
  };
});

import { GET, POST } from '@/app/api/ue-test-scaffold/route';
import { generateScaffold } from '@/lib/ue-test-scaffold/generate';
import { buildScaffoldTask } from '@/lib/ue-test-scaffold/plannedTests';

const post = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/ue-test-scaffold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  scaffoldForTestImpl.mockReset().mockImplementation(fakeScaffoldForTest);
  buildTaskImpl.mockReset().mockImplementation(fakeBuildTask);
  listPlanned.mockReset().mockReturnValue([{ catalogId: 'items', entityId: 'sword', step: 'Test Gate', testName: 'VSSwordTest' }]);
  scaffoldAll.mockReset().mockReturnValue([
    { testName: 'VSSwordTest', scaffold: { testName: 'VSSwordTest', suggestedPath: 'p.cpp', code: '// c' }, requestedBy: [] },
  ]);
});

describe('POST /api/ue-test-scaffold — the fake dispatch action is gone', () => {
  it("refuses action:'dispatch' and explains that nothing could ever have been enqueued", async () => {
    const res = await POST(post({ action: 'dispatch' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('has been removed');
    expect(json.error).toContain('queue is client-side');
    expect(json.error).toContain("action:'authoring-tasks'");
  });

  it("action:'authoring-tasks' returns the task prompts and claims NO dispatch", async () => {
    const res = await POST(post({ action: 'authoring-tasks' }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // The old response said `dispatched: N` — a count of work that never happened.
    expect(data.dispatched).toBeUndefined();
    expect(data.enqueued).toBe(false);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].task.prompt).toContain('author VSSwordTest');
    expect(data.note).toContain('Nothing was queued or started');
  });

  it('404s authoring-tasks when the filter matches no planned test', async () => {
    scaffoldAll.mockReturnValue([]);
    expect((await POST(post({ action: 'authoring-tasks' }))).status).toBe(404);
  });

  it('leaves the default scaffold action untouched', async () => {
    const res = await POST(post({ testName: 'VSSwordTest' }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.scaffold).toMatchObject({ testName: 'VSSwordTest' });
  });
});

// ── ue5-build-bridge/B: presence from the UE Source tree + the scaffold the task embeds ─────────

const PLANNED = [
  { catalogId: 'codex', entityId: 'page', step: 'Test Gate', tier: 'L3', testName: 'VSCodexUnlockTest', scaffoldAvailable: true },
  { catalogId: 'dialog', entityId: 'branch', step: 'Test Gate', tier: 'L3', testName: 'VSDialogBranchTest', scaffoldAvailable: true },
];
const get = (qs = '') => new NextRequest(`http://localhost/api/ue-test-scaffold${qs}`);

describe('GET /api/ue-test-scaffold?projectPath= (case 3)', () => {
  let root = '';
  beforeEach(() => {
    listPlanned.mockReturnValue(PLANNED);
    root = mkdtempSync(join(tmpdir(), 'pof-scaffold-route-'));
    mkdirSync(join(root, 'Proj', 'Source', 'PoF', 'Test'), { recursive: true });
    writeFileSync(
      join(root, 'Proj', 'Source', 'PoF', 'Test', 'A.cpp'),
      'IMPLEMENT_SIMPLE_AUTOMATION_TEST(FVSCodexUnlockTest, "Project.Functional Tests.PoF.Codex.VSCodexUnlockTest", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)\n',
    );
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('annotates every planned test with its presence in the scanned Source tree', async () => {
    const res = await GET(get(`?projectPath=${encodeURIComponent(join(root, 'Proj'))}`));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.map((p: { testName: string; presence: string }) => [p.testName, p.presence])).toEqual([
      ['VSCodexUnlockTest', 'in-source'],
      ['VSDialogBranchTest', 'not-in-source'],
    ]);
  });

  it('without projectPath the payload is byte-identical to today (no presence field)', async () => {
    const res = await GET(get());
    expect(await res.text()).toBe(JSON.stringify({ success: true, data: PLANNED }));
  });

  it("refuses a projectPath containing '..' with 400", async () => {
    const res = await GET(get(`?projectPath=${encodeURIComponent(`${join(root, 'Proj')}/../Proj`)}`));
    expect(res.status).toBe(400);
  });
});

describe("POST authoring-tasks carries the scaffold it embedded (case 4)", () => {
  it('tasks[0].scaffold = {suggestedPath, code} and the task prompt contains that code verbatim', async () => {
    // The real generator + the real task builder (plannedTests is not mocked, only the index).
    scaffoldForTestImpl.mockImplementation((n: string) => generateScaffold(n) as never);
    buildTaskImpl.mockImplementation(buildScaffoldTask as never);

    const res = await POST(post({ action: 'authoring-tasks', testName: 'VSDialogBranchTest' }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.enqueued).toBe(false);
    const expected = generateScaffold('VSDialogBranchTest');
    expect(data.tasks[0].scaffold).toEqual({ suggestedPath: `Source/PoF/Test/${expected.parsed.fileName}`, code: expected.code });
    expect(data.tasks[0].task.prompt).toContain(data.tasks[0].scaffold.code);
    expect(data.tasks[0].task.label).toBe('Scaffold VSDialogBranchTest');
  });
});
