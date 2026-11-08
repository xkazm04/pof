/**
 * A present field of the wrong kind is a caller mistake. These bodies used to reach
 * `.map`, `.slice` or the better-sqlite3 bind layer and come back as a 500, or were
 * stored as a value no reader understands (an unknown session event, a numeric path).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-project-ops-fields-${process.pid}.db`;
});

import { POST as errorMemoryPOST } from '@/app/api/error-memory/route';
import { POST as recentPOST } from '@/app/api/recent-projects/route';
import { POST as sessionLogPOST } from '@/app/api/session-log/route';
import { POST as analyticsPOST } from '@/app/api/session-analytics/route';
import { POST as telemetryPOST } from '@/app/api/telemetry/route';
import { POST as dagPOST } from '@/app/api/workflow-dag/route';
import { POST as progressPOST } from '@/app/api/project-progress/route';

type Handler = (req: NextRequest) => Promise<Response>;
const send = (h: Handler, body: unknown) => h(new NextRequest('http://localhost/api/x', { method: 'POST', body: JSON.stringify(body) }));

const log = { action: 'log', tabId: 't', sessionKey: 's', moduleId: 'arpg-combat', event: 'started' };
const session = { moduleId: 'arpg-combat', sessionKey: 's', prompt: 'p' };

const refused: [string, Handler, unknown][] = [
  ['error-memory errors as a string', errorMemoryPOST, { action: 'record-errors', moduleId: 'arpg-combat', errors: 'boom' }],
  ['error-memory a null error entry', errorMemoryPOST, { action: 'record-errors', moduleId: 'arpg-combat', errors: [null] }],
  ['error-memory a non-string message', errorMemoryPOST, { action: 'record-errors', moduleId: 'arpg-combat', errors: [{ message: 7 }] }],
  ['error-memory taskKeywords as a string', errorMemoryPOST, { action: 'get-relevant-errors', moduleId: 'arpg-combat', taskKeywords: 'x' }],
  ['error-memory a non-string fingerprint', errorMemoryPOST, { action: 'mark-resolved', moduleId: 'arpg-combat', fingerprint: {} }],
  ['recent-projects numeric projectPath', recentPOST, { action: 'save', projectName: 'n', projectPath: 7 }],
  ['recent-projects object projectName', recentPOST, { action: 'save', projectName: {}, projectPath: 'C:/p' }],
  ['recent-projects numeric ueVersion', recentPOST, { action: 'save', projectName: 'n', projectPath: 'C:/p', ueVersion: 5 }],
  ['recent-projects object projectId on touch', recentPOST, { action: 'touch', projectId: {} }],
  ['recent-projects object projectId on remove', recentPOST, { action: 'remove', projectId: {} }],
  ['session-log unknown event', sessionLogPOST, { ...log, event: 'exploded' }],
  ['session-log object tabId', sessionLogPOST, { ...log, tabId: {} }],
  ['session-log non-boolean success', sessionLogPOST, { ...log, success: 'yes' }],
  ['session-log non-numeric durationMs', sessionLogPOST, { ...log, durationMs: 'x' }],
  ['session-log object projectPath on cancel-open', sessionLogPOST, { action: 'cancel-open', projectPath: {} }],
  ['session-analytics numeric prompt', analyticsPOST, { ...session, prompt: 7 }],
  ['session-analytics object sessionKey', analyticsPOST, { ...session, sessionKey: {} }],
  ['session-analytics non-numeric durationMs', analyticsPOST, { ...session, durationMs: 'x' }],
  ['session-analytics non-boolean success', analyticsPOST, { ...session, success: 'yes' }],
  ['session-analytics unparseable startedAt', analyticsPOST, { ...session, startedAt: 'soon' }],
  ['telemetry numeric projectPath on scan', telemetryPOST, { action: 'scan', projectPath: 7 }],
  ['telemetry non-object dynamicContext', telemetryPOST, { action: 'scan', projectPath: 'C:/p', dynamicContext: 'x' }],
  ['telemetry non-array classes', telemetryPOST, { action: 'scan', projectPath: 'C:/p', dynamicContext: { classes: 'x' } }],
  ['workflow-dag non-object workflow', dagPOST, { action: 'validate', workflow: 'x' }],
  ['workflow-dag nodes not an array', dagPOST, { action: 'validate', workflow: { nodes: 'x' } }],
  ['workflow-dag a node without dependsOn', dagPOST, { action: 'validate', workflow: { nodes: [{ id: 'a' }] } }],
  ['project-progress numeric projectPath', progressPOST, { projectPath: 7 }],
  ['project-progress checklistProgress as a string', progressPOST, { projectPath: 'C:/p', checklistProgress: 'x' }],
  ['project-progress moduleHealth as an array', progressPOST, { projectPath: 'C:/p', moduleHealth: [1] }],
];

describe('project-ops field validation', () => {
  it.each(refused)('%s -> 400', async (_label, handler, body) => {
    const res = await send(handler, body);
    expect(res.status).toBe(400);
  });

  it('well-formed bodies still succeed', async () => {
    const ok: [Handler, unknown][] = [
      [errorMemoryPOST, { action: 'record-errors', moduleId: 'arpg-combat', errors: [{ message: 'C2065 boom', code: null, file: null }] }],
      [errorMemoryPOST, { action: 'get-relevant-errors', moduleId: 'arpg-combat' }],
      [recentPOST, { action: 'save', projectName: 'n', projectPath: 'C:/ok' }],
      [sessionLogPOST, { ...log, projectPath: '', success: true }],
      [analyticsPOST, { ...session, durationMs: 10, success: true, startedAt: new Date().toISOString() }],
      [telemetryPOST, { action: 'scan', projectPath: 'C:/ok', dynamicContext: null }],
      [dagPOST, { action: 'validate', workflow: { nodes: [{ id: 'a', label: 'A', dependsOn: [] }] } }],
      [progressPOST, { projectPath: 'C:/ok', checklistProgress: { 'arpg-combat': { x: true } } }],
    ];
    for (const [handler, body] of ok) expect((await send(handler, body)).status).toBeLessThan(300);
  });
});
