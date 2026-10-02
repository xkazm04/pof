/**
 * Import a stored harness run from the Director: list the project's runs,
 * preview the session (writes nothing), import it through the SAME completion
 * pipeline as every other completion, and refuse a re-import — sequential or
 * concurrent — naming the session that already holds the run.
 *
 * Throwaway DB in a unique mkdtemp dir per file (never ~/.pof/pof.db, never a
 * pid-named path), removed afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { renderHook, render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import type { GamePlan, ProgressEntry } from '@/lib/harness/types';
import type { PlaytestSession, DirectorEvent } from '@/types/game-director';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-gd-harness-import-'));
process.env.POF_DB_PATH = path.join(TMP, 'pof.db');

type DbMod = typeof import('@/lib/db');
type GdMod = typeof import('@/lib/game-director-db');
type HrMod = typeof import('@/lib/harness-runs-db');
type GdRoute = typeof import('@/app/api/game-director/route');
type HookMod = typeof import('@/hooks/useGameDirector');
let dbm: DbMod;
let gd: GdMod;
let hr: HrMod;
let route: GdRoute;
let hook: HookMod;

beforeAll(async () => {
  dbm = await import('@/lib/db');
  gd = await import('@/lib/game-director-db');
  hr = await import('@/lib/harness-runs-db');
  route = await import('@/app/api/game-director/route');
  hook = await import('@/hooks/useGameDirector');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

afterAll(() => {
  try { dbm?.getDb().close(); } catch { /* already closed */ }
  fs.rmSync(TMP, { recursive: true, force: true });
});

// The harness stores the raw project path; the Director's projectId is the same
// path, possibly spelled differently — the join must be normalized.
const PROJECT_RAW = 'C:\\Games\\ImportProj';
const PROJECT_ID = 'C:/Games/ImportProj';

function plan(overrides: Partial<GamePlan> = {}): GamePlan {
  return {
    game: 'ImportProj',
    projectPath: PROJECT_RAW,
    ueVersion: '5.7.3',
    iteration: 7,
    totalFeatures: 20,
    passingFeatures: 14,
    verifiedFeatures: 12,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    areas: [
      {
        id: 'combat-core', moduleId: 'arpg-combat', label: 'Combat core', description: '',
        checklistItemIds: [], featureNames: [], dependsOn: [], status: 'failed', features: [],
      },
      {
        id: 'enemy-ai', moduleId: 'arpg-enemy-ai', label: 'Enemy AI', description: '',
        checklistItemIds: [], featureNames: [], dependsOn: [], status: 'completed', features: [],
      },
    ],
    ...overrides,
  };
}

const PROGRESS: ProgressEntry[] = [
  {
    iteration: 7, timestamp: '2026-09-20T10:30:00.000Z', areaId: 'combat-core', moduleId: 'arpg-combat',
    action: 'execute', outcome: 'failure', summary: 'Hit-stop missing.', durationMs: 90000,
    featuresChanged: [], verification: 'fail', errors: ['ue-test: HitStop.Duration expected 0.08'],
  },
  {
    iteration: 7, timestamp: '2026-09-20T10:50:00.000Z', areaId: 'enemy-ai', moduleId: 'arpg-enemy-ai',
    action: 'execute', outcome: 'partial', summary: 'Aggro radius ok, leash broken.', durationMs: 45000,
    featuresChanged: [], verification: 'fail',
  },
];

