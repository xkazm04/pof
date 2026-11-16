/**
 * A request body that is not a JSON object is the CALLER's error. Every body-reading
 * write route of the Game Design Studio API answers it with a 400 naming the problem —
 * never a 500 (which reads as a server fault, and which pof-mcp retries), and never by
 * running anything. Parity with the catalog→UE API (ab9ecf77) and the blender bridge
 * (aef4589b).
 *
 * Before this test, each of these handlers either `await req.json()`-ed bare (truncated
 * JSON → SyntaxError → 500) or read a field off a `null` body (TypeError → 500).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gds-malformed-body-${process.pid}.db`;
});

// batch-review spawns the Claude CLI on a valid body; a refused body must never get there.
const startExecution = vi.fn(() => 'exec-never');
vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: () => startExecution(),
  getExecution: () => null,
  subscribeToExecution: () => () => {},
  abortExecution: () => {},
}));

import { POST as abilitySpecPOST } from '@/app/api/ability-spec/route';
import { POST as featureMatrixPOST, PATCH as featureMatrixPATCH } from '@/app/api/feature-matrix/route';
import { POST as batchReviewPOST } from '@/app/api/feature-matrix/batch-review/route';
import { POST as importPOST } from '@/app/api/feature-matrix/import/route';
import { POST as gddPOST } from '@/app/api/game-design-doc/route';
import { POST as gddCompliancePOST } from '@/app/api/gdd-compliance/route';
import { POST as gameDirectorPOST } from '@/app/api/game-director/route';
import { POST as balanceBaselinePOST } from '@/app/api/balance-baseline/route';
import { POST as combatPOST } from '@/app/api/combat-simulator/route';
import { POST as economyPOST } from '@/app/api/economy-simulator/route';
import { POST as goalSeekPOST } from '@/app/api/economy-simulator/goal-seek/route';
import { POST as sweepPOST } from '@/app/api/economy-simulator/sweep/route';
import { POST as localizationPOST } from '@/app/api/localization-pipeline/route';

type Handler = (req: NextRequest) => Promise<Response>;

const ROUTES: { path: string; method: 'POST' | 'PATCH'; handler: Handler }[] = [
  { path: 'ability-spec', method: 'POST', handler: abilitySpecPOST },
  { path: 'feature-matrix', method: 'POST', handler: featureMatrixPOST },
  { path: 'feature-matrix', method: 'PATCH', handler: featureMatrixPATCH },
  { path: 'feature-matrix/batch-review', method: 'POST', handler: batchReviewPOST },
  { path: 'feature-matrix/import', method: 'POST', handler: importPOST },
  { path: 'game-design-doc', method: 'POST', handler: gddPOST },
  { path: 'gdd-compliance', method: 'POST', handler: gddCompliancePOST },
  { path: 'game-director', method: 'POST', handler: gameDirectorPOST },
  { path: 'balance-baseline', method: 'POST', handler: balanceBaselinePOST },
  { path: 'combat-simulator', method: 'POST', handler: combatPOST },
  { path: 'economy-simulator', method: 'POST', handler: economyPOST },
  { path: 'economy-simulator/goal-seek', method: 'POST', handler: goalSeekPOST },
  { path: 'economy-simulator/sweep', method: 'POST', handler: sweepPOST },
  { path: 'localization-pipeline', method: 'POST', handler: localizationPOST },
];

const req = (path: string, method: string, body: string) =>
  new NextRequest(`http://localhost/api/${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body,
  });

describe.each(ROUTES)('$method /api/$path — non-object body', ({ path, method, handler }) => {
  it.each(['{"action":"simulate","config":', 'null', '[]', '"text"', '42'])('answers %s with 400, not 500', async (body) => {
    const res = await handler(req(path, method, body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(typeof json.error).toBe('string');
    expect(startExecution).not.toHaveBeenCalled();
  });
});
