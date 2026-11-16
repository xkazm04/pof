/**
 * A request body that is not a JSON object is the CALLER's error. Every body-reading
 * write route of the platform-services API answers it with a 400 naming the problem —
 * never a 500 (which reads as a server fault, and which pof-mcp retries), never a 200
 * that saved an empty patch, and never by running anything (a cook, a UBT spawn, a
 * smoke launch, a paid Scenario call). Parity with the catalog→UE API (ab9ecf77) and
 * the Game Design Studio API (0ff33b75).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-platform-malformed-body-${process.pid}.db`;
});

// Anything that would start a process or spend money on a valid body.
const spawned = vi.fn();
vi.mock('@/lib/scenario', () => ({ generateTexture: async () => { spawned('scenario'); return {}; } }));
vi.mock('@/lib/visual-gen/seam-check', () => ({ detectSeamsFromUrl: async () => null }));
vi.mock('@/lib/packaging/scheduled-build-runner', () => ({
  tickScheduler: () => { spawned('tick'); return { ran: false }; },
  startScheduledRun: () => { spawned('run-now'); return { ran: true }; },
}));
vi.mock('@/lib/packaging/cook-jobs', () => ({
  startCookJob: () => { spawned('cook'); return { ok: false, error: 'mocked' }; },
  cookJobEventStream: () => null,
  COOK_SSE_HEADERS: {},
}));
vi.mock('@/lib/packaging/smoke-test', () => ({
  runSmokeTest: async () => { spawned('smoke'); return {}; },
  deriveGameImage: () => 'x',
  smokeResultNote: () => '',
}));
vi.mock('@/lib/packaging/process-utils', () => ({
  spawnCapture: async () => { spawned('ubt'); return { output: '' }; },
}));
vi.mock('@/lib/packaging/preflight-runner', () => ({
  runFastPreflight: async () => { spawned('fast'); return { results: [] }; },
}));

import { POST as checklistCompletePOST } from '@/app/api/checklist/complete/route';
import { PUT as checklistMetadataPUT } from '@/app/api/checklist-metadata/route';
import { POST as notifyGatePOST } from '@/app/api/notify/gate/route';
import { POST as cliSpendPOST } from '@/app/api/cli-spend/route';
import { POST as taskRegistryPOST } from '@/app/api/cli-task-registry/route';
import { POST as executePOST } from '@/app/api/packaging/execute/route';
import { POST as historyPOST } from '@/app/api/packaging/history/route';
import { POST as preflightPOST } from '@/app/api/packaging/preflight/route';
import { POST as profilesPOST } from '@/app/api/packaging/profiles/route';
import { POST as schedulePOST } from '@/app/api/packaging/schedule/route';
import { POST as smokePOST } from '@/app/api/packaging/smoke-test/route';
import { POST as marketplacePOST } from '@/app/api/marketplace/route';
import { POST as scanImportPOST, PATCH as scanImportPATCH } from '@/app/api/module-scan/import/route';
import { POST as tunePOST } from '@/app/api/preview/tune/route';
import { POST as scenarioPOST } from '@/app/api/scenario/route';

type Handler = (req: NextRequest) => Promise<Response>;

const ROUTES: { path: string; method: 'POST' | 'PUT' | 'PATCH'; handler: Handler }[] = [
  { path: 'checklist/complete', method: 'POST', handler: checklistCompletePOST },
  { path: 'checklist-metadata', method: 'PUT', handler: checklistMetadataPUT },
  { path: 'notify/gate', method: 'POST', handler: notifyGatePOST },
  { path: 'cli-spend', method: 'POST', handler: cliSpendPOST },
  { path: 'cli-task-registry', method: 'POST', handler: taskRegistryPOST },
  { path: 'packaging/execute', method: 'POST', handler: executePOST },
  { path: 'packaging/history', method: 'POST', handler: historyPOST },
  { path: 'packaging/preflight', method: 'POST', handler: preflightPOST },
  { path: 'packaging/profiles', method: 'POST', handler: profilesPOST },
  { path: 'packaging/schedule', method: 'POST', handler: schedulePOST },
  { path: 'packaging/smoke-test', method: 'POST', handler: smokePOST },
  { path: 'marketplace', method: 'POST', handler: marketplacePOST },
  { path: 'module-scan/import', method: 'POST', handler: scanImportPOST },
  { path: 'module-scan/import', method: 'PATCH', handler: scanImportPATCH },
  { path: 'preview/tune', method: 'POST', handler: tunePOST },
  { path: 'scenario', method: 'POST', handler: scenarioPOST },
];

const req = (path: string, method: string, body: string) =>
  new NextRequest(`http://localhost/api/${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body,
  });

describe.each(ROUTES)('$method /api/$path — non-object body', ({ path, method, handler }) => {
  it.each(['{"action":"save","profile":', 'null', '[]', '"text"', '42'])('answers %s with 400, not 500', async (body) => {
    const res = await handler(req(path, method, body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(typeof json.error).toBe('string');
    expect(spawned).not.toHaveBeenCalled();
  });
});
