import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';

/**
 * Durable gap triage. Before this, the store held resolutions in memory, nothing
 * wrote them anywhere, `resolveGap` was exported with zero importers, and the
 * declared `resolve-gap` API action returned a 400 — so a triage session died on
 * reload. These run against a real throwaway SQLite file, not a mock, because the
 * whole claim under test is that the rows outlive the process that made them.
 */

// `vi.hoisted` runs before the module imports below, so it cannot use `path`/`os`
// — but it must run first, because db.ts resolves POF_DB_PATH at module load.
const DB_FILE = vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '.';
  const file = `${dir}/pof-gdd-resolutions-${process.pid}-${Date.now()}.db`;
  process.env.POF_DB_PATH = file;
  return file;
});

import {
  runComplianceAudit, resolveGap, unresolveGap, listResolutions,
} from '@/lib/gdd-compliance';
import { getDb } from '@/lib/db';

const PROJECT = '/projects/alpha';

/** Any gap id the audit actually produces, so the test never invents one. */
function firstGapId(projectPath = PROJECT): string {
  const report = runComplianceAudit({}, projectPath);
  const gap = report.modules.flatMap((m) => m.gaps)[0];
  if (!gap) throw new Error('audit produced no gaps to triage');
  return gap.id;
}

function gapById(gapId: string, projectPath = PROJECT) {
  return runComplianceAudit({}, projectPath)
    .modules.flatMap((m) => m.gaps)
    .find((g) => g.id === gapId);
}

beforeEach(() => {
  getDb().prepare('DELETE FROM gdd_gap_resolutions').run();
});

afterAll(() => {
  try {
    getDb().close();
  } catch {
    /* already closed */
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(`${DB_FILE}${suffix}`, { force: true });
    } catch {
      /* best effort — a temp file */
    }
  }
});

describe('gap resolutions persist', () => {
  it('round-trips a resolution through SQLite', () => {
    const gapId = firstGapId();
    const written = resolveGap(PROJECT, gapId, { moduleId: 'arpg-combat', note: 'tracked elsewhere' });

    expect(written.gapId).toBe(gapId);
    const stored = listResolutions(PROJECT);
    expect(stored).toHaveLength(1);
    expect(stored[0].gapId).toBe(gapId);
    expect(stored[0].note).toBe('tracked elsewhere');
    expect(Number.isNaN(Date.parse(stored[0].resolvedAt))).toBe(false);
  });

  it('survives a re-audit — the whole point of persisting it', () => {
    const gapId = firstGapId();
    expect(gapById(gapId)!.resolved).toBe(false);
    resolveGap(PROJECT, gapId);
    // A brand-new report, computed from scratch, still knows.
    expect(gapById(gapId)!.resolved).toBe(true);
    expect(gapById(gapId)!.resolved).toBe(true);
  });

  it('is idempotent — a double resolve refreshes rather than throwing', () => {
    const gapId = firstGapId();
    resolveGap(PROJECT, gapId, { note: 'first' });
    resolveGap(PROJECT, gapId, { note: 'second' });
    const stored = listResolutions(PROJECT);
    expect(stored).toHaveLength(1);
    expect(stored[0].note).toBe('second');
  });

  it('un-resolves, and reports whether anything was actually re-opened', () => {
    const gapId = firstGapId();
    resolveGap(PROJECT, gapId);
    expect(unresolveGap(PROJECT, gapId)).toBe(true);
    expect(gapById(gapId)!.resolved).toBe(false);
    expect(listResolutions(PROJECT)).toHaveLength(0);
    // Nothing left to re-open — reported, not silently "succeeded".
    expect(unresolveGap(PROJECT, gapId)).toBe(false);
  });

  it('scopes resolutions by project — gap ids are only unique within one', () => {
    const gapId = firstGapId();
    resolveGap(PROJECT, gapId);
    expect(gapById(gapId, PROJECT)!.resolved).toBe(true);
    expect(gapById(gapId, '/projects/beta')!.resolved).toBe(false);
  });

  it('drops resolved gaps out of the headline counters but keeps them listed', () => {
    const before = runComplianceAudit({}, PROJECT);
    const gap = before.modules.flatMap((m) => m.gaps)[0];
    resolveGap(PROJECT, gap.id);
    const after = runComplianceAudit({}, PROJECT);

    expect(after.totalGaps).toBe(before.totalGaps - 1);
    expect(after.criticalGaps).toBeLessThanOrEqual(after.totalGaps);
    // Still present on its module, so it can be reviewed and re-opened.
    expect(after.modules.flatMap((m) => m.gaps).some((g) => g.id === gap.id)).toBe(true);
  });

  it('audits with no project scope see only unscoped resolutions', () => {
    const gapId = firstGapId();
    resolveGap(PROJECT, gapId);
    expect(gapById(gapId, '')!.resolved).toBe(false);
    resolveGap('', gapId);
    expect(gapById(gapId, '')!.resolved).toBe(true);
  });
});
