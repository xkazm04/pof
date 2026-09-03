/**
 * Two honesty defects in the Game Director's finding record.
 *
 * 1. There was no *unreproducible* state. A finding somebody tried to reproduce
 *    and could not is not a false positive, not ignored, and not snoozed — and
 *    "could not reproduce" reported without an attempt count is a conclusion
 *    stated over an unstated scope (L12: an instrument proves it had input
 *    before it reports a verdict).
 * 2. `confidence` was `INTEGER NOT NULL DEFAULT 80`, so a finding nobody scored
 *    was stored — and rendered — as 80% and was indistinguishable from one an
 *    observer actually scored at 80 (L1: unmeasured is not a pass).
 *
 * Throwaway DB (POF_DB_PATH is set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-triage-honesty-${process.pid}.db`;
});

import { POST } from '@/app/api/game-director/route';
import {
  createSession,
  addFinding,
  getFindings,
  updateFindingTriage,
  isTriageExcluded,
} from '@/lib/game-director-db';
import { simulatePlaytest } from '@/lib/game-director-sim';
import { resolveConfidence, confidenceLabel, TRIAGE_TOKENS } from '@/lib/game-director-styles';
import { validateTriageRepro } from '@/types/game-director';
import type { PlaytestConfig, PlaytestFinding } from '@/types/game-director';

const config: PlaytestConfig = {
  testCategories: ['combat'],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

let seq = 0;

function finding(sessionId: string, over: Partial<PlaytestFinding> = {}): PlaytestFinding {
  return {
    id: `f-${sessionId}-${seq++}`,
    sessionId,
    category: 'gameplay-feel',
    severity: 'high',
    title: 'Dash cancels itself on slopes',
    description: '',
    relatedModule: null,
    screenshotRef: null,
    gameTimestamp: null,
    suggestedFix: '',
    confidence: null,
    confidenceBasis: null,
    createdAt: new Date().toISOString(),
    triageStatus: 'active',
    triageNote: '',
    snoozedUntil: null,
    fixDispatchedAt: null,
    reproAttempts: null,
    reproBuildId: null,
    reproLastAttemptedAt: null,
    ...over,
  };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function json(res: Response) {
  return (await res.json()) as { success: boolean; data?: unknown; error?: string };
}

// ─── Defect 1: unreproducible is a state, not a dismissal ────────────────────

describe('unreproducible is a durable state carrying its attempt count', () => {
  it('records how many times reproduction was attempted, and on which build', () => {
    createSession('unrepro-a', 'Unrepro A', '/build', config);
    const f = finding('unrepro-a');
    addFinding(f);

    const updated = updateFindingTriage(f.id, 'unreproducible', 'tried on the nightly', null, {
      attempts: 7,
      buildId: 'nightly-2026-09-02',
    });

    expect(updated?.triageStatus).toBe('unreproducible');
    expect(updated?.reproAttempts).toBe(7);
    expect(updated?.reproBuildId).toBe('nightly-2026-09-02');
    expect(updated?.reproLastAttemptedAt).toBeTruthy();

    // And it survives a round-trip through the DB, not just the return value.
    const read = getFindings('unrepro-a').find(x => x.id === f.id)!;
    expect(read.triageStatus).toBe('unreproducible');
    expect(read.reproAttempts).toBe(7);
  });

  it('is not confusable with false-positive: distinct status, label and exclusion', () => {
    createSession('unrepro-b', 'Unrepro B', '/build', config);
    const a = finding('unrepro-b');
    const b = finding('unrepro-b');
    addFinding(a);
    addFinding(b);

    updateFindingTriage(a.id, 'unreproducible', '', null, { attempts: 3, buildId: null });
    updateFindingTriage(b.id, 'false-positive', '', null, null);

    const read = getFindings('unrepro-b');
    const ra = read.find(x => x.id === a.id)!;
    const rb = read.find(x => x.id === b.id)!;

    expect(ra.triageStatus).not.toBe(rb.triageStatus);
    expect(TRIAGE_TOKENS.unreproducible.label).not.toBe(TRIAGE_TOKENS['false-positive'].label);
    expect(TRIAGE_TOKENS.unreproducible.label.toLowerCase()).toContain('unreproduc');

    // Failing to reproduce is weak evidence AGAINST a defect; it never dismisses
    // the finding, so it stays inside scoring and regression fingerprinting.
    expect(isTriageExcluded('unreproducible')).toBe(false);
    expect(isTriageExcluded('false-positive')).toBe(true);

    // A false positive carries no attempt count — the two states are not aliases.
    expect(rb.reproAttempts).toBeNull();
  });

  it('refuses an unreproducible verdict with no attempt count', async () => {
    createSession('unrepro-c', 'Unrepro C', '/build', config);
    const f = finding('unrepro-c');
    addFinding(f);

    const res = await POST(post({
      action: 'update-triage',
      findingId: f.id,
      triageStatus: 'unreproducible',
    }));
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.success).toBe(false);
    expect(String(body.error)).toMatch(/attempt/i);

    // The finding is untouched: no silent half-write.
    expect(getFindings('unrepro-c')[0].triageStatus).toBe('active');
  });

  it('accepts an unreproducible verdict that states its attempts, over the API', async () => {
    createSession('unrepro-d', 'Unrepro D', '/build', config);
    const f = finding('unrepro-d');
    addFinding(f);

    const res = await POST(post({
      action: 'update-triage',
      findingId: f.id,
      triageStatus: 'unreproducible',
      triageNote: 'three difficulties, both input devices',
      reproAttempts: 12,
      reproBuildId: 'main@ab12cd3',
    }));
    expect(res.status).toBe(200);
    const body = await json(res);
    const saved = body.data as PlaytestFinding;
    expect(saved.triageStatus).toBe('unreproducible');
    expect(saved.reproAttempts).toBe(12);
    expect(saved.reproBuildId).toBe('main@ab12cd3');
  });

  it('rejects a zero or negative attempt count — zero attempts is "not attempted"', () => {
    expect(validateTriageRepro('unreproducible', 0, null).ok).toBe(false);
    expect(validateTriageRepro('unreproducible', -1, null).ok).toBe(false);
    expect(validateTriageRepro('unreproducible', null, null).ok).toBe(false);
    expect(validateTriageRepro('unreproducible', 1, null).ok).toBe(true);
    // Every other state carries no repro record at all.
    const other = validateTriageRepro('confirmed', null, null);
    expect(other.ok).toBe(true);
    expect(other.ok && other.data).toBeNull();
  });

  it('clears the repro record when the finding is reopened', () => {
    createSession('unrepro-e', 'Unrepro E', '/build', config);
    const f = finding('unrepro-e');
    addFinding(f);
    updateFindingTriage(f.id, 'unreproducible', '', null, { attempts: 4, buildId: 'x' });
    const reset = updateFindingTriage(f.id, 'active', '', null, null);
    expect(reset?.reproAttempts).toBeNull();
    expect(reset?.reproBuildId).toBeNull();
  });
});

// ─── Defect 2: an unscored confidence is not 80 ──────────────────────────────

describe('an unscored confidence never renders as a number', () => {
  it('stores and reads back null instead of substituting the old 80 default', () => {
    createSession('conf-a', 'Conf A', '/build', config);
    const f = finding('conf-a', { confidence: null, confidenceBasis: null });
    addFinding(f);

    const read = getFindings('conf-a')[0];
    expect(read.confidence).toBeNull();
    expect(read.confidenceBasis).toBeNull();
    expect(resolveConfidence(read).kind).toBe('unscored');
    expect(confidenceLabel(read)).toMatch(/not scored/i);
  });

  it('preserves a scored zero instead of silently promoting it to 80', () => {
    createSession('conf-b', 'Conf B', '/build', config);
    const f = finding('conf-b', { confidence: 0, confidenceBasis: 'observer' });
    addFinding(f);

    const read = getFindings('conf-b')[0];
    expect(read.confidence).toBe(0);
    expect(resolveConfidence(read)).toEqual({ kind: 'scored', value: 0 });
  });

  it('distinguishes a scored 80 from an unattributed 80', () => {
    const scored = resolveConfidence({ confidence: 80, confidenceBasis: 'observer' });
    const unattributed = resolveConfidence({ confidence: 80, confidenceBasis: null });
    expect(scored).toEqual({ kind: 'scored', value: 80 });
    expect(unattributed).toEqual({ kind: 'unattributed', value: 80 });
    expect(confidenceLabel(scored)).not.toBe(confidenceLabel(unattributed));
    expect(confidenceLabel(unattributed)).toMatch(/unattributed|basis/i);
  });

  it('reads an absent basis as unattributed, never as scored', () => {
    // Same stance as resolveSessionSource: an object that does not claim a basis
    // has not stated one, and unstated must fall to the untrusted side.
    expect(resolveConfidence({ confidence: 95 }).kind).toBe('unattributed');
  });

  it('the simulator scores nothing, so its findings carry no confidence', async () => {
    createSession('conf-sim', 'Conf Sim', '/build', config);
    await simulatePlaytest('conf-sim', config);
    const findings = getFindings('conf-sim');
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.confidence).toBeNull();
      expect(resolveConfidence(f).kind).toBe('unscored');
    }
  });
});
