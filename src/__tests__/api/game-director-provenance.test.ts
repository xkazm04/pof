/**
 * Game Director provenance — the seam that separates "the fixture said so" from
 * "a harness measured it".
 *
 * Throwaway DB (POF_DB_PATH is set before the import graph opens better-sqlite3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-provenance-${process.pid}.db`;
});

import { POST } from '@/app/api/game-director/route';
import {
  createSession, getSession, getDirectorStats, getHealthTrend, updateSessionStatus,
} from '@/lib/game-director-db';
import { simulatePlaytest } from '@/lib/game-director-sim';
import type { PlaytestConfig, PlaytestSummary } from '@/types/game-director';

const config: PlaytestConfig = {
  testCategories: ['combat', 'save-load'],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('the simulator declares itself', () => {
  it('stamps every session it completes as simulated', async () => {
    createSession('sim-a', 'Sim A', '/build', config);
    await simulatePlaytest('sim-a', config);

    const session = getSession('sim-a');
    expect(session?.source).toBe('simulated');
    expect(session?.status).toBe('complete');
  });

  it('writes "not measured" instead of inventing coverage, screenshots and playtime', async () => {
    createSession('sim-b', 'Sim B', '/build', config);
    await simulatePlaytest('sim-b', config);

    const summary = getSession('sim-b')!.summary!;
    // Coverage: one entry per tested category, every one explicitly unmeasured.
    expect(Object.keys(summary.testCoverage).sort()).toEqual(['combat', 'save-load']);
    expect(Object.values(summary.testCoverage)).toEqual([null, null]);
    // No frame is captured and no build is played.
    expect(summary.totalScreenshotsAnalyzed).toBeNull();
    expect(summary.playtimeSeconds).toBeNull();
    // The score IS real arithmetic over the canned findings, so it stays a number.
    expect(typeof summary.overallScore).toBe('number');
  });

  it('is repeatable: two runs of the same config produce byte-identical summaries', async () => {
    createSession('rep-1', 'Rep 1', '/build', config);
    createSession('rep-2', 'Rep 2', '/build', config);
    await simulatePlaytest('rep-1', config);
    await simulatePlaytest('rep-2', config);

    const a = getSession('rep-1')!.summary!;
    const b = getSession('rep-2')!.summary!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    // And re-running the SAME session must not move a single figure either.
    const before = JSON.stringify(getSession('rep-1')!.summary);
    await simulatePlaytest('rep-1', config);
    expect(JSON.stringify(getSession('rep-1')!.summary)).toBe(before);
  });

  it('contains no randomness at all — the source is free of Math.random', () => {
    // `testCoverage[cat] = Math.floor(60 + Math.random() * 40)` rendered a random
    // number as an authoritative, colour-banded coverage percentage. The
    // repeatability assertions above would catch its return; this catches it
    // being reintroduced anywhere else in the fixture.
    const src = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'game-director-sim.ts'),
      'utf8',
    );
    // Comments are stripped first: the file NAMES the removed line so the next
    // reader knows what used to be there, and that mention must not satisfy the
    // check — only executable code is inspected.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');
    expect(code.includes('Math.random')).toBe(false);
    expect(src.includes('Math.random')).toBe(true); // ...only in the explanatory comment
  });

  it('records no screenshot events, because it captures no screenshots', async () => {
    createSession('sim-ev', 'Sim events', '/build', config);
    await simulatePlaytest('sim-ev', config);

    const { getEvents } = await import('@/lib/game-director-db');
    const events = getEvents('sim-ev');
    expect(events.some(e => e.type === 'screenshot')).toBe(false);
    // Every simulator-authored entry names itself.
    expect(events.every(e => e.message.startsWith('SIMULATED —'))).toBe(true);
  });
});

describe('the external writer API is the seam for real results', () => {
  it('marks a session external when a harness completes it, and never on its own', async () => {
    const created = await POST(post({
      action: 'create',
      name: 'Harness run',
      buildPath: '/build',
      config,
      source: 'external',
    }));
    const { data: session } = await created.json() as { data: { id: string; source: string } };
    expect(session.source).toBe('external');

    updateSessionStatus(session.id, 'playing');

    const summary: PlaytestSummary = {
      overallScore: 91,
      totalScreenshotsAnalyzed: 12,
      systemsTested: ['combat'],
      testCoverage: { combat: 64 } as PlaytestSummary['testCoverage'],
      topIssue: 'Frame hitch on boss spawn',
      topPraise: 'Input latency within budget',
      playtimeSeconds: 600,
    };
    const res = await POST(post({
      action: 'complete',
      sessionId: session.id,
      summary,
      durationMs: 601_000,
      systemsTestedCount: 1,
      findingsCount: 0,
    }));
    expect((await res.json()).success).toBe(true);

    const completed = getSession(session.id)!;
    // No `source` in the complete payload: the writer API defaults to external.
    expect(completed.source).toBe('external');
    expect(completed.summary!.testCoverage.combat).toBe(64);
  });

  it('defaults an unstated create to simulated, and refuses to be talked into external', async () => {
    const plain = await POST(post({ action: 'create', name: 'Unstated', buildPath: '/b', config }));
    expect((await plain.json()).data.source).toBe('simulated');

    const bogus = await POST(post({
      action: 'create', name: 'Bogus', buildPath: '/b', config, source: 'verified-by-me',
    }));
    expect((await bogus.json()).data.source).toBe('simulated');
  });
});

describe('rolled-up figures carry the provenance of what they roll up', () => {
  it('reports mixed provenance once both kinds of session are scored', () => {
    const stats = getDirectorStats();
    expect(stats.scoreSource).toBe('mixed');
    expect(stats.scoredSessions).toBeGreaterThan(1);

    const trend = getHealthTrend(50);
    expect(trend.some(p => p.source === 'simulated')).toBe(true);
    expect(trend.some(p => p.source === 'external')).toBe(true);
  });
});
