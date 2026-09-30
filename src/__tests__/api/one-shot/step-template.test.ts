/**
 * The one-shot deterministic branch persists `step.produce(entity)` for a DRAFT and grades it. A
 * data-blind body writes the catalog exemplar's content (Captain Vael's stats for any character),
 * so that row is a TEMPLATE, not this entity's content: it grades `pending` with a `TEMPLATE:`
 * reason naming the exemplar, and the persisted row carries the stamp. Real registry, throwaway DB.
 */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-oneshot-template-${process.pid}.db`;
});

import { POST } from '@/app/api/one-shot/step/route';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';

const post = (body: unknown) => new NextRequest('http://localhost/api/one-shot/step', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/one-shot/step — deterministic stub for a draft is a TEMPLATE', () => {
  it('grades pending with a TEMPLATE: reason and persists the exemplar stamp', async () => {
    const res = await POST(post({
      catalogId: 'characters', entityId: 'draft-characters-1', stepLabel: 'Stat Block', mode: 'deterministic',
      proposal: { name: 'Goblin Shaman', data: { role: 'caster' } },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('pending');
    expect(String(body.data.reason).startsWith('TEMPLATE:')).toBe(true);
    const row = listArtifacts('characters', 'draft-characters-1').find((a) => a.step === 'Stat Block');
    expect(row?.status).toBe('pending');
    expect((row?.data as { template?: { exemplar?: string } }).template?.exemplar).toBe('char-captain-vael');
  });
});
