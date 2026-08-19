/**
 * Row provenance on the feature matrix — the evidence substrate the GDD compliance
 * engine reads.
 *
 * Every one of these was RED before this change:
 *   • PATCH (the CLI fix flow) wrote `status` + `updated_at` and nothing else, so a
 *     fixed row kept a `last_reviewed_at` from a review that had assessed a DIFFERENT
 *     status — and compliance read that pair as dated evidence for the new state.
 *   • No row could say WHICH of the four write paths set it.
 *   • A PATCH naming a feature that does not exist answered `{ updated: true }` over
 *     an UPDATE that touched zero rows.
 *
 * Runs against the real SQLite schema (throwaway DB), not a mock.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fm-provenance-${process.pid}.db`;
});

import { PATCH, POST } from '@/app/api/feature-matrix/route';
import { POST as IMPORT_POST } from '@/app/api/feature-matrix/import/route';
import {
  getFeaturesByModule,
  clearModuleFeatures,
  upsertFeatures,
  updateFeatureStatus,
  normalizeReviewTimestamp,
} from '@/lib/feature-matrix-db';
import { getDb } from '@/lib/db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const declared = MODULE_FEATURE_DEFINITIONS[MODULE]!;
const FEATURE = declared[0].featureName;

function req(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rowFor(name: string) {
  return getFeaturesByModule(MODULE).find((f) => f.featureName === name);
}

function seedReviewedRow(lastReviewedAt: string | null) {
  upsertFeatures(
    MODULE,
    [{
      featureName: FEATURE,
      category: declared[0].category,
      status: 'partial',
      description: declared[0].description,
      filePaths: [],
      reviewNotes: 'reviewed long ago',
      qualityScore: 2,
      nextSteps: 'finish it',
      lastReviewedAt,
    }],
    { source: 'review' },
  );
}

beforeEach(() => {
  clearModuleFeatures(MODULE);
});

describe('the schema records provenance', () => {
  it('carries a `source` column that legacy rows read as "unknown", not as a review', () => {
    // A row written the way every pre-provenance write wrote one: no source at all.
    getDb()
      .prepare(
        `INSERT INTO feature_matrix (module_id, feature_name, category, status, description, file_paths, review_notes, next_steps, last_reviewed_at)
         VALUES (?, ?, 'Core', 'implemented', '', '[]', '', '', '2026-01-01T00:00:00.000Z')`,
      )
      .run(MODULE, FEATURE);

    expect(rowFor(FEATURE)!.source).toBe('unknown');
  });
});

describe('PATCH stamps provenance on the fix flow', () => {
  it('sets last_reviewed_at to now AND source="fix" — the date can no longer describe a different status', async () => {
    const ancient = '2020-01-01T00:00:00.000Z';
    seedReviewedRow(ancient);
    expect(rowFor(FEATURE)!.lastReviewedAt).toBe(ancient);
    expect(rowFor(FEATURE)!.source).toBe('review');

    const before = Date.now();
    const res = await PATCH(
      req('/api/feature-matrix', 'PATCH', { moduleId: MODULE, featureName: FEATURE, status: 'improved' }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.previousStatus).toBe('partial');
    expect(body.data.statusChanged).toBe(true);
    expect(body.data.source).toBe('fix');

    const row = rowFor(FEATURE)!;
    expect(row.status).toBe('improved');
    expect(row.source).toBe('fix');
    expect(row.lastReviewedAt).not.toBe(ancient);
    expect(Date.parse(row.lastReviewedAt!)).toBeGreaterThanOrEqual(before - 1000);
  });

  it('reports a PATCH that matched no row instead of answering "updated"', async () => {
    const res = await PATCH(
      req('/api/feature-matrix', 'PATCH', {
        moduleId: MODULE,
        featureName: declared[0].featureName,
        status: 'improved',
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toContain('nothing was updated');
  });

  it('re-asserting the same status is still fresh evidence, but not a status change', () => {
    seedReviewedRow('2020-01-01T00:00:00.000Z');
    updateFeatureStatus(MODULE, FEATURE, 'improved');
    const second = updateFeatureStatus(MODULE, FEATURE, 'improved');

    expect(second.updated).toBe(true);
    expect(second.statusChanged).toBe(false);
    expect(second.source).toBe('fix');
    expect(rowFor(FEATURE)!.lastReviewedAt).toBe(second.reviewedAt);
  });
});

describe('each write path stamps its own source', () => {
  it('the import route stamps "review"', async () => {
    const res = await IMPORT_POST(
      req('/api/feature-matrix/import', 'POST', {
        moduleId: MODULE,
        reviewedAt: '2026-08-18T00:00:00.000Z',
        features: [{ featureName: FEATURE, category: 'Core', status: 'implemented' }],
      }),
    );
    expect(res.status).toBe(200);
    expect(rowFor(FEATURE)!.source).toBe('review');
  });

  it('a seedOnly POST stamps "seed" — a placeholder is not a verdict', async () => {
    const res = await POST(
      req('/api/feature-matrix', 'POST', {
        moduleId: MODULE,
        seedOnly: true,
        source: 'seed',
        features: [{
          featureName: FEATURE, category: 'Core', status: 'unknown',
          description: '', filePaths: [], reviewNotes: '',
        }],
      }),
    );
    expect(res.status).toBe(200);
    expect(rowFor(FEATURE)!.source).toBe('seed');
  });

  it('an auto-verify POST stamps "verify"', async () => {
    await POST(
      req('/api/feature-matrix', 'POST', {
        moduleId: MODULE,
        source: 'verify',
        features: [{
          featureName: FEATURE, category: 'Core', status: 'implemented',
          description: '', filePaths: [], reviewNotes: 'matched the manifest',
        }],
      }),
    );
    expect(rowFor(FEATURE)!.source).toBe('verify');
  });

  it('an unrecognized source cannot claim a stronger path than it can prove', async () => {
    await POST(
      req('/api/feature-matrix', 'POST', {
        moduleId: MODULE,
        source: 'trust-me',
        features: [{
          featureName: FEATURE, category: 'Core', status: 'implemented',
          description: '', filePaths: [], reviewNotes: '',
        }],
      }),
    );
    expect(rowFor(FEATURE)!.source).toBe('unknown');
  });
});

describe('review timestamps are stored in one canonical spelling', () => {
  it('normalizes an offset timestamp to UTC so lexical order matches chronological order', () => {
    // 2026-08-18T02:00:00+02:00 IS 2026-08-18T00:00:00Z — earlier than 01:00Z, but
    // as raw text it sorts AFTER it.
    const offset = '2026-08-18T02:00:00+02:00';
    const utcLater = '2026-08-18T01:00:00.000Z';
    expect(offset > utcLater).toBe(true); // the raw-string trap

    expect(normalizeReviewTimestamp(offset)).toBe('2026-08-18T00:00:00.000Z');
    expect(normalizeReviewTimestamp(offset)! < utcLater).toBe(true);

    seedReviewedRow(offset);
    expect(rowFor(FEATURE)!.lastReviewedAt).toBe('2026-08-18T00:00:00.000Z');
  });

  it('passes an unparseable value through rather than inventing "now"', () => {
    expect(normalizeReviewTimestamp('last tuesday')).toBe('last tuesday');
    expect(normalizeReviewTimestamp(null)).toBeNull();
  });
});
