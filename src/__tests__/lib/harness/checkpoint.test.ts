import { describe, it, expect } from 'vitest';
import {
  checkpointBranch,
  checkpointTag,
  lastGreenSha,
  recordCheckpoint,
  createCheckpointer,
  BASELINE_AREA_ID,
  type GitResult,
  type GitRunner,
  type CheckpointState,
} from '@/lib/harness/checkpoint';

// ── Test git double ───────────────────────────────────────────────────────────

const ok = (stdout = ''): GitResult => ({ stdout, stderr: '', exitCode: 0 });
const fail = (exitCode: number, stderr = ''): GitResult => ({ stdout: '', stderr, exitCode });

interface FakeOpts {
  isRepo?: boolean;
  hasHead?: boolean;
  commitFails?: boolean;
  dirty?: boolean;
}

/** A stateful in-memory git simulator: HEAD advances on commit, moves on reset. */
function makeFakeGit(opts: FakeOpts = {}) {
  const { isRepo = true, hasHead = true, commitFails = false, dirty = false } = opts;
  const calls: string[][] = [];
  let head = 'base000';
  let n = 0;
  let isDirty = dirty;
  const runner: GitRunner = async (args) => {
    calls.push(args);
    const [sub, a1] = args;
    if (sub === 'rev-parse' && a1 === '--git-dir') {
      return isRepo ? ok('.git') : fail(128, 'fatal: not a git repository');
    }
    if (sub === 'rev-parse' && a1 === 'HEAD') {
      return hasHead ? ok(head) : fail(128, 'fatal: ambiguous argument HEAD');
    }
    if (sub === 'status') {
      return ok(isDirty ? ' M src/wip.ts' : '');
    }
    if (sub === 'commit') {
      if (commitFails) return fail(1, 'nothing to commit, working tree clean');
      n += 1;
      head = `c${n}`;
      isDirty = false; // committing absorbs the dirty tree
      return ok(`[harness ${head}] checkpoint`);
    }
    if (sub === 'reset') {
      head = args[args.length - 1];
      return ok(`HEAD is now at ${head}`);
    }
    return ok('');
  };
  return { runner, calls, head: () => head };
}

const has = (calls: string[][], ...prefix: string[]) =>
  calls.some(c => prefix.every((p, i) => c[i] === p));

// ── Pure helpers ───────────────────────────────────────────────────────────────

describe('checkpointBranch', () => {
  it('prefixes with harness/ and keeps a clean run id', () => {
    expect(checkpointBranch('run_abc_123')).toBe('harness/run_abc_123');
  });
  it('sanitizes characters git refnames forbid', () => {
    expect(checkpointBranch('run a:b~c^d')).toBe('harness/run-a-b-c-d');
  });
});

describe('checkpointTag', () => {
  it('encodes run / area / iteration hierarchy', () => {
    expect(checkpointTag('run_x', 'AbilitySpellbook', 3)).toBe('harness/run_x/AbilitySpellbook-iter3');
  });
  it('sanitizes a messy areaId', () => {
    expect(checkpointTag('run_x', 'arpg-combat::Dodge Roll', 1)).toBe('harness/run_x/arpg-combat-Dodge-Roll-iter1');
  });
});

describe('lastGreenSha', () => {
  it('returns null with no checkpoints', () => {
    const state: CheckpointState = { branch: 'harness/run_x', checkpoints: [] };
    expect(lastGreenSha(state)).toBeNull();
  });
  it('returns the most recent checkpoint sha', () => {
    let state: CheckpointState = { branch: 'harness/run_x', checkpoints: [] };
    state = recordCheckpoint(state, { areaId: BASELINE_AREA_ID, iteration: 0, sha: 'base000', tag: '', timestamp: 't0' });
    state = recordCheckpoint(state, { areaId: 'A', iteration: 1, sha: 'c1', tag: 't', timestamp: 't1' });
    expect(lastGreenSha(state)).toBe('c1');
  });
});

describe('recordCheckpoint', () => {
  it('appends immutably (does not mutate the input state)', () => {
    const state: CheckpointState = { branch: 'harness/run_x', checkpoints: [] };
    const next = recordCheckpoint(state, { areaId: 'A', iteration: 1, sha: 'c1', tag: 't', timestamp: 't1' });
    expect(state.checkpoints).toHaveLength(0);
    expect(next.checkpoints).toHaveLength(1);
    expect(next.checkpoints[0].sha).toBe('c1');
  });
});

// ── Checkpointer ────────────────────────────────────────────────────────────────

