import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ingestExternalPlaytest,
  buildIngestPlan,
  validateRunRecord,
  MODULE_TO_FINDING_CATEGORY,
  type DirectorWriter,
  type HarnessRunRecord,
} from '@/lib/game-director/external-ingest';
import type {
  CreateSessionPayload,
  DirectorEvent,
  PlaytestFinding,
  PlaytestStatus,
  PlaytestSummary,
} from '@/types/game-director';
import { resolveConfidence } from '@/types/game-director';

/**
 * The fixture is a trimmed slice of a REAL, committed harness run record —
 * `.harness-dzin/game-plan.json` + `.harness-dzin/progress.json` — the only
 * run-record shape in this repo with on-disk examples. No live UE run was
 * performed to produce it.
 */
const FIXTURE: HarnessRunRecord = {
  plan: {
    game: 'PoF-Dzin',
    projectPath: 'C:/Users/kazda/kiro/pof',
    ueVersion: '5.7.3',
    iteration: 18,
    totalFeatures: 40,
    passingFeatures: 30,
    verifiedFeatures: 20,
    createdAt: '2026-04-01T13:00:00.000Z',
    updatedAt: '2026-04-01T13:30:00.000Z',
    areas: [
      {
        id: 'dzin-enemy-world-panels',
        moduleId: 'arpg-enemy-ai',
        label: 'Enemy AI & World Panels',
        description: 'Enemy/world/progression panels',
        checklistItemIds: [],
        featureNames: [],
        dependsOn: [],
        status: 'completed',
        features: [],
      },
      {
        id: 'dzin-character-panels',
        moduleId: 'arpg-character',
        label: 'Character & Animation Panels',
        description: 'Character panels',
        checklistItemIds: [],
        featureNames: [],
        dependsOn: [],
        status: 'completed',
        features: [],
      },
    ],
  },
  progress: [
    {
      iteration: 2,
      timestamp: '2026-04-01T13:11:06.583Z',
      areaId: 'dzin-enemy-world-panels',
      moduleId: 'arpg-enemy-ai',
      action: 'execute',
      outcome: 'success',
      summary: 'All 6 enemy AI, world, and progression panels implemented.',
      durationMs: 302166,
      featuresChanged: [],
    },
    {
      iteration: 18,
      timestamp: '2026-04-01T13:23:07.776Z',
      areaId: 'dzin-enemy-world-panels',
      moduleId: 'arpg-enemy-ai',
      action: 'execute',
      outcome: 'partial',
      summary: 'Panels reviewed — the radar data was non-deterministic because Math.random() ran at module scope.',
      durationMs: 70791,
      featuresChanged: [],
      errors: ["src/app/api/agents/advisor/route.ts  129:13  error  'hasServerTools' is never reassigned"],
      learnings: ['ProgressionCurvesPanel had non-deterministic Math.random() in radar data at module scope'],
      verification: 'fail',
    },
    {
      iteration: 19,
      timestamp: '2026-04-01T13:26:07.776Z',
      areaId: 'dzin-character-panels',
      moduleId: 'arpg-character',
      action: 'execute',
      outcome: 'failure',
      summary: 'Character panels failed their gate.',
      durationMs: 1000,
      featuresChanged: [],
      verification: 'fail',
    },
  ],
};

interface Recorded {
  created: CreateSessionPayload[];
  statuses: { sessionId: string; status: PlaytestStatus }[];
  findings: PlaytestFinding[];
  events: DirectorEvent[];
  completed: { sessionId: string; summary: PlaytestSummary; findingsCount: number }[];
}

function recordingWriter(): { writer: DirectorWriter; log: Recorded } {
  const log: Recorded = { created: [], statuses: [], findings: [], events: [], completed: [] };
  const writer: DirectorWriter = {
    async createSession(payload) {
      log.created.push(payload);
      return { id: 'gd-test-session' };
    },
    async updateStatus(sessionId, status) {
      log.statuses.push({ sessionId, status });
    },
    async addFinding(finding) {
      log.findings.push(finding);
    },
    async addEvent(event) {
      log.events.push(event);
    },
    async complete({ sessionId, summary, findingsCount }) {
      log.completed.push({ sessionId, summary, findingsCount });
    },
  };
  return { writer, log };
}

const NOW = () => Date.parse('2026-09-05T10:00:00.000Z');

