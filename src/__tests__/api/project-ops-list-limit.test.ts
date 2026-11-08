/**
 * A list `limit` is a positive integer. NaN reached SQLite from parseInt/Number, and
 * a negative LIMIT means "every row" to SQLite, so limit=-1 dumped the whole table.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-project-ops-limit-${process.pid}.db`;
});

import { GET as sessionLogGET } from '@/app/api/session-log/route';
import { GET as telemetryGET } from '@/app/api/telemetry/route';

const routes = [
  ['session-log by project', sessionLogGET, 'http://localhost/api/session-log?projectPath=C%3A%2Fp'],
  ['session-log by module', sessionLogGET, 'http://localhost/api/session-log?moduleId=arpg-combat'],
  ['telemetry history', telemetryGET, 'http://localhost/api/telemetry?action=history'],
] as const;

describe('list limit validation', () => {
  for (const [name, handler, url] of routes) {
    it.each(['abc', '-1', '0', '1.5', '1e3', '99999'])(`${name}: limit=%s -> 400`, async (limit) => {
      const res = await handler(new NextRequest(`${url}&limit=${limit}`));
      expect(res.status).toBe(400);
    });
    it(`${name}: a valid or absent limit still answers`, async () => {
      expect((await handler(new NextRequest(`${url}&limit=10`))).status).toBe(200);
      expect((await handler(new NextRequest(url))).status).toBe(200);
    });
  }
});
