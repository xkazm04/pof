/**
 * `POST /api/checklist/complete` used to do `progress[moduleId][itemId] = true`
 * with NO validation: any id a caller invented landed in
 * `project_progress.checklist_json`, where the checklist percentage, the feature
 * matrix and the module views — all of which key off the registry's declared
 * checklist ids — could never read it. `MaterialLayerGraph` shipped `mt-1`/`mt-2`/
 * `mt-3` (the materials QUICK-ACTION namespace) for as long as it existed.
 *
 * RED before this change: every case below was accepted and written verbatim.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-checklist-complete-${process.pid}.db`;
});

import { POST } from '@/app/api/checklist/complete/route';
import { getDb } from '@/lib/db';
import { resolveProgressKey, migrateProgressBlob } from '@/lib/checklist-progress-keys';
import { getModuleChecklist } from '@/lib/module-registry';

const PROJECT_PATH = 'C:/tmp/pof-checklist-validation';
// Same derivation the route uses, so a seeded row is the row it will read.
const PROJECT_ID = crypto
  .createHash('sha256')
  .update(PROJECT_PATH.toLowerCase().replace(/\\/g, '/'))
  .digest('hex')
  .slice(0, 16);

async function complete(moduleId: string, itemId: string) {
  const res = await POST(
    new NextRequest('http://localhost/api/checklist/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, itemId, projectPath: PROJECT_PATH }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

/** The stored blob — the test DB holds exactly this one project. */
function storedProgress(): Record<string, Record<string, boolean>> {
  const row = getDb()
    .prepare('SELECT checklist_json FROM project_progress')
    .get() as { checklist_json: string } | undefined;
  return row ? JSON.parse(row.checklist_json) : {};
}

function seedProgress(progress: Record<string, Record<string, boolean>>) {
  getDb()
    .prepare(
      `INSERT INTO project_progress (project_id, checklist_json, health_json, verification_json, history_json, updated_at)
       VALUES (?, ?, '{}', '{}', '{}', datetime('now'))`,
    )
    .run(PROJECT_ID, JSON.stringify(progress));
}

beforeEach(() => {
  getDb().prepare('DELETE FROM project_progress').run();
});

describe('resolveProgressKey', () => {
  it('accepts a declared checklist item', () => {
    expect(resolveProgressKey('materials', 'mat-1').kind).toBe('checklist');
  });

  it('refuses an id no checklist item and no declared surface owns, with a reason', () => {
    const v = resolveProgressKey('materials', 'mat-99');
    expect(v.kind).toBe('unknown');
    if (v.kind === 'unknown') {
      expect(v.reason).toContain('mat-99');
      expect(v.reason).toContain('materials');
      // The reason names what IS declared, so the caller can fix itself.
      expect(v.reason).toContain('mat-1');
    }
  });

  it('refuses the retired materials graph namespace it cannot map', () => {
    const v = resolveProgressKey('materials', 'mt-9');
    expect(v.kind).toBe('unknown');
  });

  it('maps a recorded orphan onto the checklist item it always meant', () => {
    const v = resolveProgressKey('materials', 'mt-3');
    expect(v.kind).toBe('migrate');
    if (v.kind === 'migrate') expect(v.to).toBe('mat-1');
  });

  it('accepts a declared auxiliary surface (animations Setup Guide + scanned states)', () => {
    expect(resolveProgressKey('animations', 'step-mixamo-download').kind).toBe('aux');
    expect(resolveProgressKey('animations', 'anim-idle').kind).toBe('aux');
    expect(resolveProgressKey('animations', 'scanned-Attack01').kind).toBe('aux');
  });

  it('does not silently accept a typo in an auxiliary namespace it does not own', () => {
    expect(resolveProgressKey('animations', 'stepp-mixamo').kind).toBe('unknown');
  });
});

describe('migrateProgressBlob', () => {
  it('moves an orphan key onto its real id and reports the move', () => {
    const { progress, migrations } = migrateProgressBlob({
      materials: { 'mt-3': true, 'mt-2': true, 'mat-6': true },
    });
    expect(progress.materials).toEqual({ 'mat-1': true, 'mat-3': true, 'mat-6': true });
    expect(migrations).toEqual([
      { moduleId: 'materials', from: 'mt-3', to: 'mat-1' },
      { moduleId: 'materials', from: 'mt-2', to: 'mat-3' },
    ]);
  });

  it('never downgrades a completion when an orphan collides with its target', () => {
    const { progress } = migrateProgressBlob({ materials: { 'mt-3': true, 'mat-1': false } });
    expect(progress.materials['mat-1']).toBe(true);
  });

  it('leaves everything it does not recognise exactly as it found it', () => {
    const blob = { animations: { 'step-animbp': true, 'scanned-Idle': true } };
    const { progress, migrations } = migrateProgressBlob(blob);
    expect(progress).toEqual(blob);
    expect(migrations).toHaveLength(0);
  });
});

describe('POST /api/checklist/complete', () => {
  it('refuses an unknown itemId with 400 + a reason and writes NOTHING', async () => {
    const { status, body } = await complete('materials', 'mt-3-typo');

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('mt-3-typo');
    expect(storedProgress()).toEqual({});
  });

  it('accepts a real checklist item and stores it under its own id', async () => {
    const { status, body } = await complete('materials', 'mat-1');

    expect(status).toBe(200);
    expect(body.data.itemId).toBe('mat-1');
    expect(storedProgress().materials).toEqual({ 'mat-1': true });
  });

  it('records a retired graph id under the real checklist item, and says it did', async () => {
    const { status, body } = await complete('materials', 'mt-3');

    expect(status).toBe(200);
    expect(body.data.itemId).toBe('mat-1');
    expect(body.data.requestedItemId).toBe('mt-3');
    const materials = storedProgress().materials;
    expect(materials['mat-1']).toBe(true);
    expect(materials['mt-3']).toBeUndefined();
  });

  it('migrates orphan keys already sitting in the stored blob on the next write', async () => {
    seedProgress({ materials: { 'mt-2': true } });

    const { body } = await complete('materials', 'mat-6');

    expect(body.data.migratedKeys).toContain('materials: mt-2 → mat-3');
    const materials = storedProgress().materials;
    expect(materials['mat-3']).toBe(true);
    expect(materials['mat-6']).toBe(true);
    expect(materials['mt-2']).toBeUndefined();
  });

  it('still accepts the animations Setup Guide steps, which own their own keys', async () => {
    const { status } = await complete('animations', 'step-mixamo-download');

    expect(status).toBe(200);
    expect(storedProgress().animations).toEqual({ 'step-mixamo-download': true });
  });
});

describe('MaterialLayerGraph node ids', () => {
  // The graph's contract with the registry, asserted where CI can see it: a node
  // id that stops resolving means the graph can never unlock again.
  it('are all real materials checklist items', () => {
    const declared = getModuleChecklist('materials').map((i) => i.id);
    for (const id of ['mat-1', 'mat-2', 'mat-3']) {
      expect(declared).toContain(id);
      expect(resolveProgressKey('materials', id).kind).toBe('checklist');
    }
  });
});
