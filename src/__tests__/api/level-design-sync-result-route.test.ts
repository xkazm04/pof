/**
 * The sync loop's landing pad.
 *
 * Before this route existed the sync prompt told Claude to drop a JSON file into
 * `.pof/` that nothing read: `syncReport` was permanently empty, `lastCodeHash`
 * was never written, and two of the five sync states (`code-ahead`, `diverged`)
 * were unreachable. These tests drive a real divergence payload through the
 * callback route and assert the document now HOLDS it — plus the refusals, which
 * are the other half of the contract: a malformed report must be rejected with a
 * reason, never stored as an empty (and therefore reassuring) one.
 */
import { describe, it, expect, vi } from 'vitest';

// In-memory DB so the suite never touches ~/.pof/pof.db.
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/level-design/sync-result/route';
import { createDoc, getDoc } from '@/lib/level-design-db';
import type { SyncDivergence } from '@/types/level-design';

const URL_ = 'http://localhost/api/level-design/sync-result';

function post(body: unknown): NextRequest {
  return new NextRequest(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function send(body: unknown) {
  const res = await POST(post(body));
  return { status: res.status, body: await res.json() };
}

const DIVERGENCE: SyncDivergence = {
  roomId: 'room-1',
  roomName: 'Crypt Antechamber',
  field: 'difficulty',
  docValue: '3',
  codeValue: '5',
  severity: 'warning',
  suggestion: 'Lower DifficultyTier from 5 to 3 to match the design doc.',
};

function newDoc() {
  return createDoc({ name: `sync-${Date.now()}-${Math.random()}`, description: '' });
}

describe('POST /api/level-design/sync-result — a divergence report reaches the document', () => {
  it('stores a diverged verdict, its divergences, and the code fingerprint', async () => {
    const doc = newDoc();
    expect(doc.lastCodeHash).toBeNull();

    const { status, body } = await send({
      docId: doc.id,
      status: 'diverged',
      codeHash: 'abc1234',
      divergences: [DIVERGENCE],
    });

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.divergenceCount).toBe(1);

    const stored = getDoc(doc.id)!;
    expect(stored.syncStatus).toBe('diverged');
    expect(stored.lastCodeHash).toBe('abc1234');
    expect(stored.syncReport).toHaveLength(1);
    expect(stored.syncReport[0]).toMatchObject({ field: 'difficulty', docValue: '3', codeValue: '5' });
  });

  it('makes code-ahead reachable — the state the old file-drop path could never produce', async () => {
    const doc = newDoc();
    const { status } = await send({
      docId: doc.id,
      status: 'code-ahead',
      codeHash: 'deadbeef',
      divergences: [{ ...DIVERGENCE, field: 'encounterDesign', docValue: '', codeValue: 'Third wave of archers' }],
    });
    expect(status).toBe(201);
    expect(getDoc(doc.id)!.syncStatus).toBe('code-ahead');
  });

  it('coerces numeric doc/code values and defaults roomName to the id', async () => {
    const doc = newDoc();
    await send({
      docId: doc.id,
      status: 'diverged',
      codeHash: 'h1',
      divergences: [{ roomId: 'room-9', field: 'difficulty', docValue: 3, codeValue: 5, severity: 'info' }],
    });
    const stored = getDoc(doc.id)!.syncReport[0];
    expect(stored.docValue).toBe('3');
    expect(stored.codeValue).toBe('5');
    expect(stored.roomName).toBe('room-9');
    expect(stored.suggestion).toBe('');
  });
});

describe('POST /api/level-design/sync-result — refusals name their reason', () => {
  it('rejects an empty payload instead of storing an empty (reassuring) report', async () => {
    const doc = newDoc();
    await send({ docId: doc.id, status: 'synced', codeHash: 'first', divergences: [] });

    const { status, body } = await send({});
    expect(status).toBe(400);
    expect(body.error).toMatch(/Body is empty/);

    // The earlier verdict is untouched — a rejected report changes nothing.
    expect(getDoc(doc.id)!.lastCodeHash).toBe('first');
  });

  it.each([
    [{ status: 'diverged', codeHash: 'h', divergences: [] }, /docId must be a positive integer/],
    [{ docId: 1, status: 'unlinked', codeHash: 'h', divergences: [] }, /status must be one of/],
    [{ docId: 1, status: 'synced', divergences: [] }, /codeHash/],
    [{ docId: 1, status: 'synced', codeHash: 'h' }, /divergences must be an array/],
    [{ docId: 1, status: 'synced', codeHash: 'h', divergences: [{ ...DIVERGENCE }] }, /contradicts/],
    [{ docId: 1, status: 'diverged', codeHash: 'h', divergences: [] }, /no divergences/],
    [
      { docId: 1, status: 'diverged', codeHash: 'h', divergences: [{ ...DIVERGENCE, severity: 'catastrophic' }] },
      /severity must be one of/,
    ],
    [
      { docId: 1, status: 'diverged', codeHash: 'h', divergences: [{ ...DIVERGENCE, codeValue: '3' }] },
      /same value on both sides/,
    ],
    [
      { docId: 1, status: 'diverged', codeHash: 'h', divergences: [{ ...DIVERGENCE, roomId: '' }] },
      /roomId must not be empty/,
    ],
  ])('rejects %#', async (body, reason) => {
    const res = await send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(reason);
  });

  it('404s a report aimed at a document that does not exist', async () => {
    const { status, body } = await send({
      docId: 987654,
      status: 'synced',
      codeHash: 'h',
      divergences: [],
    });
    expect(status).toBe(404);
    expect(body.error).toMatch(/987654/);
  });
});
