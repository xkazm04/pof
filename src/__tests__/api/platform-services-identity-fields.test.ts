/**
 * The two CLI callback routes used to test identity fields for truthiness only, so a
 * number or an object reached their stores (a better-sqlite3 bind throw, or a row
 * whose text column holds a coerced value). A non-string identity field is the
 * caller's error: 400 naming the field, and nothing is written.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-identity-fields-${process.pid}.db`;
});

import { POST as completePOST } from '@/app/api/checklist/complete/route';
import { POST as spendPOST } from '@/app/api/cli-spend/route';
import { getDb } from '@/lib/db';

const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const spendRows = () =>
  (getDb().prepare('SELECT COUNT(*) AS n FROM cli_spend').get() as { n: number }).n;
const progressRows = () =>
  (getDb().prepare('SELECT COUNT(*) AS n FROM project_progress').get() as { n: number }).n;

afterEach(() => cleanup());

describe('POST /api/checklist/complete - identity fields', () => {
  const base = { moduleId: 'materials', itemId: 'mat-1', projectPath: 'C:/tmp/pof-identity' };
  it.each([
    ['moduleId', 42],
    ['itemId', { x: 1 }],
    ['projectPath', 42],
    ['projectPath', ['a']],
  ])('refuses a non-string %s (%j) with 400 and writes nothing', async (field, value) => {
    const before = progressRows();
    const res = await completePOST(post('checklist/complete', { ...base, [field]: value }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain(field);
    expect(progressRows()).toBe(before);
  });
});

describe('POST /api/cli-spend - identity fields', () => {
  const base = { costUsd: 0.1 };
  it('records a well-typed run', async () => {
    const res = await spendPOST(post('cli-spend', { ...base, moduleId: 'm', taskType: 't', taskLabel: 'l', sessionKey: 's' }));
    expect(res.status).toBe(201);
  });
  it.each([
    ['moduleId', 42],
    ['taskType', { x: 1 }],
    ['taskLabel', 7],
    ['sessionKey', ['k']],
  ])('refuses a non-string %s (%j) with 400 and records no row', async (field, value) => {
    await spendPOST(post('cli-spend', { ...base })); // ensure the table exists
    const before = spendRows();
    const res = await spendPOST(post('cli-spend', { ...base, [field]: value }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain(field);
    expect(spendRows()).toBe(before);
  });
});
