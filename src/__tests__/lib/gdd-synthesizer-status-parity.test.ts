/**
 * `synthesizeGDD` must read the feature matrix the way the rest of the app does.
 *
 * `improved` is a DONE status: the compliance engine credits it as implemented
 * (`DONE_STATUSES`, `calculateConformance`). The synthesizer counted only
 * `status === 'implemented'`, so a module whose rows were all `improved` read as 0%
 * implemented in the GDD headline, pie and review trend, and its rows showed ❓.
 *
 * Runs the real synthesizer against the real SQLite schema (throwaway DB).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gdd-synth-status-parity-${process.pid}.db`;
});

import { synthesizeGDD } from '@/lib/gdd-synthesizer';
import { getDb } from '@/lib/db';
import { normalizeProjectId } from '@/lib/project-id';

const MODULE = 'arpg-combat';
const PROJECT = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';

function insertFeature(featureName: string, status: string, projectPath = PROJECT, moduleId = MODULE) {
  getDb()
    .prepare(
      `INSERT INTO feature_matrix
         (module_id, feature_name, category, status, description, file_paths, review_notes, next_steps, last_reviewed_at, project_id)
       VALUES (?, ?, 'Core', ?, '', '[]', '', '', '2026-08-19T00:00:00.000Z', ?)`,
    )
    .run(moduleId, featureName, status, normalizeProjectId(projectPath));
}

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM feature_matrix').run();
  db.prepare('DELETE FROM review_snapshots').run();
});

describe('synthesizeGDD — improved counts as implemented', () => {
  it('counts improved rows in the headline implemented figure', () => {
    insertFeature('Combo Chain', 'improved');
    insertFeature('Hit Stop', 'implemented');
    insertFeature('Parry', 'missing');
    const gdd = synthesizeGDD('PoF', {}, PROJECT);
    expect(gdd.stats.totalFeatures).toBe(3);
    expect(gdd.stats.implementedFeatures).toBe(2);
  });

  it('gives an improved row a done icon, not the unknown one', () => {
    // `animations` (Content) — a category the Core Systems section renders today.
    insertFeature('Combo Chain', 'improved', PROJECT, 'animations');
    const gdd = synthesizeGDD('PoF', {}, PROJECT);
    const text = JSON.stringify(gdd.sections);
    expect(text).toContain('| Combo Chain | ✅ improved |');
  });

  it('plots improved rows in the review trend', () => {
    getDb()
      .prepare(
        `INSERT INTO review_snapshots (module_id, reviewed_at, total, implemented, improved, partial, missing, unknown, avg_quality, project_id)
         VALUES (?, '2026-08-19T00:00:00.000Z', 4, 1, 3, 0, 0, 0, 4, ?)`,
      )
      .run(MODULE, normalizeProjectId(PROJECT));
    insertFeature('Combo Chain', 'improved');
    const gdd = synthesizeGDD('PoF', {}, PROJECT);
    const trend = gdd.sections.find((s) => s.id === 'roadmap')?.mermaid ?? '';
    expect(trend).toContain('bar [100]');
  });
});