describe('createCheckpointer.init', () => {
  it('creates the harness branch and records the baseline checkpoint', async () => {
    const git = makeFakeGit();
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    const ok = await cp.init();
    expect(ok).toBe(true);
    expect(has(git.calls, 'checkout', '-B', 'harness/run_x')).toBe(true);
    const state = cp.getState();
    expect(state.branch).toBe('harness/run_x');
    expect(state.checkpoints).toHaveLength(1);
    expect(state.checkpoints[0].areaId).toBe(BASELINE_AREA_ID);
    expect(state.checkpoints[0].sha).toBe('base000');
    expect(cp.lastGreen()).toBe('base000');
  });

  it('returns false (disabled) when the project is not a git repo', async () => {
    const git = makeFakeGit({ isRepo: false });
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    expect(await cp.init()).toBe(false);
    // Must NOT attempt to create a branch on a non-repo
    expect(has(git.calls, 'checkout', '-B')).toBe(false);
  });

  it('returns false when the repo has no commits (no HEAD baseline)', async () => {
    const git = makeFakeGit({ hasHead: false });
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    expect(await cp.init()).toBe(false);
  });

  it('commits a dirty tree as the baseline so rollback cannot wipe pre-run work', async () => {
    const git = makeFakeGit({ dirty: true });
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    expect(await cp.init()).toBe(true);
    // The baseline is the snapshot commit, NOT the bare pre-run HEAD: a
    // rollback to base000 would hard-reset away the uncommitted changes.
    expect(cp.lastGreen()).toBe('c1');
    expect(has(git.calls, 'add', '-A')).toBe(true);
    const state = cp.getState();
    expect(state.checkpoints[0].areaId).toBe(BASELINE_AREA_ID);
    expect(state.checkpoints[0].sha).toBe('c1');
  });

  it('refuses to enable checkpointing when the dirty-tree snapshot cannot be committed', async () => {
    const git = makeFakeGit({ dirty: true, commitFails: true });
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    // Better no checkpointing (no rollbacks at all) than a rollback armed to
    // destroy the user's uncommitted work.
    expect(await cp.init()).toBe(false);
    expect(cp.lastGreen()).toBeNull();
  });
});

describe('createCheckpointer.commitArea', () => {
  it('stages, commits, tags, and records a green checkpoint', async () => {
    const git = makeFakeGit();
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    await cp.init();
    const checkpoint = await cp.commitArea('A', 1);
    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.sha).toBe('c1');
    expect(checkpoint!.tag).toBe('harness/run_x/A-iter1');
    expect(has(git.calls, 'add', '-A')).toBe(true);
    expect(has(git.calls, 'commit')).toBe(true);
    expect(has(git.calls, 'tag', '-f', 'harness/run_x/A-iter1')).toBe(true);
    expect(cp.lastGreen()).toBe('c1');
  });

  it('returns null and leaves last-green unchanged when the commit fails', async () => {
    const git = makeFakeGit({ commitFails: true });
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    await cp.init();
    const checkpoint = await cp.commitArea('A', 1);
    expect(checkpoint).toBeNull();
    // last green stays at the baseline — no tag for a failed commit
    expect(cp.lastGreen()).toBe('base000');
    expect(has(git.calls, 'tag', '-f', 'harness/run_x/A-iter1')).toBe(false);
  });

  it('is a no-op returning null when never initialized', async () => {
    const git = makeFakeGit();
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    expect(await cp.commitArea('A', 1)).toBeNull();
  });
});

describe('createCheckpointer.rollbackToLastGreen', () => {
  it('resets --hard to the most recent green checkpoint', async () => {
    const git = makeFakeGit();
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    await cp.init();          // baseline base000
    await cp.commitArea('A', 1); // green c1
    // area B dirties the tree then exhausts retries → roll back
    const sha = await cp.rollbackToLastGreen();
    expect(sha).toBe('c1');
    expect(has(git.calls, 'reset', '--hard', 'c1')).toBe(true);
    expect(git.head()).toBe('c1');
  });

  it('rolls back to the baseline when no area has committed yet', async () => {
    const git = makeFakeGit();
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    await cp.init();
    const sha = await cp.rollbackToLastGreen();
    expect(sha).toBe('base000');
    expect(has(git.calls, 'reset', '--hard', 'base000')).toBe(true);
  });

  it('returns null (no reset) when there is no checkpoint to return to', async () => {
    const git = makeFakeGit();
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    // not initialized → no baseline
    const sha = await cp.rollbackToLastGreen();
    expect(sha).toBeNull();
    expect(has(git.calls, 'reset')).toBe(false);
  });

  it('preserves earlier passing work: rolling back keeps prior area commits', async () => {
    const git = makeFakeGit();
    const cp = createCheckpointer('run_x', '/proj', git.runner);
    await cp.init();             // base000
    await cp.commitArea('A', 1);  // c1
    await cp.commitArea('C', 2);  // c2  (a later area that also passed)
    // area B fails after these → reset to the latest green (c2), not the baseline
    const sha = await cp.rollbackToLastGreen();
    expect(sha).toBe('c2');
    expect(has(git.calls, 'reset', '--hard', 'c2')).toBe(true);
  });
});
