/**
 * The routing step, end to end through the route: completing a session appends
 * a queue line to the feature-matrix row that owns the finding — scoped to the
 * project, disclosed on the timeline, and tagged with the session's provenance
 * so a simulated finding can never read as an observed gap.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-writeback-${process.pid}.db`;
});

import { POST } from '@/app/api/game-director/route';
import { getEvents, createSession, getSession } from '@/lib/game-director-db';
import { upsertFeatures, getFeaturesByModule } from '@/lib/feature-matrix-db';
import type { PlaytestConfig } from '@/types/game-director';

const PROJECT = 'C:/pof-writeback-test';

const RUN = {
  plan: {
    game: 'PoF-Dzin',
    projectPath: 'C:/Users/kazda/kiro/pof',
    ueVersion: '5.7.3',
    iteration: 18,
    totalFeatures: 40,
    passingFeatures: 30,
    verifiedFeatures: 20,
    areas: [{ id: 'dzin-enemy-world-panels', moduleId: 'arpg-enemy-ai', label: 'Enemy AI & World Panels', features: [] }],
  },
  progress: [
    {
      iteration: 18,
      timestamp: '2026-04-01T13:23:07.776Z',
      areaId: 'dzin-enemy-world-panels',
      moduleId: 'arpg-enemy-ai',
      action: 'execute',
      outcome: 'partial',
      summary: 'Panels reviewed.',
      durationMs: 70791,
      featuresChanged: [],
      verification: 'fail',
    },
  ],
};

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function seedMatrix(moduleId: 'arpg-enemy-ai' | 'arpg-combat') {
  upsertFeatures(
    moduleId,
    [
      {
        featureName: 'Weak feature',
        category: 'core',
        status: 'missing',
        description: 'd',
        filePaths: [],
        reviewNotes: 'r',
        qualityScore: 20,
        nextSteps: 'Operator note that must survive.',
        lastReviewedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        featureName: 'Strong feature',
        category: 'core',
        status: 'implemented',
        description: 'd',
        filePaths: [],
        reviewNotes: 'r',
        qualityScore: 95,
        nextSteps: '',
        lastReviewedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    { projectId: PROJECT, source: 'review' },
  );
}

describe('completing a session routes its findings into the feature matrix', () => {
  it('appends a measured line on the weakest row of the owning module', async () => {
    seedMatrix('arpg-enemy-ai');

    const response = await POST(post({ action: 'ingest-external', run: RUN, projectId: PROJECT }));
    const body = await response.json() as { success: boolean; data: { sessionId: string } };
    expect(body.success).toBe(true);

    const rows = getFeaturesByModule('arpg-enemy-ai', PROJECT);
    const weak = rows.find((r) => r.featureName === 'Weak feature')!;
    const strong = rows.find((r) => r.featureName === 'Strong feature')!;

    expect(weak.nextSteps).toContain('Operator note that must survive.');
    expect(weak.nextSteps).toContain(`[game-director ${body.data.sessionId}]`);
    expect(weak.nextSteps).toContain('measured external playtest');
    // Only one row per module is touched; a row with no finding is untouched.
    expect(strong.nextSteps).toBe('');
    // A module with no finding is not touched at all.
    expect(getFeaturesByModule('arpg-combat', PROJECT)).toHaveLength(0);

    const events = getEvents(body.data.sessionId);
    expect(events.some((e) => e.message.includes('1 matrix row updated'))).toBe(true);
  });

  it('tags the simulated path\'s write-back as simulated', async () => {
    seedMatrix('arpg-combat');

    const config: PlaytestConfig = {
      testCategories: ['combat'],
      maxPlaytimeMinutes: 5,
      screenshotIntervalSeconds: 10,
      aggressiveMode: false,
      prioritySystems: ['arpg-combat'],
      projectId: PROJECT,
    };
    createSession('gd-sim-writeback', 'Sim writeback', '/build', config);
    await POST(post({ action: 'simulate', sessionId: 'gd-sim-writeback' }));

    expect(getSession('gd-sim-writeback')?.status).toBe('complete');
    const touched = getFeaturesByModule('arpg-combat', PROJECT)
      .filter((r) => r.nextSteps.includes('[game-director gd-sim-writeback]'));
    expect(touched.length).toBeGreaterThan(0);
    for (const r of touched) {
      expect(r.nextSteps).toContain('SIMULATED');
      expect(r.nextSteps).not.toContain('measured external playtest');
    }
  });

  it('refuses an unscoped write-back and says so on the timeline', async () => {
    const config: PlaytestConfig = {
      testCategories: ['combat'],
      maxPlaytimeMinutes: 5,
      screenshotIntervalSeconds: 10,
      aggressiveMode: false,
      prioritySystems: [],
    };
    createSession('gd-sim-unscoped', 'Sim unscoped', '/build', config);
    await POST(post({ action: 'simulate', sessionId: 'gd-sim-unscoped' }));

    const events = getEvents('gd-sim-unscoped');
    const routing = events.find((e) => e.message.startsWith('Matrix routing'));
    expect(routing?.message).toContain('SKIPPED');
    expect(routing?.message).toMatch(/no project scope/i);
  });
});
