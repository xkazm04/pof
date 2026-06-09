import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Fresh in-memory DB per import so persisted rows are inspectable.
vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  return { getDb: () => db };
});

// Mock the child process so executeBuild never spawns a real UBT.
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, default: { ...actual }, spawn: spawnMock };
});

import { executeBuild, generateBuildId, getBuildHistory } from '@/lib/ue5-bridge/build-pipeline';
import type { BuildRequest } from '@/types/ue5-bridge';

const REQUEST: BuildRequest = {
  projectPath: 'C:\\proj',
  targetName: 'PoF',
  ueVersion: '5.7',
  platform: 'Win64',
  configuration: 'Development',
  targetType: 'Editor',
};

/** Make spawn return a proc that immediately fails to start (error path). */
function spawnFailsToStart() {
  spawnMock.mockImplementation(() => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: null;
      stderr: null;
      kill: () => void;
    };
    proc.stdout = null;
    proc.stderr = null;
    proc.kill = () => {};
    queueMicrotask(() => proc.emit('error', new Error('spawn failed')));
    return proc;
  });
}

describe('generateBuildId', () => {
  it('produces ids in the build-<epoch>-<rand> format', () => {
    const id = generateBuildId();
    expect(id).toMatch(/^build-\d+-[a-z0-9]+$/);
  });

  it('produces distinct ids on successive calls', () => {
    const ids = new Set([generateBuildId(), generateBuildId(), generateBuildId()]);
    expect(ids.size).toBe(3);
  });
});

describe('executeBuild build id threading', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('uses the caller-supplied buildId for the result and the persisted DB row', async () => {
    spawnFailsToStart();
    const buildId = 'build-queue-supplied-123';

    const result = await executeBuild(REQUEST, { buildId });

    // The event-stream id (queue) and the result id must be identical.
    expect(result.buildId).toBe(buildId);

    // ...and the SAME id must land in build history, so the UI can correlate
    // a live build event to its stored row.
    const history = getBuildHistory(REQUEST.projectPath, 10);
    expect(history.some((b) => b.buildId === buildId)).toBe(true);
  });

  it('falls back to a generated id when no buildId option is supplied', async () => {
    spawnFailsToStart();

    const result = await executeBuild(REQUEST);

    expect(result.buildId).toMatch(/^build-\d+-[a-z0-9]+$/);
  });
});
