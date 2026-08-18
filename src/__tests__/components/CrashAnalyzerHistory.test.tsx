/**
 * Imported crashes survive a reload, and never pass as demo data
 * (direction: crash-history-persists).
 *
 * Two halves:
 *   - the STORE half: a fresh store (what a page load builds) fetches and finds
 *     the imported crash still there, and a re-import updates the existing entry
 *     instead of appending a second copy;
 *   - the VIEW half: the screen tells a built-in sample apart from a crash
 *     observed in this project, and answers "seen before" with a count and a date.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { CrashAnalyzerView } from '@/components/modules/evaluator/CrashAnalyzerView';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import { analyzeReports, analyzeSingleCrash, parseCrashLog } from '@/lib/crash-analyzer/analysis-engine';
import { SAMPLE_CRASHES } from '@/lib/crash-analyzer/sample-crashes';
import { emptyCrashStats, CRASH_HISTORY_LIMITS } from '@/types/crash-analyzer';
import type { CrashReport } from '@/types/crash-analyzer';

/* ------------------------------------------------------------------ */
/*  A server that remembers — the thing the store cannot do for itself */
/* ------------------------------------------------------------------ */

const RAW_LOG = [
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000048',
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: [Callstack]',
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: UnrealEditor-MyGame!UARPGLootManager::RollLootTable() [Source/Loot/ARPGLootManager.cpp:156]',
].join('\n');

/** The persisted crash, shaped exactly as the route returns it (stored id + history). */
function persistedCrash(occurrences: number): CrashReport {
  const parsed = parseCrashLog(RAW_LOG);
  if (!parsed) throw new Error('fixture log failed to parse');
  const { report } = analyzeSingleCrash(parsed);
  return {
    ...report,
    id: 'crash-observed-1',
    source: 'imported',
    history: {
      occurrences,
      firstSeenAt: '2026-07-01T03:00:00Z',
      lastSeenAt: '2026-08-18T09:12:44Z',
      recordedAt: '2026-07-01T03:05:00Z',
      rawLogChars: RAW_LOG.length,
      rawLogTruncated: false,
    },
  };
}

function jsonOk(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) };
}

/** GET returns samples + history; POST returns the STORED record, as the route does. */
function mockServer(occurrences: number) {
  const stored = persistedCrash(occurrences);
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return jsonOk({ report: stored, diagnosis: null, seenBefore: occurrences > 1 });
    }
    return jsonOk(analyzeReports([...SAMPLE_CRASHES, stored]));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { stored, fetchMock };
}

/** A store with nothing in it — what a page load starts from. */
function freshStore() {
  useCrashAnalyzerStore.setState({
    reports: [],
    diagnoses: [],
    patterns: [],
    stats: emptyCrashStats(),
    selectedCrashId: null,
    isLoading: false,
    error: null,
  });
}

beforeEach(() => {
  freshStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ */
/*  Store: the reload                                                  */
/* ------------------------------------------------------------------ */

describe('a fresh store still finds the imported crash', () => {
  it('fetchAnalysis returns it alongside the samples instead of discarding it', async () => {
    const { stored } = mockServer(1);

    await useCrashAnalyzerStore.getState().fetchAnalysis();

    const { reports } = useCrashAnalyzerStore.getState();
    expect(reports).toHaveLength(SAMPLE_CRASHES.length + 1);
    const survivor = reports.find((r) => r.id === stored.id);
    expect(survivor).toBeDefined();
    expect(survivor!.source).toBe('imported');
    expect(survivor!.history!.occurrences).toBe(1);
  });

  it('a re-import updates the existing entry rather than appending a copy', async () => {
    mockServer(1);
    await useCrashAnalyzerStore.getState().fetchAnalysis();
    const before = useCrashAnalyzerStore.getState().reports.length;

    // Same crash pasted again — the server answers with the SAME stored id and a
    // bumped count. A list that grows here would be the opposite of "seen before".
    vi.unstubAllGlobals();
    mockServer(2);
    await useCrashAnalyzerStore.getState().importCrashLog(RAW_LOG);

    const { reports } = useCrashAnalyzerStore.getState();
    expect(reports).toHaveLength(before);
    expect(reports.filter((r) => r.id === 'crash-observed-1')).toHaveLength(1);
    expect(reports.find((r) => r.id === 'crash-observed-1')!.history!.occurrences).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  View: demo data can never pass as the project's crash history      */
/* ------------------------------------------------------------------ */

describe('the screen tells demo crashes from observed ones', () => {
  it('states the split and the retention bound above the list', async () => {
    mockServer(3);
    await useCrashAnalyzerStore.getState().fetchAnalysis();
    render(<CrashAnalyzerView />);

    const summary = await screen.findByTestId('crash-provenance-summary');
    expect(summary.textContent).toMatch(new RegExp(`${SAMPLE_CRASHES.length} built-in sample crashes`));
    expect(summary.textContent).toMatch(/1 imported from this project/);
    expect(summary.textContent).toMatch(new RegExp(`${CRASH_HISTORY_LIMITS.signatures} most recent`));
  });

  it('labels each row and shows the sighting count on the observed one', async () => {
    mockServer(3);
    await useCrashAnalyzerStore.getState().fetchAnalysis();
    render(<CrashAnalyzerView />);

    const options = await screen.findAllByRole('option');
    const observedRow = options.find((o) => o.textContent?.includes('imported'));
    expect(observedRow).toBeDefined();
    expect(observedRow!.textContent).toMatch(/seen 3/);

    // The samples say what they are; none of them claims a sighting count.
    const sampleRows = options.filter((o) => o.textContent?.includes('SAMPLE') || o.textContent?.includes('sample'));
    expect(sampleRows.length).toBe(SAMPLE_CRASHES.length);
    expect(sampleRows.every((o) => !/seen \d+/.test(o.textContent ?? ''))).toBe(true);
  });

  it('the detail panel of a sample says it is demo data, with no history', async () => {
    mockServer(3);
    await useCrashAnalyzerStore.getState().fetchAnalysis();
    useCrashAnalyzerStore.getState().selectCrash('crash-001');
    render(<CrashAnalyzerView />);

    const provenance = await screen.findByTestId('crash-provenance');
    expect(provenance.textContent).toMatch(/Built-in sample crash/);
    expect(provenance.textContent).toMatch(/not observed in this project/);
    expect(provenance.textContent).not.toMatch(/seen \d+ times/);
  });

  it('the detail panel of an observed crash reports the count and first-seen date', async () => {
    mockServer(3);
    await useCrashAnalyzerStore.getState().fetchAnalysis();
    useCrashAnalyzerStore.getState().selectCrash('crash-observed-1');
    render(<CrashAnalyzerView />);

    const provenance = await screen.findByTestId('crash-provenance');
    expect(provenance.textContent).toMatch(/Imported from this project/);
    expect(provenance.textContent).toMatch(/seen 3 times/);
    expect(provenance.textContent).toMatch(/first seen/);
  });
});
