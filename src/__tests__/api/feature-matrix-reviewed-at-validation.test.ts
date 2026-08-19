/**
 * `reviewedAt` is the evidence date the GDD compliance engine ages every module's
 * score against — and the import route wrote whatever text the CLI report supplied
 * straight into `last_reviewed_at`, unvalidated. "yesterday" and "2026-13-45" landed
 * in the column verbatim and then sorted against real timestamps by raw character
 * order.
 *
 * These were RED before this change: garbage was accepted and stored.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fm-reviewedat-${process.pid}.db`;
});

import { POST, parseReviewedAt } from '@/app/api/feature-matrix/import/route';
import { getFeaturesByModule, clearModuleFeatures } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const FEATURE = MODULE_FEATURE_DEFINITIONS[MODULE]![0].featureName;

async function importWith(reviewedAt: unknown) {
  const res = await POST(
    new NextRequest('http://localhost/api/feature-matrix/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId: MODULE,
        reviewedAt,
        features: [{ featureName: FEATURE, category: 'Core', status: 'implemented' }],
      }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  clearModuleFeatures(MODULE);
});

describe('parseReviewedAt', () => {
  const GARBAGE = ['yesterday', '2026-13-45', '18/08/2026', 'NaN', '2026-08-18T99:99:99Z', ''.padEnd(3, 'x')];

  it.each(GARBAGE)('rejects %j with a reason instead of storing it', (value) => {
    const r = parseReviewedAt(value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('reviewedAt');
  });

  it('rejects a non-string rather than coercing it', () => {
    expect(parseReviewedAt(1755475200000).ok).toBe(false);
    expect(parseReviewedAt({ when: 'now' }).ok).toBe(false);
  });

  it('accepts a full ISO timestamp and keeps it', () => {
    const r = parseReviewedAt('2026-08-18T12:34:56.000Z');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('2026-08-18T12:34:56.000Z');
  });

  it('accepts a date-only value and widens it to an unambiguous instant', () => {
    const r = parseReviewedAt('2026-08-18');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('2026-08-18T00:00:00.000Z');
  });

  it('canonicalizes an offset timestamp to UTC so date order is not character order', () => {
    const r = parseReviewedAt('2026-08-18T02:00:00+02:00');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('2026-08-18T00:00:00.000Z');
  });

  it('defaults to now only when the report supplied nothing at all', () => {
    const r = parseReviewedAt(undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Number.isNaN(Date.parse(r.value))).toBe(false);
  });
});

describe('POST /api/feature-matrix/import', () => {
  it('rejects a garbage reviewedAt with 400 and writes NO rows', async () => {
    const { status, body } = await importWith('yesterday');

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('not an ISO-8601 date');
    // The rejection happens before any write — a report that cannot date itself
    // must not be able to date rows the compliance engine reads.
    expect(getFeaturesByModule(MODULE)).toHaveLength(0);
  });

  it('accepts a valid ISO reviewedAt and stores the canonical form', async () => {
    const { status, body } = await importWith('2026-08-18T02:00:00+02:00');

    expect(status).toBe(200);
    expect(body.data.reviewedAt).toBe('2026-08-18T00:00:00.000Z');
    expect(body.data.source).toBe('review');
    expect(getFeaturesByModule(MODULE)[0].lastReviewedAt).toBe('2026-08-18T00:00:00.000Z');
  });
});
