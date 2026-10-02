/**
 * `/api/module-scan/import` — every scan is a record, reconciled against the
 * unresolved findings before it; resolutions are durable and reversible.
 *
 * The DB is built BEFORE the app opens it, the way the field DB looks today:
 * stamped `user_version = 3`, with an `eval_findings` table that has no
 * `resolved_at` column and two findings from an earlier scan. A fresh test DB
 * would hide both a missing schema-version bump and a 3-pass `passes` enum.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const DB_FILE = vi.hoisted(() => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const nodeFs = require('fs') as typeof import('fs');
  const Sqlite = require('better-sqlite3') as typeof import('better-sqlite3');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const dbPath = `${dir}/pof-test-module-scans-${process.pid}.db`;
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (nodeFs.existsSync(p)) nodeFs.unlinkSync(p);
  }
  const raw = new Sqlite(dbPath);
  // eval_findings exactly as it shipped at schema version 3 (no resolved_at).
  raw.exec(`
    CREATE TABLE eval_findings (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      pass TEXT NOT NULL CHECK(pass IN ('structure', 'quality', 'performance')),
      category TEXT NOT NULL DEFAULT 'General',
      severity TEXT NOT NULL DEFAULT 'medium'
        CHECK(severity IN ('critical', 'high', 'medium', 'low')),
      file TEXT,
      line INTEGER,
      description TEXT NOT NULL DEFAULT '',
      suggested_fix TEXT NOT NULL DEFAULT '',
      effort TEXT NOT NULL DEFAULT 'medium'
        CHECK(effort IN ('trivial', 'small', 'medium', 'large')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  const insert = raw.prepare(
    `INSERT INTO eval_findings (id, scan_id, module_id, pass, category, severity, file, line, description, suggested_fix, effort, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insert.run('scan-arpg-combat-1-0', 'scan-arpg-combat-1', 'arpg-combat', 'structure', 'Null check', 'high',
    'Source/A.cpp', 12, 'Owner is dereferenced unchecked', 'Guard it', 'small', '2026-01-01T00:00:00.000Z');
  insert.run('scan-arpg-combat-1-1', 'scan-arpg-combat-1', 'arpg-combat', 'quality', 'Tick cost', 'medium',
    'Source/B.cpp', 40, 'Ticks every frame', 'Use a timer', 'small', '2026-01-01T00:00:00.000Z');
  raw.pragma('user_version = 3');
  raw.close();
  process.env.POF_DB_PATH = dbPath;
  return dbPath;
});

import Database from 'better-sqlite3';
import { GET, POST, PATCH } from '@/app/api/module-scan/import/route';
import type { ScanDelta, ScanFinding } from '@/types/scan';

const URL_BASE = 'http://localhost/api/module-scan/import';

function send(method: 'POST' | 'PATCH', body: unknown) {
  const req = new NextRequest(URL_BASE, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return method === 'POST' ? POST(req) : PATCH(req);
}

async function getData(query: string) {
  const res = await GET(new NextRequest(`${URL_BASE}?${query}`));
  const json = await res.json();
  expect(json.success).toBe(true);
  return json.data as { findings: ScanFinding[]; delta?: ScanDelta | null };
}

function peek<T>(sql: string, ...args: unknown[]): T[] {
  const raw = new Database(DB_FILE, { readonly: true });
  try {
    return raw.prepare(sql).all(...args) as T[];
  } finally {
    raw.close();
  }
}

describe('POST records every scan, including a clean one', () => {
  it('a default 4-pass scan with zero findings, against an existing v3 DB, is recorded and clears prior findings', async () => {
    const res = await send('POST', {
      moduleId: 'arpg-combat',
      passes: ['ground-truth', 'structure', 'quality', 'performance'],
      findings: [],
    });
    expect(res.status).toBe(200);

    const scans = peek<{ module_id: string; passes_json: string; finding_count: number }>(
      'SELECT module_id, passes_json, finding_count FROM module_scans',
    );
    expect(scans).toHaveLength(1);
    expect(scans[0].finding_count).toBe(0);
    expect(JSON.parse(scans[0].passes_json)).toEqual(['ground-truth', 'structure', 'quality', 'performance']);

    const cols = peek<{ name: string }>('PRAGMA table_info(eval_findings)').map((c) => c.name);
    expect(cols).toContain('resolved_at');
    const version = peek<{ user_version: number }>('PRAGMA user_version')[0].user_version;
    expect(version).toBeGreaterThan(3);

    const { delta } = await getData('moduleId=arpg-combat&view=delta');
    expect(delta).toBeTruthy();
    expect(delta!.scan.findingCount).toBe(0);
    expect(delta!.cleared).toContain('scan-arpg-combat-1-0');
    expect(delta!.new).toEqual([]);
    expect(delta!.persisting).toEqual([]);
  });

  it('[guard] one invalid finding still 400s and writes neither findings nor a scan record', async () => {
    const before = {
      findings: peek<{ c: number }>('SELECT COUNT(*) AS c FROM eval_findings')[0].c,
      scans: peek<{ c: number }>('SELECT COUNT(*) AS c FROM module_scans')[0].c,
    };
    const res = await send('POST', {
      moduleId: 'arpg-combat',
      passes: ['structure'],
      findings: [
        { pass: 'structure', category: 'Ok', severity: 'high', file: 'Source/C.cpp', line: null, description: 'fine' },
        { pass: 'structure', category: 'Bad', severity: 'urgent', file: 'Source/D.cpp', line: null, description: 'bad' },
      ],
    });
    expect(res.status).toBe(400);
    expect(peek<{ c: number }>('SELECT COUNT(*) AS c FROM eval_findings')[0].c).toBe(before.findings);
    expect(peek<{ c: number }>('SELECT COUNT(*) AS c FROM module_scans')[0].c).toBe(before.scans);
  });
});

describe('PATCH resolves durably and can be undone', () => {
  it('stamps resolvedAt, drops the finding from delta.prior, and resolved:false clears it again', async () => {
    const res = await send('PATCH', { moduleId: 'arpg-combat', ids: ['scan-arpg-combat-1-0'], resolved: true });
    expect(res.status).toBe(200);

    let data = await getData('moduleId=arpg-combat&view=delta');
    const resolved = data.findings.find((f) => f.id === 'scan-arpg-combat-1-0');
    expect(resolved?.resolvedAt).toBeTruthy();
    expect(data.delta!.prior).not.toContain('scan-arpg-combat-1-0');
    expect(data.delta!.cleared).not.toContain('scan-arpg-combat-1-0');

    const undo = await send('PATCH', { moduleId: 'arpg-combat', ids: ['scan-arpg-combat-1-0'], resolved: false });
    expect(undo.status).toBe(200);
    data = await getData('moduleId=arpg-combat&view=delta');
    expect(data.findings.find((f) => f.id === 'scan-arpg-combat-1-0')?.resolvedAt).toBeFalsy();
    expect(data.delta!.prior).toContain('scan-arpg-combat-1-0');
  });
});
