import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const listPlanned = vi.fn();
const scaffoldAll = vi.fn();
vi.mock('@/lib/ue-test-scaffold', () => ({
  listPlannedTests: (...a: unknown[]) => listPlanned(...a),
  scaffoldAllPlanned: (...a: unknown[]) => scaffoldAll(...a),
  scaffoldForTest: (testName: string) => ({ testName, suggestedPath: `Source/PoF/Test/${testName}.cpp`, code: '// scaffold\n' }),
  buildScaffoldTask: (sf: { testName: string }) => ({ type: 'ask-claude', moduleId: 'm', prompt: `author ${sf.testName}`, label: `Scaffold ${sf.testName}` }),
}));

import { POST } from '@/app/api/ue-test-scaffold/route';

const post = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/ue-test-scaffold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
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
