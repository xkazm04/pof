/**
 * One scan-pass vocabulary. `EvalPass` / `PASS_LABELS` is the only authority;
 * every other surface that names a pass (the table CHECK, the model-facing
 * callback hint, the Scan tab's selector and counts) derives from it.
 *
 * The DB cases run on a throwaway in-memory database — never the real pof.db.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { renderHook, cleanup } from '@testing-library/react';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false, session: null }),
}));

const { storeState } = vi.hoisted(() => ({
  storeState: {
    current: {
      scanResults: {} as Record<string, unknown[]>,
      addScanFindings: () => {},
      clearScanFindings: () => {},
      resolveScanFinding: () => {},
    },
  },
}));

vi.mock('@/stores/moduleStore', () => {
  const useModuleStore = (sel: (s: typeof storeState.current) => unknown) => sel(storeState.current);
  useModuleStore.getState = () => storeState.current;
  return { useModuleStore };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  EVAL_PASSES,
  EVAL_PASS_VOCABULARY,
  PASS_LABELS,
  getEvaluableModuleIds,
  getPassesForModule,
  isEvalPass,
} from '@/lib/evaluator/module-eval-prompts';
import { ensureEvalFindingsPassVocabulary } from '@/lib/evaluator/scan-findings-db';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import { useScanTab } from '@/components/modules/core-engine/ScanTab/useScanTab';

describe('EVAL_PASS_VOCABULARY is the one pass authority', () => {
  it('equals the keys of the exhaustive PASS_LABELS, and every module pass list is a subset', () => {
    expect(EVAL_PASS_VOCABULARY).toEqual(Object.keys(PASS_LABELS));
    expect([...EVAL_PASS_VOCABULARY]).toEqual(['ground-truth', 'structure', 'quality', 'performance', 'combat-trace']);
    for (const id of getEvaluableModuleIds()) {
      for (const pass of getPassesForModule(id)) expect(EVAL_PASS_VOCABULARY).toContain(pass);
    }
    expect(isEvalPass('combat-trace')).toBe(true);
    expect(isEvalPass('bogus')).toBe(false);
  });
});

/** eval_findings exactly as db.ts ships it: the 3-pass CHECK, plus its two indexes. */
const SHIPPED_DDL = `
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
`;

function tableSql(db: Database.Database): string {
  return (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='eval_findings'").get() as { sql: string }).sql;
}

function indexNames(db: Database.Database): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='eval_findings' AND sql IS NOT NULL ORDER BY name")
    .all() as { name: string }[]).map((r) => r.name);
}

describe('ensureEvalFindingsPassVocabulary', () => {
  it('widens a 3-pass CHECK in place: rows, resolved_at and both indexes survive; a second call is a no-op', () => {
    const db = new Database(':memory:');
    try {
      db.exec(SHIPPED_DDL);
      const insert = db.prepare(
        `INSERT INTO eval_findings (id, scan_id, module_id, pass, category, severity, file, line, description, suggested_fix, effort, created_at, resolved_at)
         VALUES (?, 's1', 'arpg-combat', ?, 'Cat', 'high', 'Source/A.h', 3, 'd', 'f', 'small', '2026-01-01T00:00:00.000Z', ?)`,
      );
      insert.run('f0', 'structure', null);
      insert.run('f1', 'quality', '2026-02-03T04:05:06.789Z');
      insert.run('f2', 'performance', null);
      const before = db.prepare('SELECT * FROM eval_findings ORDER BY id').all();

      ensureEvalFindingsPassVocabulary(db);

      expect(db.prepare('SELECT * FROM eval_findings ORDER BY id').all()).toEqual(before);
      const resolved = db.prepare("SELECT resolved_at FROM eval_findings WHERE id = 'f1'").get() as { resolved_at: string };
      expect(resolved.resolved_at).toBe('2026-02-03T04:05:06.789Z');
      const ddl = tableSql(db);
      for (const pass of EVAL_PASS_VOCABULARY) expect(ddl).toContain(`'${pass}'`);
      expect(indexNames(db)).toEqual(['idx_eval_findings_scan', 'idx_eval_findings_severity']);
      // The widened CHECK accepts every pass and still rejects an unknown one.
      expect(() => insert.run('f3', 'combat-trace', null)).not.toThrow();
      expect(() => insert.run('f4', 'bogus', null)).toThrow();

      const schemaBefore = db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY name').all();
      ensureEvalFindingsPassVocabulary(db);
      expect(tableSql(db)).toBe(ddl);
      expect(db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY name').all()).toEqual(schemaBefore);
      expect(db.prepare('SELECT COUNT(*) AS c FROM eval_findings').get()).toEqual({ c: 4 });
    } finally {
      db.close();
    }
  });
});

describe('the scan callback names exactly the passes the scan ran', () => {
  const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };
  const ORIGIN = 'http://localhost:3000';
  const passLine = (prompt: string) => prompt.split('\n').find((l) => l.trim().startsWith('"pass":'))?.trim();

  it('a structure+quality scan offers only those two', () => {
    const prompt = buildTaskPrompt(TaskFactory.moduleScan('arpg-combat', ['structure', 'quality'], ORIGIN, 'Combat Scan'), CTX);
    expect(passLine(prompt)).toBe('"pass": "structure|quality",');
  });

  it('the default 4-pass scan offers all four, ground-truth included', () => {
    const prompt = buildTaskPrompt(TaskFactory.moduleScan('arpg-combat', [...EVAL_PASSES], ORIGIN, 'Combat Scan'), CTX);
    expect(passLine(prompt)).toBe('"pass": "ground-truth|structure|quality|performance",');
  });
});

describe('the Scan tab offers the module\'s own passes', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('arpg-combat offers 5 (combat-trace reachable), selects the 4 defaults, and counts one key per offered pass', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useScanTab('arpg-combat'));
    expect(result.current.passOptions).toEqual(getPassesForModule('arpg-combat'));
    expect(result.current.passOptions).toContain('combat-trace');
    expect([...result.current.selectedPasses]).toEqual(EVAL_PASSES);
    expect(Object.keys(result.current.passCounts).sort()).toEqual([...result.current.passOptions].sort());
  });
});
