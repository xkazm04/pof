/**
 * A request body that is not a JSON object is the CALLER's error. Every body-reading write
 * route of the catalog→UE API answers it with a 400 naming the problem — never a 500 (which
 * reads as a server fault and is retried), and never by running anything. Parity with the
 * /api/catalog callback (eb08f882) and the drain route (f62f5e06).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-malformed-body-${process.pid}.db`;
});

import { POST as lifecyclePOST } from '@/app/api/catalog/lifecycle/route';
import { POST as stepSubmitPOST } from '@/app/api/catalog/step-submit/route';
import { POST as catalogEntitiesPOST } from '@/app/api/catalog-entities/route';
import { POST as pipelinePOST } from '@/app/api/pipeline/route';
import { POST as artifactsPOST } from '@/app/api/pipeline-artifacts/route';
import { POST as revisionsPOST } from '@/app/api/pipeline-artifacts/revisions/route';
import { POST as settleTestPOST } from '@/app/api/pipeline-artifacts/drain/settle-test/route';
import { POST as workerPOST } from '@/app/api/pipeline-artifacts/drain/worker/route';

const ROUTES = [
  { path: 'catalog/lifecycle', post: lifecyclePOST },
  { path: 'catalog/step-submit', post: stepSubmitPOST },
  { path: 'catalog-entities', post: catalogEntitiesPOST },
  { path: 'pipeline', post: pipelinePOST },
  { path: 'pipeline-artifacts', post: artifactsPOST },
  { path: 'pipeline-artifacts/revisions', post: revisionsPOST },
  { path: 'pipeline-artifacts/drain/settle-test', post: settleTestPOST },
  { path: 'pipeline-artifacts/drain/worker', post: workerPOST },
] as const;

const req = (path: string, body: string) =>
  new NextRequest(`http://localhost/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });

describe.each(ROUTES)('POST /api/$path — non-object body', ({ path, post }) => {
  it.each(['{"catalogId":"items","entityId":', 'null', '[]', '"text"'])('answers %s with 400, not 500', async (body) => {
    const res = await post(req(path, body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(typeof json.error).toBe('string');
  });
});
