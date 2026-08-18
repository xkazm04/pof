/**
 * `crash_history` — the analyzer's memory (direction: crash-history-persists).
 *
 * Nothing an operator imported used to survive a reload: imported reports lived in
 * an in-memory array and the view re-fetched the same eight static samples on mount.
 * These pin the replacement, and the two things it must NOT do:
 *   - it must not store the eight built-in DEMO crashes as observed history,
 *   - it must not grow without a bound.
 *
 * Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeFs = require('fs') as typeof import('fs');
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const dbPath = `${dir}/pof-test-crash-history-${process.pid}.db`;
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (nodeFs.existsSync(p)) nodeFs.unlinkSync(p);
  }
  process.env.POF_DB_PATH = dbPath;
});

import {
  recordCrashSighting,
  listCrashHistory,
  countCrashHistory,
  clearCrashHistory,
  CRASH_HISTORY_LIMITS,
} from '@/lib/crash-history-db';
import { analyzeSingleCrash, parseCrashLog } from '@/lib/crash-analyzer/analysis-engine';
import { SAMPLE_CRASHES } from '@/lib/crash-analyzer/sample-crashes';
import type { CrashReport } from '@/types/crash-analyzer';

/* ------------------------------------------------------------------ */
/*  Fixtures — real logs through the real parser                       */
/* ------------------------------------------------------------------ */

function rawLog(fn: string, file: string, when = '2026.08.18-09.12.44'): string {
  const stamp = `[${when}:120][842]LogWindows: Error: `;
  return [
    `${stamp}Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000048`,
    `${stamp}[Callstack]`,
    `${stamp}UnrealEditor-MyGame!${fn}() [${file}:142]`,
  ].join('\n');
}

/** Parse + attribute exactly as the import route does. */
function observed(fn = 'UARPGLootManager::RollLootTable', file = 'Source/Loot/ARPGLootManager.cpp', when?: string): CrashReport {
  const parsed = parseCrashLog(rawLog(fn, file, when));
  if (!parsed) throw new Error('fixture log failed to parse');
  return analyzeSingleCrash(parsed).report;
}

beforeEach(() => {
  clearCrashHistory();
});

/* ------------------------------------------------------------------ */
/*  1. It survives                                                     */
/* ------------------------------------------------------------------ */

describe('an imported crash survives past the session that imported it', () => {
  it('is readable back from the database, not from process memory', () => {
    const report = observed();
    recordCrashSighting(report);

    // A LATER read — the same thing a fresh page load does — still finds it.
    const history = listCrashHistory();
    expect(history).toHaveLength(1);
    expect(history[0].report.errorMessage).toBe(report.errorMessage);
    expect(history[0].report.mappedModule).toBe('arpg-loot');
    expect(history[0].report.callstack).toHaveLength(1);
    expect(history[0].report.rawLog).toContain('UARPGLootManager::RollLootTable');
  });

  it('comes back marked as observed, never as demo data', () => {
    recordCrashSighting(observed());
    expect(listCrashHistory()[0].report.source).toBe('imported');
  });
});

/* ------------------------------------------------------------------ */
/*  2. "Have I seen this before?" is answerable                        */
/* ------------------------------------------------------------------ */

describe('duplicate detection across sessions', () => {
  it('recognises a re-import instead of filing it as a new crash', () => {
    const first = recordCrashSighting(observed());
    expect(first.history.occurrences).toBe(1);

    // A second import of the SAME crash — a fresh log paste, so a fresh report id.
    const second = observed();
    expect(second.id).toBeDefined();
    const again = recordCrashSighting(second);

    expect(again.history.occurrences).toBe(2);
    expect(countCrashHistory()).toBe(1);
    // It keeps the id it is stored under, so the client updates one entry.
    expect(again.report.id).toBe(first.report.id);
  });

  it('reports a first-seen date, and widens it when an OLDER log turns up', () => {
    recordCrashSighting(observed(undefined, undefined, '2026.08.18-09.12.44'));
    const older = recordCrashSighting(observed(undefined, undefined, '2026.07.01-03.00.00'));

    expect(older.history.occurrences).toBe(2);
    expect(older.history.firstSeenAt).toBe('2026-07-01T03:00:00Z');
    expect(older.history.lastSeenAt).toBe('2026-08-18T09:12:44Z');
    expect(new Date(older.history.firstSeenAt).getTime()).toBeLessThan(
      new Date(older.history.lastSeenAt).getTime(),
    );
  });

  it('keeps two genuinely different crashes apart', () => {
    recordCrashSighting(observed('UARPGLootManager::RollLootTable', 'Source/Loot/ARPGLootManager.cpp'));
    recordCrashSighting(observed('UARPGInventoryComponent::AddItem', 'Source/Inventory/ARPGInventoryComponent.cpp'));
    expect(countCrashHistory()).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  3. Demo data never becomes crash history                           */
/* ------------------------------------------------------------------ */

describe('the eight built-in samples are demo data, not the project\'s history', () => {
  it('declares itself as a sample, so it can never be confused for an observation', () => {
    expect(SAMPLE_CRASHES).toHaveLength(8);
    expect(SAMPLE_CRASHES.every((c) => c.source === 'sample')).toBe(true);
    expect(SAMPLE_CRASHES.every((c) => c.history === undefined)).toBe(true);
  });

  it('is absent from an untouched crash history', () => {
    expect(countCrashHistory()).toBe(0);
    expect(listCrashHistory()).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  4. Storage is bounded — and says so                                */
/* ------------------------------------------------------------------ */

describe('bounded storage', () => {
  it('truncates an oversized raw log and records the original size', () => {
    const report = observed();
    const padding = 'x'.repeat(CRASH_HISTORY_LIMITS.rawLogChars + 5_000);
    const huge: CrashReport = { ...report, rawLog: `${report.rawLog}\n${padding}` };

    const stored = recordCrashSighting(huge);

    expect(stored.history.rawLogTruncated).toBe(true);
    expect(stored.history.rawLogChars).toBe(huge.rawLog.length);
    expect(stored.report.rawLog.length).toBeLessThan(huge.rawLog.length);
    // The stored copy admits it is partial rather than passing as complete.
    expect(stored.report.rawLog).toMatch(/truncated by PoF crash history/);
  });

  it('caps the retained callstack', () => {
    const report = observed();
    const deep: CrashReport = {
      ...report,
      callstack: Array.from({ length: CRASH_HISTORY_LIMITS.frames + 50 }, (_, i) => ({
        ...report.callstack[0],
        index: i,
      })),
    };
    const stored = recordCrashSighting(deep);
    expect(stored.report.callstack).toHaveLength(CRASH_HISTORY_LIMITS.frames);
  });

  it('never retains more than the stated number of crash signatures', () => {
    const over = CRASH_HISTORY_LIMITS.signatures + 3;
    for (let i = 0; i < over; i++) {
      recordCrashSighting(observed(`UARPGThing${i}::Boom`, `Source/Loot/Thing${i}.cpp`));
    }
    expect(countCrashHistory()).toBe(CRASH_HISTORY_LIMITS.signatures);
  });
});
