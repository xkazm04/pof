/**
 * `AudioPipelineDiagram` keyed its three nodes on `au-1..au-3` — the audio
 * module's QUICK-ACTION namespace, which mirrors the `aud-1..aud-3` checklist
 * one-for-one but belongs to no checklist item. Wave 14's route guard ACCEPTED
 * those keys with a logged `gap`, because a plain rename would have reset every
 * existing user's diagram unlock state.
 *
 * The keys now MIGRATE instead of being accepted. The two claims this suite
 * exists to hold:
 *   1. an existing `au-2: true` blob surfaces as `aud-2` complete, and
 *   2. a collision NEVER downgrades a completion — no user loses an unlock.
 *
 * RED before this change: `au-*` resolved as `kind: 'aux'` with a `gap`, and
 * `migrateProgressBlob` left the orphan keys sitting where nothing reads them.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-checklist-audio-${process.pid}.db`;
});

import { POST } from '@/app/api/checklist/complete/route';
import { getDb } from '@/lib/db';
import {
  resolveProgressKey,
  migrateProgressBlob,
  AUX_PROGRESS_SURFACES,
  ORPHAN_KEY_MIGRATIONS,
} from '@/lib/checklist-progress-keys';
import { getModuleChecklist } from '@/lib/module-registry';

const PROJECT_PATH = 'C:/tmp/pof-checklist-audio-migration';
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

describe('the retired audio diagram namespace', () => {
  it('is no longer an ACCEPTED auxiliary surface with a logged gap', () => {
    // The gap string existed to record an owed fix. It is owed no longer, and a
    // note that no longer applies is a claim the code cannot back.
    expect(AUX_PROGRESS_SURFACES.audio).toBeUndefined();
  });

  it('is declared as a migration onto the checklist ids it mirrors', () => {
    expect(ORPHAN_KEY_MIGRATIONS.audio).toEqual({
      'au-1': 'aud-1',
      'au-2': 'aud-2',
      'au-3': 'aud-3',
    });
  });

  it('resolves each old key to a migration, not an accepted orphan', () => {
    for (const [from, to] of Object.entries({ 'au-1': 'aud-1', 'au-2': 'aud-2', 'au-3': 'aud-3' })) {
      const v = resolveProgressKey('audio', from);
      expect(v.kind).toBe('migrate');
      if (v.kind === 'migrate') expect(v.to).toBe(to);
    }
  });

  it('still refuses an id in that namespace it cannot map', () => {
    expect(resolveProgressKey('audio', 'au-9').kind).toBe('unknown');
  });
});

describe('migrateProgressBlob — audio', () => {
  it('surfaces an existing "au-2: true" blob as aud-2 complete', () => {
    const { progress, migrations } = migrateProgressBlob({ audio: { 'au-2': true } });

    expect(progress.audio['aud-2']).toBe(true);
    expect(progress.audio['au-2']).toBeUndefined();
    expect(migrations).toEqual([{ moduleId: 'audio', from: 'au-2', to: 'aud-2' }]);
  });

  it('never downgrades a completion when the old key collides with its target', () => {
    // Both iteration orders, because object key order is the only thing that
    // separates them and a user's unlock must not depend on it.
    expect(migrateProgressBlob({ audio: { 'au-2': true, 'aud-2': false } }).progress.audio['aud-2']).toBe(true);
    expect(migrateProgressBlob({ audio: { 'aud-2': false, 'au-2': true } }).progress.audio['aud-2']).toBe(true);
  });

  it('keeps an already-earned unlock when the OLD key is the false one', () => {
    expect(migrateProgressBlob({ audio: { 'au-3': false, 'aud-3': true } }).progress.audio['aud-3']).toBe(true);
    expect(migrateProgressBlob({ audio: { 'aud-3': true, 'au-3': false } }).progress.audio['aud-3']).toBe(true);
  });

  it('migrates the whole diagram at once without losing a layer', () => {
    const { progress } = migrateProgressBlob({
      audio: { 'au-1': true, 'au-2': true, 'au-3': false, 'aud-5': true },
    });
    expect(progress.audio).toEqual({ 'aud-1': true, 'aud-2': true, 'aud-3': false, 'aud-5': true });
  });
});

describe('POST /api/checklist/complete — audio', () => {
  it('records a retired diagram id under the real checklist item, and says it did', async () => {
    const { status, body } = await complete('audio', 'au-2');

    expect(status).toBe(200);
    expect(body.data.itemId).toBe('aud-2');
    expect(body.data.requestedItemId).toBe('au-2');
    const audio = storedProgress().audio;
    expect(audio['aud-2']).toBe(true);
    expect(audio['au-2']).toBeUndefined();
  });

  it('migrates an existing au-* unlock already in the blob on the next write', async () => {
    seedProgress({ audio: { 'au-2': true } });

    const { body } = await complete('audio', 'aud-1');

    expect(body.data.migratedKeys).toContain('audio: au-2 → aud-2');
    const audio = storedProgress().audio;
    expect(audio['aud-2']).toBe(true); // the unlock survived the migration
    expect(audio['aud-1']).toBe(true);
    expect(audio['au-2']).toBeUndefined();
  });

  it('accepts the new diagram ids directly as declared checklist items', async () => {
    const { status, body } = await complete('audio', 'aud-3');

    expect(status).toBe(200);
    expect(body.data.itemId).toBe('aud-3');
    expect(body.data.requestedItemId).toBe('aud-3');
  });
});

describe('AudioPipelineDiagram node ids', () => {
  // The diagram's contract with the registry, asserted where CI can see it.
  it('are all real audio checklist items', () => {
    const declared = getModuleChecklist('audio').map((i) => i.id);
    for (const id of ['aud-1', 'aud-2', 'aud-3']) {
      expect(declared).toContain(id);
      expect(resolveProgressKey('audio', id).kind).toBe('checklist');
    }
  });
});
