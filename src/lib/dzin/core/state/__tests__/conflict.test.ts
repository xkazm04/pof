import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  acquireUserLock,
  releaseUserLock,
  getUserLockedPaths,
  applyLLMPatchWithConflictCheck,
} from '../conflict';
import type { StreamController } from '../streaming';

function mockStream(): StreamController {
  return {
    start: vi.fn(),
    applyPatch: vi.fn(),
    commit: vi.fn(),
    abort: vi.fn(),
    isActive: vi.fn(() => true),
  };
}

describe('conflict resolution', () => {
  afterEach(() => {
    // Clear any locks between tests
    for (const p of getUserLockedPaths()) {
      releaseUserLock(p);
    }
  });

  it('acquireUserLock locks a JSON Pointer path', () => {
    acquireUserLock('/panels/0');
    expect(getUserLockedPaths()).toContain('/panels/0');
  });

  it('releaseUserLock releases a locked path', () => {
    acquireUserLock('/panels/0');
    releaseUserLock('/panels/0');
    expect(getUserLockedPaths()).not.toContain('/panels/0');
  });

  it('applyLLMPatchWithConflictCheck skips patches targeting locked paths', () => {
    const stream = mockStream();
    acquireUserLock('/panels/0');

    const result = applyLLMPatchWithConflictCheck(stream, {
      op: 'replace',
      path: '/panels/0/density',
      value: 'compact',
    });

    expect(result).toBe(false);
    expect(stream.applyPatch).not.toHaveBeenCalled();
  });

  it('applyLLMPatchWithConflictCheck applies patches to unlocked paths', () => {
    const stream = mockStream();

    const result = applyLLMPatchWithConflictCheck(stream, {
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1' },
    });

    expect(result).toBe(true);
    expect(stream.applyPatch).toHaveBeenCalledOnce();
  });

  it('nested paths are covered (lock on /panels/0 blocks /panels/0/density)', () => {
    const stream = mockStream();
    acquireUserLock('/panels/0');

    const result = applyLLMPatchWithConflictCheck(stream, {
      op: 'replace',
      path: '/panels/0/density',
      value: 'micro',
    });

    expect(result).toBe(false);
    expect(stream.applyPatch).not.toHaveBeenCalled();
  });
});