describe('ingestExternalPlaytest — the first producer of an external session', () => {
  it('lands a completed session stamped external with at least one finding', async () => {
    const { writer, log } = recordingWriter();
    const result = await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Provenance is declared on create AND re-stated on complete.
    expect(log.created).toHaveLength(1);
    expect(log.created[0].source).toBe('external');
    expect(log.findings.length).toBeGreaterThanOrEqual(1);
    expect(log.completed).toHaveLength(1);
    expect(log.completed[0].findingsCount).toBe(log.findings.length);
    expect(log.statuses.map((s) => s.status)).toEqual(['launching', 'playing', 'analyzing']);
    expect(result.data.sessionId).toBe('gd-test-session');
  });

  it('routes a finding to the module the record named, with no default bucket', async () => {
    const { writer, log } = recordingWriter();
    await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });

    const enemy = log.findings.find((f) => f.relatedModule === 'arpg-enemy-ai');
    expect(enemy).toBeDefined();
    expect(enemy?.category).toBe(MODULE_TO_FINDING_CATEGORY['arpg-enemy-ai']);

    // arpg-character has no finding-category route: it must NOT be filed under
    // a catch-all, it must be named as an unrouted entry.
    expect(log.findings.some((f) => f.relatedModule === 'arpg-character')).toBe(false);
  });

  it('reports the routing-table miss as a named state rather than hiding it', async () => {
    const { writer, log } = recordingWriter();
    const result = await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.unrouted).toHaveLength(1);
    expect(result.data.unrouted[0].moduleId).toBe('arpg-character');
    expect(log.events.some((e) => e.message.includes('Routing-table miss'))).toBe(true);
  });

  it('gives every finding a repro pointer and states frequency with its denominator', async () => {
    const { writer, log } = recordingWriter();
    await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });

    for (const finding of log.findings) {
      expect(finding.description).toContain('Repro:');
      expect(finding.description).toContain('re-run harness area');
      expect(finding.description).toMatch(/Frequency: \d+ of \d+ recorded iteration/);
    }
  });

  it('keeps the agent narration out of the observation field', async () => {
    const { writer, log } = recordingWriter();
    await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });

    const finding = log.findings[0];
    expect(finding.description).not.toContain('Panels reviewed');
    expect(finding.suggestedFix).toContain('interpretation');
    expect(finding.suggestedFix).toContain('Panels reviewed');
  });

  it('never invents a confidence number for a gate verdict', async () => {
    const { writer, log } = recordingWriter();
    await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });

    for (const finding of log.findings) {
      expect(resolveConfidence(finding).kind).toBe('unscored');
    }
  });

  it('writes coverage and playtime as not-measured, never as zero', async () => {
    const { writer, log } = recordingWriter();
    await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });

    const summary = log.completed[0].summary;
    expect(summary.playtimeSeconds).toBeNull();
    expect(summary.totalScreenshotsAnalyzed).toBeNull();
    expect(Object.values(summary.testCoverage).every((v) => v === null)).toBe(true);
  });

  it('scores the run as the plan pass-ratio and says which basis it used', async () => {
    const { writer, log } = recordingWriter();
    await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });

    // verifiedFeatures 20 / totalFeatures 40 — the gate-verified basis, never
    // the higher self-reported 30.
    expect(log.completed[0].summary.overallScore).toBe(50);
    expect(log.completed[0].summary.topPraise).toContain('gate-verified');
  });

  it('announces that world identity was not recorded', async () => {
    const { writer, log } = recordingWriter();
    await ingestExternalPlaytest(FIXTURE, { writer, now: NOW });
    expect(log.events[0].message).toContain('World identity');
    expect(log.events[0].message).toContain('NOT recorded');
  });
});

describe('the session contract is a gate, not a suggestion', () => {
  const cases: Array<[string, unknown, RegExp]> = [
    ['a non-object', 42, /not an object/],
    ['an empty object', {}, /no `plan`/],
    ['a plan with no build identity', { plan: { areas: [{}], totalFeatures: 1 }, progress: [{}] }, /build identity/],
    [
      'a plan with no declared coverage',
      { plan: { game: 'g', projectPath: 'p', areas: [], totalFeatures: 1 }, progress: [{}] },
      /declares no areas/,
    ],
    [
      'a run with no timeline',
      { plan: { game: 'g', projectPath: 'p', areas: [{ id: 'a' }], totalFeatures: 1 }, progress: [] },
      /no `progress` entries/,
    ],
  ];

  for (const [label, record, pattern] of cases) {
    it(`refuses ${label} with a reason`, () => {
      const result = validateRunRecord(record);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(pattern);
    });
  }

  it('writes NOTHING when the record is refused — no empty external session', async () => {
    const { writer, log } = recordingWriter();
    const result = await ingestExternalPlaytest({ plan: {}, progress: [] }, { writer, now: NOW });
    expect(result.ok).toBe(false);
    expect(log.created).toHaveLength(0);
    expect(log.completed).toHaveLength(0);
  });

  it('refuses a failing entry that carries no evidence pointer', () => {
    const noPointer: HarnessRunRecord = {
      ...FIXTURE,
      progress: [{ ...FIXTURE.progress[1], areaId: '' }],
    };
    const planned = buildIngestPlan(noPointer, { now: NOW });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.data.findings).toHaveLength(0);
    expect(planned.data.rejected).toHaveLength(1);
    expect(planned.data.rejected[0].reason).toContain('rumour');
  });
});

describe('the real on-disk harness record', () => {
  const stateDir = join(process.cwd(), '.harness-dzin');
  const planPath = join(stateDir, 'game-plan.json');
  const progressPath = join(stateDir, 'progress.json');
  const present = existsSync(planPath) && existsSync(progressPath);

  it.runIf(present)('is accepted by the session-contract gate', () => {
    const record = {
      plan: JSON.parse(readFileSync(planPath, 'utf-8')),
      progress: JSON.parse(readFileSync(progressPath, 'utf-8')),
    };
    const result = validateRunRecord(record);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const planned = buildIngestPlan(result.data, { now: NOW });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.data.create.source).toBe('external');
    expect(planned.data.contract.buildId).toContain('PoF-Dzin');
  });
});
