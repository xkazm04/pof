/**
 * POST/PATCH /api/feature-matrix — the write side validates what it stores.
 *
 * The house shape for API bodies: a malformed row is a 400 naming it, never a row
 * stored and then silently reshaped (or discarded) on read. Each case below pins one
 * place the full-upsert route used to be laxer than its sibling `/import` route.
 *
 * Runs the real route against the real SQLite schema (throwaway DB).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fm-post-validation-${process.pid}.db`;
});

import { POST, PATCH } from '@/app/api/feature-matrix/route';
import { getDb } from '@/lib/db';
import { getFeaturesByModule } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;

const send = (method: 'POST' | 'PATCH', body: unknown, handler = POST) =>
  handler(new NextRequest('http://localhost/api/feature-matrix', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

const row = (over: Record<string, unknown> = {}) => ({
  featureName: 'Combo Chain', category: 'Core', status: 'implemented',
  description: '', filePaths: ['Source/Combat.cpp'], reviewNotes: '', ...over,
});

beforeEach(() => {
  getDb().prepare('DELETE FROM feature_matrix').run();
});

describe('POST /api/feature-matrix — filePaths elements', () => {
  it('refuses a non-string filePaths element with a 400 and stores nothing', async () => {
    const res = await send('POST', { moduleId: MODULE, features: [row({ filePaths: ['ok.cpp', 1, null] })] });
    expect(res.status).toBe(400);
    expect(getFeaturesByModule(MODULE)).toHaveLength(0);
  });

  it('still accepts a string-only filePaths array', async () => {
    const res = await send('POST', { moduleId: MODULE, features: [row()] });
    expect(res.status).toBe(200);
    expect(getFeaturesByModule(MODULE)[0].filePaths).toEqual(['Source/Combat.cpp']);
  });
});

describe('POST /api/feature-matrix — row status is a closed enum', () => {
  // PATCH refuses an unknown status (400); POST used to coerce it to 'unknown'
  // (validateStatus), so a typo overwrote a real verdict with "never evaluated".
  it('refuses a row whose status is outside FEATURE_STATUSES and keeps the stored verdict', async () => {
    expect((await send('POST', { moduleId: MODULE, features: [row()] })).status).toBe(200);
    const res = await send('POST', { moduleId: MODULE, features: [row({ status: 'Implemented' })] });
    expect(res.status).toBe(400);
    expect(getFeaturesByModule(MODULE)[0].status).toBe('implemented');
  });

  it('refuses a row with no status', async () => {
    const { status: _omit, ...noStatus } = row();
    void _omit;
    const res = await send('POST', { moduleId: MODULE, features: [noStatus] });
    expect(res.status).toBe(400);
  });
});

describe('POST/PATCH /api/feature-matrix — moduleId is a closed enum (SUB_MODULE_IDS)', () => {
  // The import route refuses an id outside SUB_MODULE_IDS (be772ed6); the full-upsert
  // and status routes only checked truthiness, so an unknown id wrote rows nothing reads.
  it('POST refuses an unknown moduleId and writes nothing', async () => {
    const res = await send('POST', { moduleId: 'not-a-module', features: [row()] });
    expect(res.status).toBe(400);
    expect(getFeaturesByModule('not-a-module' as SubModuleId)).toHaveLength(0);
  });

  it('PATCH refuses an unknown moduleId with a 400, not a 404', async () => {
    const res = await send('PATCH', { moduleId: 'not-a-module', featureName: 'Combo Chain', status: 'improved' }, PATCH);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/feature-matrix — optional row fields are type-checked', () => {
  // An object nextSteps / lastReviewedAt reached the better-sqlite3 bind and failed as a
  // 500; qualityScore of the wrong type was silently stored as null. All three are 400s.
  it.each([
    ['nextSteps', {}],
    ['lastReviewedAt', {}],
    ['qualityScore', 'high'],
  ])('refuses a wrong-typed %s with a 400 naming it and stores nothing', async (field, value) => {
    const res = await send('POST', { moduleId: MODULE, features: [row({ [field]: value })] });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain(field);
    expect(getFeaturesByModule(MODULE)).toHaveLength(0);
  });

  it('still accepts absent, null and correctly typed optional fields', async () => {
    const res = await send('POST', {
      moduleId: MODULE,
      features: [row({ nextSteps: 'wire it', qualityScore: 4, lastReviewedAt: '2026-01-01T00:00:00.000Z' }), row({ featureName: 'B', nextSteps: null, qualityScore: null, lastReviewedAt: null })],
    });
    expect(res.status).toBe(200);
  });
});
