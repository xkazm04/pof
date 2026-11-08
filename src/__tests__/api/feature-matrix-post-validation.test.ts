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

import { POST } from '@/app/api/feature-matrix/route';
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
