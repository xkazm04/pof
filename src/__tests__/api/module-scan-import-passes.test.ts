/**
 * `/api/module-scan/import` stores findings of EVERY pass the Scan tab can run.
 *
 * The DB is built BEFORE the app opens it, with `eval_findings` exactly as db.ts
 * ships it — the 3-pass CHECK — and one existing finding. A fresh DB built by
 * the fixed code would hide the constraint that silently dropped the row
 * (INSERT OR IGNORE swallows a CHECK violation). Throwaway temp file only.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const DB_FILE = vi.hoisted(() => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const nodeFs = require('fs') as typeof import('fs');
  const Sqlite = require('better-sqlite3') as typeof import('better-sqlite3');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const dbPath = `${dir}/pof-test-module-scan-passes-${process.pid}.db`;
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (nodeFs.existsSync(p)) nodeFs.unlinkSync(p);
  }
  const raw = new Sqlite(dbPath);
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
    CREATE INDEX idx_eval_findings_scan ON eval_findings(scan_id, module_id);
    CREATE INDEX idx_eval_findings_severity ON eval_findings(severity, module_id);
  `);
  raw.prepare(
    `INSERT INTO eval_findings (id, scan_id, module_id, pass, category, severity, file, line, description, suggested_fix, effort, created_at, resolved_at)
     VALUES ('scan-arpg-combat-0-0', 'scan-arpg-combat-0', 'arpg-combat', 'quality', 'Tick cost', 'medium',
             'Source/B.cpp', 40, 'Ticks every frame', 'Use a timer', 'small', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')`,
  ).run();
  raw.pragma('user_version = 4');
  raw.close();
  process.env.POF_DB_PATH = dbPath;
  return dbPath;
});

import Database from 'better-sqlite3';
import { GET, POST } from '@/app/api/module-scan/import/route';
import type { ScanFinding } from '@/types/scan';

const URL_BASE = 'http://localhost/api/module-scan/import';

function post(body: unknown) {
  return POST(new NextRequest(URL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function peek<T>(sql: string, ...args: unknown[]): T[] {
  const raw = new Database(DB_FILE, { readonly: true });
  try {
    return raw.prepare(sql).all(...args) as T[];
  } finally {
    raw.close();
  }
}

const FINDING = {
  category: 'Missing parent',
  severity: 'high',
  file: 'Source/A.h',
  line: 3,
  description: 'UARPGAbility parent not found',
  suggestedFix: 'inventory first',
  effort: 'small',
};

describe('POST stores findings of every pass the scan ran', () => {
  it('a ground-truth finding against the shipped 3-pass CHECK is stored and read back', async () => {
    const res = await post({ moduleId: 'arpg-combat', passes: ['ground-truth', 'structure'], findings: [{ pass: 'ground-truth', ...FINDING }] });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.imported).toBe(1);

    const got = await GET(new NextRequest(`${URL_BASE}?moduleId=arpg-combat`));
    const findings = (await got.json()).data.findings as ScanFinding[];
    const stored = findings.find((f) => f.scanId === json.data.scanId);
    expect(stored?.pass).toBe('ground-truth');
    expect(stored?.description).toBe(FINDING.description);

    // The pre-existing row survived the widening, resolution intact; indexes too.
    expect(peek<{ resolved_at: string }>("SELECT resolved_at FROM eval_findings WHERE id = 'scan-arpg-combat-0-0'"))
      .toEqual([{ resolved_at: '2026-01-02T00:00:00.000Z' }]);
    expect(peek<{ name: string }>("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='eval_findings' AND sql IS NOT NULL ORDER BY name")
      .map((r) => r.name)).toEqual(['idx_eval_findings_scan', 'idx_eval_findings_severity']);
  });

  it('a combat-trace finding is stored, and the scan record counts exactly the rows stored', async () => {
    const res = await post({ moduleId: 'arpg-combat', passes: ['combat-trace'], findings: [{ pass: 'combat-trace', ...FINDING }] });
    expect(res.status).toBe(200);
    const { scanId } = (await res.json()).data as { scanId: string };
    const [scan] = peek<{ finding_count: number }>('SELECT finding_count FROM module_scans WHERE scan_id = ?', scanId);
    const [{ c }] = peek<{ c: number }>('SELECT COUNT(*) AS c FROM eval_findings WHERE scan_id = ?', scanId);
    expect(c).toBe(1);
    expect(scan.finding_count).toBe(c);
  });

  it('[guard] a finding of an unknown pass 400s — the vocabulary stays closed', async () => {
    const res = await post({ moduleId: 'arpg-combat', passes: ['structure'], findings: [{ pass: 'bogus', ...FINDING }] });
    expect(res.status).toBe(400);
  });
});
