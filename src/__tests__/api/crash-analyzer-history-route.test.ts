/**
 * `/api/crash-analyzer` — the reload boundary (direction: crash-history-persists).
 *
 * The view calls GET on mount. Before crash history existed that call always
 * answered with the same eight static samples, so every crash the operator had
 * imported was discarded on the next page load. This is the test that the round
 * trip an operator actually performs — import, reload, look again — now keeps it.
 *
 * Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeFs = require('fs') as typeof import('fs');
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const dbPath = `${dir}/pof-test-crash-route-${process.pid}.db`;
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (nodeFs.existsSync(p)) nodeFs.unlinkSync(p);
  }
  process.env.POF_DB_PATH = dbPath;
});

import { GET, POST } from '@/app/api/crash-analyzer/route';
import { clearCrashHistory } from '@/lib/crash-history-db';
import { SAMPLE_CRASHES } from '@/lib/crash-analyzer/sample-crashes';
import type { CrashAnalyzerResult, CrashDiagnosis, CrashReport } from '@/types/crash-analyzer';

const RAW_LOG = [
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000048',
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: [Callstack]',
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: UnrealEditor-MyGame!UARPGLootManager::RollLootTable() [Source/Loot/ARPGLootManager.cpp:156]',
].join('\n');

function post(body: unknown) {
  return POST(new NextRequest('http://localhost/api/crash-analyzer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

async function importLog(rawText = RAW_LOG) {
  const json = await (await post({ action: 'parse-log', rawText })).json();
  expect(json.success).toBe(true);
  return json.data as { report: CrashReport; diagnosis: CrashDiagnosis | null; seenBefore: boolean };
}

/** What a page load sees. */
async function reload(): Promise<CrashAnalyzerResult> {
  const json = await (await GET()).json();
  expect(json.success).toBe(true);
  return json.data as CrashAnalyzerResult;
}

beforeEach(() => {
  clearCrashHistory();
});

describe('GET /api/crash-analyzer — samples plus what was actually observed', () => {
  it('returns only the built-in samples when nothing has been imported', async () => {
    const result = await reload();
    expect(result.reports).toHaveLength(SAMPLE_CRASHES.length);
    expect(result.reports.every((r) => r.source === 'sample')).toBe(true);
  });

  it('still carries an imported crash on the NEXT load — the whole point', async () => {
    const imported = await importLog();

    const afterReload = await reload();
    const survivor = afterReload.reports.find((r) => r.id === imported.report.id);

    expect(survivor).toBeDefined();
    expect(survivor!.source).toBe('imported');
    expect(survivor!.errorMessage).toBe(imported.report.errorMessage);
    expect(survivor!.mappedModule).toBe('arpg-loot');
    expect(afterReload.reports).toHaveLength(SAMPLE_CRASHES.length + 1);
    // The demo crashes are still demo crashes.
    expect(afterReload.reports.filter((r) => r.source === 'sample')).toHaveLength(SAMPLE_CRASHES.length);
  });

  it('counts the imported crash in the stats, not just in the list', async () => {
    const before = await reload();
    await importLog();
    const after = await reload();
    expect(after.stats.totalCrashes).toBe(before.stats.totalCrashes + 1);
  });
});

describe('POST parse-log — a re-import is recognised, not duplicated', () => {
  it('answers "seen before" with the count and the first-seen date', async () => {
    const first = await importLog();
    expect(first.seenBefore).toBe(false);
    expect(first.report.history!.occurrences).toBe(1);

    const second = await importLog();
    expect(second.seenBefore).toBe(true);
    expect(second.report.history!.occurrences).toBe(2);
    expect(second.report.history!.firstSeenAt).toBe(first.report.history!.firstSeenAt);
    // Same stored id, so the client updates one entry instead of stacking copies.
    expect(second.report.id).toBe(first.report.id);

    const afterReload = await reload();
    expect(afterReload.reports).toHaveLength(SAMPLE_CRASHES.length + 1);
  });

  it('keeps the diagnosis pointed at the id the crash is stored under', async () => {
    await importLog();
    const second = await importLog();
    if (second.diagnosis) expect(second.diagnosis.crashId).toBe(second.report.id);

    // …and the `analyze` action can still find the persisted crash by that id.
    const json = await (await post({ action: 'analyze', crashId: second.report.id })).json();
    expect(json.success).toBe(true);
    expect(json.data.report.id).toBe(second.report.id);
  });

  it('never writes a built-in sample into the observed history', async () => {
    await importLog();
    const result = await reload();
    const persistedSampleIds = result.reports
      .filter((r) => r.source === 'imported')
      .map((r) => r.id);
    expect(persistedSampleIds.some((id) => /^crash-00\d$/.test(id))).toBe(false);
  });
});
