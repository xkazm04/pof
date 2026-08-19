/**
 * The compliance engine's evidence age must reflect the CLI fix flow.
 *
 * `gdd-compliance` treats any non-`unknown` row as MEASURED and dates the module's
 * evidence from `last_reviewed_at`. The fix flow PATCHed rows to `improved` while
 * leaving `last_reviewed_at` pointing at an older review that had assessed a
 * DIFFERENT status — so a module fixed minutes ago reported evidence months old
 * (and, past the staleness threshold, reported it as STALE).
 *
 * RED before this change: the assertions on `newestEvidenceAt` below all read the
 * ancient review date. Runs against the real SQLite schema + the real route.
 *
 * Also pins the date-comparison fix: the age envelope is chronological, not the
 * character order of two equally-valid spellings of the same instant.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gdd-fix-provenance-${process.pid}.db`;
});

import { PATCH } from '@/app/api/feature-matrix/route';
import { upsertFeatures, clearModuleFeatures } from '@/lib/feature-matrix-db';
import { runComplianceAudit } from '@/lib/gdd-compliance';
import { evidenceAge } from '@/types/gdd-compliance';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const declared = MODULE_FEATURE_DEFINITIONS[MODULE]!;
const ANCIENT = '2020-01-01T00:00:00.000Z';

function seed(rows: { name: string; status: 'partial' | 'implemented'; at: string | null }[]) {
  upsertFeatures(
    MODULE,
    rows.map((r) => ({
      featureName: r.name,
      category: 'Core',
      status: r.status,
      description: '',
      filePaths: [],
      reviewNotes: '',
      qualityScore: 3,
      nextSteps: 'improve it',
      lastReviewedAt: r.at,
    })),
    { source: 'review' },
  );
}

function combatEvidence() {
  const report = runComplianceAudit({});
  return report.modules.find((m) => m.moduleId === MODULE)!.evidence;
}

async function patchFix(featureName: string) {
  const res = await PATCH(
    new NextRequest('http://localhost/api/feature-matrix', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: MODULE, featureName, status: 'improved' }),
    }),
  );
  expect(res.status).toBe(200);
}

beforeEach(() => {
  clearModuleFeatures(MODULE);
});

describe('evidence age after a CLI fix', () => {
  it('dates the fixed row from the fix, not from the review that saw a different status', async () => {
    seed([{ name: declared[0].featureName, status: 'partial', at: ANCIENT }]);

    const before = combatEvidence();
    expect(before.newestEvidenceAt).toBe(ANCIENT);
    expect(evidenceAge(before, new Date().toISOString()).state).toBe('stale');

    await patchFix(declared[0].featureName);

    const after = combatEvidence();
    expect(after.newestEvidenceAt).not.toBe(ANCIENT);
    expect(Date.parse(after.newestEvidenceAt!)).toBeGreaterThan(Date.parse(ANCIENT));
    expect(after.undatedEvidence).toBe(0);
    // The FIXED row is fresh; nothing else was touched, so the module's oldest
    // evidence is unchanged — a fix must not launder the rest of the module.
    expect(evidenceAge(after, new Date().toISOString()).state).toBe('fresh');
  });

  it('does not launder the rest of the module — the oldest evidence stays old', async () => {
    seed([
      { name: declared[0].featureName, status: 'partial', at: ANCIENT },
      { name: declared[1].featureName, status: 'partial', at: ANCIENT },
    ]);

    await patchFix(declared[0].featureName);

    const after = combatEvidence();
    expect(after.oldestEvidenceAt).toBe(ANCIENT);
    expect(evidenceAge(after, new Date().toISOString()).state).toBe('aging');
  });

  it('measures coverage unchanged — provenance makes evidence truer, it does not re-score', async () => {
    seed([
      { name: declared[0].featureName, status: 'partial', at: ANCIENT },
      { name: declared[1].featureName, status: 'implemented', at: ANCIENT },
    ]);
    const before = combatEvidence();

    await patchFix(declared[0].featureName);
    const after = combatEvidence();

    expect(after.featuresTotal).toBe(before.featuresTotal);
    expect(after.featuresMeasured).toBe(before.featuresMeasured);
    expect(after.coverage).toBe(before.coverage);
    expect(after.confidence).toBe(before.confidence);
  });
});

describe('the age envelope is chronological, not lexical', () => {
  it('picks the genuinely older of two equally-valid spellings of the same day', () => {
    // 02:00+02:00 IS 00:00Z — one hour EARLIER than 01:00Z, but as raw text it
    // sorts after it, which is how the old `a < b` comparison read it.
    seed([
      { name: declared[0].featureName, status: 'implemented', at: '2026-08-18T02:00:00+02:00' },
      { name: declared[1].featureName, status: 'implemented', at: '2026-08-18T01:00:00.000Z' },
    ]);

    const ev = combatEvidence();
    expect(Date.parse(ev.oldestEvidenceAt!)).toBeLessThan(Date.parse(ev.newestEvidenceAt!));
    expect(ev.oldestEvidenceAt).toBe('2026-08-18T00:00:00.000Z');
    expect(ev.newestEvidenceAt).toBe('2026-08-18T01:00:00.000Z');
  });
});