/** Seed one run exactly as the orchestrator does: startRun, then finalizeRun. */
function seedRun(runId: string, opts: { projectPath?: string; plan?: GamePlan; startedAt?: string } = {}) {
  const p = opts.plan ?? plan();
  hr.startRun({
    runId,
    projectName: 'ImportProj',
    projectPath: opts.projectPath ?? PROJECT_RAW,
    startedAt: opts.startedAt ?? '2026-09-20T10:00:00.000Z',
    plan: p,
    cost: null,
  });
  hr.finalizeRun({
    runId, status: 'completed', endedAt: '2026-09-20T12:00:00.000Z',
    plan: p, progress: PROGRESS, guide: null, cost: null,
  });
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function get(query: string): Request {
  return new Request(`http://localhost/api/game-director?${query}`);
}

type Envelope<T> = { success: boolean; data: T; error?: string; details?: { sessionId?: string } };
async function json<T>(res: Response): Promise<Envelope<T>> {
  return res.json() as Promise<Envelope<T>>;
}

function sessionsForRun(runId: string): PlaytestSession[] {
  return gd.listSessions().filter((s) => s.config?.harnessRunId === runId);
}

interface RunRow {
  runId: string; projectName: string; iteration: number; passRate: number;
  startedAt: string; ingestedSessionId: string | null;
}
interface Preview {
  runId: string; contract: { buildId: string }; findingsCount: number;
  unrouted: unknown[]; rejected: unknown[]; overallScore: number; sessionName: string;
  ingestedSessionId: string | null;
}
interface Imported { sessionId: string; findingsWritten: number }

describe('GET ?action=harness-runs', () => {
  it('case 2: one row per run of the project (normalized path join), none ingested yet', async () => {
    seedRun('run-list-a', { startedAt: '2026-09-20T10:00:00.000Z' });
    seedRun('run-list-b', { startedAt: '2026-09-21T10:00:00.000Z' });
    seedRun('run-other', { projectPath: 'D:\\Elsewhere\\Other' });

    const res = await json<RunRow[]>(await route.GET(get(`action=harness-runs&projectId=${encodeURIComponent(PROJECT_ID)}`)));
    expect(res.success).toBe(true);
    const ids = res.data.map((r) => r.runId);
    expect(ids).toContain('run-list-a');
    expect(ids).toContain('run-list-b');
    expect(ids).not.toContain('run-other');
    const a = res.data.find((r) => r.runId === 'run-list-a');
    expect(a).toMatchObject({
      runId: 'run-list-a',
      projectName: 'ImportProj',
      iteration: 7,
      passRate: expect.any(Number),
      startedAt: '2026-09-20T10:00:00.000Z',
      ingestedSessionId: null,
    });
  });

  it('projectId is required — an unscoped list is refused, not widened', async () => {
    const res = await route.GET(get('action=harness-runs'));
    expect(res.status).toBe(400);
  });
});

describe('POST preview-harness-run', () => {
  it('case 3: previews the buildIngestPlan projection and writes no session', async () => {
    seedRun('run-preview');
    const before = gd.listSessions().length;
    const res = await route.POST(post({ action: 'preview-harness-run', runId: 'run-preview', projectId: PROJECT_ID }));
    expect(res.status).toBe(200);
    const body = await json<Preview>(res);
    expect(body.data).toMatchObject({
      runId: 'run-preview',
      contract: { buildId: 'ImportProj@UE5.7.3#iter7' },
      findingsCount: 2,
      unrouted: [],
      rejected: [],
      overallScore: 60,
      sessionName: 'ImportProj harness run — ImportProj@UE5.7.3#iter7',
      ingestedSessionId: null,
    });
    expect(gd.listSessions().length).toBe(before);
  });

  it('case 4: a record failing the session contract -> 400 with validateRunRecord\'s reason; 0 sessions', async () => {
    seedRun('run-bad', { plan: plan({ areas: [] }) });
    const before = gd.listSessions().length;
    const res = await route.POST(post({ action: 'preview-harness-run', runId: 'run-bad' }));
    expect(res.status).toBe(400);
    const body = await json<unknown>(res);
    expect(body.error).toContain('Run record declares no areas');

    // The same reason ingest-external gives the same record.
    const raw = await json<unknown>(await route.POST(post({
      action: 'ingest-external', run: { plan: plan({ areas: [] }), progress: PROGRESS },
    })));
    expect(raw.error).toBe(body.error);

    const imp = await route.POST(post({ action: 'ingest-harness-run', runId: 'run-bad', projectId: PROJECT_ID }));
    expect(imp.status).toBe(400);
    expect(gd.listSessions().length).toBe(before);
  });

  it('an unknown run -> 404', async () => {
    const res = await route.POST(post({ action: 'preview-harness-run', runId: 'no-such-run' }));
    expect(res.status).toBe(404);
  });
});

describe('POST ingest-harness-run', () => {
  it('case 5: writes an external session carrying config.harnessRunId, findings === preview count', async () => {
    seedRun('run-ingest');
    const preview = await json<Preview>(await route.POST(post({ action: 'preview-harness-run', runId: 'run-ingest', projectId: PROJECT_ID })));
    const res = await route.POST(post({ action: 'ingest-harness-run', runId: 'run-ingest', projectId: PROJECT_ID }));
    expect(res.status).toBe(200);
    const body = await json<Imported>(res);
    const session = gd.getSession(body.data.sessionId);
    expect(session?.source).toBe('external');
    expect(session?.status).toBe('complete');
    expect(session?.config.harnessRunId).toBe('run-ingest');
    expect(session?.config.projectId).toBe(PROJECT_ID);
    expect(gd.getFindings(body.data.sessionId)).toHaveLength(preview.data.findingsCount);
    expect(body.data.findingsWritten).toBe(preview.data.findingsCount);

    // Same completion pipeline as every other completion: routed + analyzed, both disclosed.
    const events: DirectorEvent[] = gd.getEvents(body.data.sessionId, 500);
    expect(events.some((e) => e.message.startsWith('Matrix routing'))).toBe(true);
    expect(events.some((e) => e.message.startsWith('Regression analysis'))).toBe(true);
  });

  it('case 6: a second import of the same run -> 409 naming the existing session; count stays 1', async () => {
    seedRun('run-twice');
    const first = await json<Imported>(await route.POST(post({ action: 'ingest-harness-run', runId: 'run-twice', projectId: PROJECT_ID })));
    const again = await route.POST(post({ action: 'ingest-harness-run', runId: 'run-twice', projectId: PROJECT_ID }));
    expect(again.status).toBe(409);
    const body = await json<unknown>(again);
    expect(body.error).toContain(first.data.sessionId);
    expect(body.details?.sessionId).toBe(first.data.sessionId);
    expect(sessionsForRun('run-twice')).toHaveLength(1);

    // The preview now says so too.
    const preview = await json<Preview>(await route.POST(post({ action: 'preview-harness-run', runId: 'run-twice' })));
    expect(preview.data.ingestedSessionId).toBe(first.data.sessionId);
  });

  it('coordinator case: two CONCURRENT imports of one run -> one 200, one 409, exactly one session', async () => {
    seedRun('run-race');
    const [a, b] = await Promise.all([
      route.POST(post({ action: 'ingest-harness-run', runId: 'run-race', projectId: PROJECT_ID })),
      route.POST(post({ action: 'ingest-harness-run', runId: 'run-race', projectId: PROJECT_ID })),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const sessions = sessionsForRun('run-race');
    expect(sessions).toHaveLength(1);
    const loser = await json<unknown>(a.status === 409 ? a : b);
    expect(loser.details?.sessionId).toBe(sessions[0].id);
  });

  it('case 7: harness-runs reports ingestedSessionId, and the hook resolves the new session id', async () => {
    seedRun('run-hook');
    // Relative /api/... fetches go straight to the route handlers.
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(new URL(String(input), 'http://localhost'), init);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') return route.POST(req);
      if (method === 'DELETE') return route.DELETE(req);
      return route.GET(req);
    });

    const { result } = renderHook(() => hook.useGameDirector());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const runs = await result.current.listHarnessRuns(PROJECT_ID);
    expect(runs.find((r) => r.runId === 'run-hook')?.ingestedSessionId).toBeNull();

    let sessionId = '';
    await act(async () => {
      sessionId = await result.current.ingestHarnessRun('run-hook', PROJECT_ID);
    });
    expect(sessionId).toMatch(/^gd-/);
    expect(result.current.sessions.some((s) => s.id === sessionId)).toBe(true);

    const after = await json<RunRow[]>(await route.GET(get(`action=harness-runs&projectId=${encodeURIComponent(PROJECT_ID)}`)));
    expect(after.data.find((r) => r.runId === 'run-hook')?.ingestedSessionId).toBe(sessionId);

    // A re-import through the hook rejects with the existing session id attached.
    await expect(result.current.ingestHarnessRun('run-hook', PROJECT_ID)).rejects.toMatchObject({
      existingSessionId: sessionId,
    });
  });
});

describe('[guard] the raw ingest-external door', () => {
  it('case 8: a raw record still ingests exactly as today (no run identity, not deduplicated)', async () => {
    const run = { plan: plan({ game: 'RawDoor' }), progress: PROGRESS };
    const one = await json<Imported>(await route.POST(post({ action: 'ingest-external', run, projectId: PROJECT_ID })));
    const two = await json<Imported>(await route.POST(post({ action: 'ingest-external', run, projectId: PROJECT_ID })));
    expect(one.success).toBe(true);
    expect(two.success).toBe(true);
    expect(one.data.sessionId).not.toBe(two.data.sessionId);
    const s = gd.getSession(one.data.sessionId);
    expect(s?.source).toBe('external');
    expect(s?.config.harnessRunId).toBeUndefined();
    expect(one.data.findingsWritten).toBe(2);
  });
});

describe('HarnessRunImport UI: preview first, import only on an explicit click', () => {
  const RUN_ROW = {
    runId: 'run-ui', projectName: 'ImportProj', projectPath: PROJECT_RAW, status: 'completed',
    startedAt: '2026-09-20T10:00:00.000Z', endedAt: null, iteration: 7, passRate: 70, ingestedSessionId: null,
  };
  const PREVIEW = {
    runId: 'run-ui', contract: { buildId: 'ImportProj@UE5.7.3#iter7' }, findingsCount: 2, unrouted: [],
    rejected: [], overallScore: 60, sessionName: 'ImportProj harness run', ingestedSessionId: null,
  };

  it('selecting a run previews it without importing; Import writes and opens the session', async () => {
    const { HarnessRunImport } = await import('@/components/modules/game-director/NewSessionPanel/HarnessRunImport');
    const listHarnessRuns = vi.fn().mockResolvedValue([RUN_ROW]);
    const previewHarnessRun = vi.fn().mockResolvedValue(PREVIEW);
    const ingestHarnessRun = vi.fn().mockResolvedValue('gd-new');
    const onOpenSession = vi.fn();
    render(
      <HarnessRunImport
        projectPath={PROJECT_ID}
        listHarnessRuns={listHarnessRuns}
        previewHarnessRun={previewHarnessRun as never}
        ingestHarnessRun={ingestHarnessRun}
        onOpenSession={onOpenSession}
      />,
    );
    fireEvent.click(await screen.findByText('run-ui'));
    expect(await screen.findByText('ImportProj@UE5.7.3#iter7')).toBeTruthy();
    expect(previewHarnessRun).toHaveBeenCalledWith('run-ui', PROJECT_ID);
    expect(ingestHarnessRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Import as session/ }));
    await waitFor(() => expect(onOpenSession).toHaveBeenCalledWith('gd-new'));
    expect(ingestHarnessRun).toHaveBeenCalledWith('run-ui', PROJECT_ID);
  });

  it('a refused re-import names the existing session and offers to open it', async () => {
    const { HarnessRunImport } = await import('@/components/modules/game-director/NewSessionPanel/HarnessRunImport');
    const { HarnessImportError } = await import('@/hooks/useGameDirector');
    const onOpenSession = vi.fn();
    render(
      <HarnessRunImport
        projectPath={PROJECT_ID}
        listHarnessRuns={vi.fn().mockResolvedValue([RUN_ROW])}
        previewHarnessRun={vi.fn().mockResolvedValue(PREVIEW) as never}
        ingestHarnessRun={vi.fn().mockRejectedValue(new HarnessImportError('Harness run run-ui is already imported as session gd-old', 'gd-old'))}
        onOpenSession={onOpenSession}
      />,
    );
    fireEvent.click(await screen.findByText('run-ui'));
    fireEvent.click(await screen.findByRole('button', { name: /Import as session/ }));
    const open = await screen.findByRole('button', { name: /Open session gd-old/ });
    fireEvent.click(open);
    expect(onOpenSession).toHaveBeenCalledWith('gd-old');
  });
});
