/**
 * A body that is not a JSON object is the CALLER's error. Every body-reading write
 * handler of the project-ops API answers it with a 400 naming the problem, never a
 * 500 from a SyntaxError or from reading a field off null. Parity with the
 * platform-services API (c42651e0) and project-health POST (ff5f7864).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-project-ops-malformed-${process.pid}.db`;
});

import { POST as progressPOST } from '@/app/api/project-progress/route';
import { POST as rulesPOST } from '@/app/api/project-rules/route';
import { POST as recentPOST } from '@/app/api/recent-projects/route';
import { POST as analyticsPOST } from '@/app/api/session-analytics/route';
import { POST as sessionLogPOST } from '@/app/api/session-log/route';
import { POST as telemetryPOST } from '@/app/api/telemetry/route';
import { POST as errorMemoryPOST } from '@/app/api/error-memory/route';
import { PUT as milestonePUT } from '@/app/api/milestone-deadlines/route';
import { POST as dagPOST } from '@/app/api/workflow-dag/route';

const handlers = [
  ['project-progress POST', progressPOST],
  ['project-rules POST', rulesPOST],
  ['recent-projects POST', recentPOST],
  ['session-analytics POST', analyticsPOST],
  ['session-log POST', sessionLogPOST],
  ['telemetry POST', telemetryPOST],
  ['error-memory POST', errorMemoryPOST],
  ['milestone-deadlines PUT', milestonePUT],
  ['workflow-dag POST', dagPOST],
] as const;

const bodies = [['malformed JSON', '{not json'], ['null', 'null'], ['an array', '[]'], ['a string', '"text"'], ['a number', '42']] as const;

describe('project-ops write handlers refuse a non-object body', () => {
  for (const [name, handler] of handlers) {
    it.each(bodies)(`${name}: %s -> 400`, async (_label, raw) => {
      const res = await handler(new NextRequest('http://localhost/api/x', { method: 'POST', body: raw }));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { success: boolean }).success).toBe(false);
    });
  }
});
