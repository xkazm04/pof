/**
 * harness-import: the seam that turns a STORED harness run (harness_runs.plan_json
 * + progress_json) into the record `ingestExternalPlaytest` consumes, a preview
 * of exactly what the session will contain, and a single-flight import.
 *
 * Pure: no database here — the writer, the completion pipeline and the
 * "already ingested?" lookup are injected.
 */
import { describe, it, expect } from 'vitest';
import {
  harnessRunToRecord,
  previewHarnessRun,
  importHarnessRun,
  type HarnessRunSource,
} from '@/lib/game-director/harness-import';
import type { DirectorWriter } from '@/lib/game-director/external-ingest';
import type { GamePlan, ProgressEntry } from '@/lib/harness/types';
import type { CreateSessionPayload } from '@/types/game-director';

const PLAN: GamePlan = {
  game: 'PoF-Dzin',
  projectPath: 'C:/pof-import-test',
  ueVersion: '5.7.3',
  iteration: 4,
  totalFeatures: 10,
  passingFeatures: 6,
  verifiedFeatures: 5,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T11:00:00.000Z',
  areas: [
    {
      id: 'combat-core', moduleId: 'arpg-combat', label: 'Combat core', description: '',
      checklistItemIds: [], featureNames: [], dependsOn: [], status: 'failed', features: [],
    },
  ],
};

const PROGRESS: ProgressEntry[] = [
  {
    iteration: 4, timestamp: '2026-09-01T10:30:00.000Z', areaId: 'combat-core', moduleId: 'arpg-combat',
    action: 'execute', outcome: 'failure', summary: 'Combo window broke.', durationMs: 60000,
    featuresChanged: [], verification: 'fail', errors: ['ue-compile: error C2065'],
  },
  {
    iteration: 4, timestamp: '2026-09-01T10:40:00.000Z', areaId: 'combat-core', moduleId: 'arpg-combat',
    action: 'verify', outcome: 'success', summary: 'ok', durationMs: 30000, featuresChanged: [],
    verification: 'pass',
  },
];

function source(overrides: Partial<HarnessRunSource> = {}): HarnessRunSource {
  return { runId: 'run-1', plan: PLAN, progress: PROGRESS, ...overrides };
}

/** A recording writer whose createSession YIELDS before it writes — the shape
 *  that turns a check-then-create into a double write under a double click. */
function slowWriter() {
  const created: CreateSessionPayload[] = [];
  let n = 0;
  const writer: DirectorWriter = {
    async createSession(payload) {
      await new Promise((r) => setTimeout(r, 5));
      created.push(payload);
      n += 1;
      return { id: `gd-test-${n}` };
    },
    async updateStatus() {},
    async addFinding() {},
    async addEvent() {},
    async complete() {},
  };
  return { writer, created };
}

describe('harnessRunToRecord', () => {
  it('case 1a: a run with no recorded plan is refused, naming the run', () => {
    const res = harnessRunToRecord(source({ plan: null }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('run run-1 has no recorded plan');
  });

  it('case 1a\': startRun\'s "{}" placeholder for a missing plan is the same refusal', () => {
    const res = harnessRunToRecord(source({ plan: {} as unknown as GamePlan }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('run run-1 has no recorded plan');
  });

  it('case 1b: plan + progress -> the { plan, progress } pair, byte-equal to the stored JSON', () => {
    const planJson = JSON.stringify(PLAN);
    const progressJson = JSON.stringify(PROGRESS);
    const res = harnessRunToRecord(source({ plan: JSON.parse(planJson), progress: JSON.parse(progressJson) }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(JSON.stringify(res.data.plan)).toBe(planJson);
      expect(JSON.stringify(res.data.progress)).toBe(progressJson);
    }
  });
});

describe('previewHarnessRun', () => {
  it('projects buildIngestPlan to counts and names the session the import would create', () => {
    const res = previewHarnessRun(source(), { now: () => 1_000, projectId: 'C:/pof-import-test' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.runId).toBe('run-1');
    expect(res.data.contract.buildId).toBe('PoF-Dzin@UE5.7.3#iter4');
    expect(res.data.findingsCount).toBe(1);
    expect(res.data.unrouted).toEqual([]);
    expect(res.data.rejected).toEqual([]);
    expect(res.data.overallScore).toBe(50);
    expect(res.data.sessionName).toBe('PoF-Dzin harness run — PoF-Dzin@UE5.7.3#iter4');
  });

  it('a record that fails the session contract is refused with validateRunRecord\'s reason', () => {
    const res = previewHarnessRun(source({ plan: { ...PLAN, areas: [] } }), { now: () => 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/declares no areas/);
  });
});

describe('importHarnessRun single-flight', () => {
  it('two concurrent imports of one run -> one session written, the other told which session it is', async () => {
    const { writer, created } = slowWriter();
    const completed: string[] = [];
    const ingested = new Map<string, string>();
    const deps = {
      writer,
      now: () => 2_000,
      projectId: 'C:/pof-import-test',
      findIngested: (runId: string) => ingested.get(runId) ?? null,
      complete: async (sessionId: string) => { completed.push(sessionId); },
    };
    // The lookup only learns about the session once the writer returns — exactly
    // the window a check-then-create with an await in between leaves open.
    const wrapped = {
      ...deps,
      writer: {
        ...writer,
        async createSession(p: CreateSessionPayload) {
          const r = await writer.createSession(p);
          ingested.set(p.config.harnessRunId ?? '', r.id);
          return r;
        },
      },
    };

    const [a, b] = await Promise.all([
      importHarnessRun(source(), wrapped),
      importHarnessRun(source(), wrapped),
    ]);

    expect(created).toHaveLength(1);
    expect(created[0].config.harnessRunId).toBe('run-1');
    const oks = [a, b].filter((r) => r.ok);
    const dups = [a, b].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(dups).toHaveLength(1);
    const winner = oks[0];
    const loser = dups[0];
    if (winner.ok && !loser.ok) {
      expect(loser.error.kind).toBe('duplicate');
      if (loser.error.kind === 'duplicate') expect(loser.error.sessionId).toBe(winner.data.sessionId);
    }
    // The completion pipeline ran once, for the one session.
    expect(completed).toEqual(['gd-test-1']);
  });

  it('an import of a run already ingested is refused without writing', async () => {
    const { writer, created } = slowWriter();
    const res = await importHarnessRun(source(), {
      writer,
      now: () => 3_000,
      findIngested: () => 'gd-existing',
      complete: async () => {},
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('duplicate');
      if (res.error.kind === 'duplicate') expect(res.error.sessionId).toBe('gd-existing');
      expect(res.error.message).toContain('gd-existing');
    }
    expect(created).toHaveLength(0);
  });
});
