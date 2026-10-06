import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DAILY_REVIEW_CAP,
  parseArgs,
  probeApp,
  readLedger,
  recordReview,
  runReview,
  type FetchLike,
  type RunnerDeps,
  type RunnerOptions,
} from '@/lib/evaluator/review-runner';

const ORIGIN = 'http://app.test';
const ROUTE = `${ORIGIN}/api/feature-matrix/batch-review`;
const TODAY = '2026-10-06';
const NOW = new Date(2026, 9, 6, 12, 0, 0); // local noon, so localDay() === TODAY

let dir: string;
let ledgerPath: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'review-runner-'));
  ledgerPath = join(dir, 'ledger.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const entry = (batchId: string) => ({ moduleId: 'combat', batchId, at: NOW.toISOString() });
const onDisk = () => JSON.parse(readFileSync(ledgerPath, 'utf8')) as { date: string; count: number; runs: unknown[] };

const opts = (over: Partial<RunnerOptions> = {}): RunnerOptions => ({
  moduleId: 'combat',
  projectPath: 'C:\\Games\\PoF',
  ueVersion: '5.7.3',
  projectName: 'PoF',
  origin: ORIGIN,
  write: true,
  ledgerPath,
  ...over,
});

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const batchOf = (status: string, modStatus: string, error: string | null = null, batchId = 'batch-1') => ({
  batchId,
  status,
  modules: [{ moduleId: 'combat', status: modStatus, error }],
});

interface StubApp {
  fetch: FetchLike;
  posts: { body: Record<string, unknown> }[];
  gets: number;
}

/** A stub of the batch-review route. Anything but GET/POST on ROUTE throws. */
function stubApp(cfg: {
  /** GET answers in order; the last repeats. */
  gets: (() => ReturnType<typeof json> | Promise<never>)[];
  post?: ReturnType<typeof json>;
}): StubApp {
  const app: StubApp = { fetch: undefined as unknown as FetchLike, posts: [], gets: 0 };
  app.fetch = async (url, init) => {
    if (url !== ROUTE) throw new Error(`unexpected URL ${url}`);
    if (init?.method === 'POST') {
      app.posts.push({ body: JSON.parse(init.body ?? '{}') });
      if (!cfg.post) throw new Error('unexpected POST');
      return cfg.post;
    }
    const get = cfg.gets[Math.min(app.gets, cfg.gets.length - 1)];
    app.gets++;
    return get();
  };
  return app;
}

const idle = () => json(200, { success: true, data: { batch: null } });
const started = (batchId = 'batch-1') => json(200, { success: true, data: { batchId, moduleCount: 1, totalFeatures: 5 } });

function deps(app: StubApp, over: Partial<RunnerDeps> = {}): RunnerDeps & { lines: string[] } {
  const lines: string[] = [];
  let t = NOW.getTime();
  return {
    fetch: app.fetch,
    now: () => new Date(t),
    env: {},
    log: (l) => lines.push(l),
    sleep: async (ms) => {
      t += ms;
    },
    lines,
    ...over,
  };
}

describe('recordReview / readLedger', () => {
  it('increments what is on disk: three calls read back 1, 2, 3', () => {
    for (const n of [1, 2, 3]) {
      recordReview(ledgerPath, TODAY, entry(`b${n}`));
      expect(onDisk().count).toBe(n);
      expect(readLedger(ledgerPath, TODAY).count).toBe(n);
    }
    expect(onDisk().runs).toHaveLength(3);
  });

  it('resets to 1 on a different date', () => {
    recordReview(ledgerPath, '2026-10-05', entry('old1'));
    recordReview(ledgerPath, '2026-10-05', entry('old2'));
    expect(readLedger(ledgerPath, TODAY).count).toBe(0);
    recordReview(ledgerPath, TODAY, entry('new'));
    expect(onDisk()).toMatchObject({ date: TODAY, count: 1 });
    expect(onDisk().runs).toHaveLength(1);
  });

  it('reads a missing file as count 0 and refuses to read a corrupt one as zero', () => {
    expect(readLedger(ledgerPath, TODAY)).toEqual({ date: TODAY, count: 0, runs: [] });
    writeFileSync(ledgerPath, '{not json');
    expect(() => readLedger(ledgerPath, TODAY)).toThrow();
    writeFileSync(ledgerPath, JSON.stringify({ hello: 'world' }));
    expect(() => readLedger(ledgerPath, TODAY)).toThrow(/not a review-runner ledger/);
  });
});

describe('runReview --write', () => {
  it('POSTs the route body, counts at once, and reports a completed module', async () => {
    const app = stubApp({
      gets: [idle, () => json(200, { success: true, data: { batch: batchOf('running', 'running') } }), () => json(200, { success: true, data: { batch: batchOf('completed', 'completed') } })],
      post: started(),
    });
    const d = deps(app);
    const out = await runReview(opts(), d);
    expect(out).toMatchObject({ ok: true, kind: 'reviewed', batchId: 'batch-1' });
    expect(app.posts).toEqual([
      { body: { projectPath: 'C:\\Games\\PoF', projectName: 'PoF', ueVersion: '5.7.3', appOrigin: ORIGIN, moduleIds: ['combat'] } },
    ]);
    expect(onDisk()).toMatchObject({ date: TODAY, count: 1 });
  });

  it('counts BEFORE polling: a poll that never resolves the module still leaves the count on disk', async () => {
    const app = stubApp({ gets: [idle, () => { throw new Error('app crashed'); }], post: started() });
    const out = await runReview(opts(), deps(app, { timeoutMs: 1_000, pollMs: 500 }));
    expect(out.kind).toBe('timeout');
    expect(out.ok).toBe(false);
    expect(onDisk().count).toBe(1);
  });

  it('refuses the 4th review of the day with no POST', async () => {
    const posted: number[] = [];
    for (let i = 1; i <= DAILY_REVIEW_CAP; i++) {
      const app = stubApp({ gets: [idle, () => json(200, { success: true, data: { batch: batchOf('completed', 'completed', null, `b${i}`) } })], post: started(`b${i}`) });
      expect((await runReview(opts(), deps(app))).ok).toBe(true);
      posted.push(app.posts.length);
    }
    expect(posted).toEqual([1, 1, 1]);
    expect(onDisk().count).toBe(3);

    const app = stubApp({ gets: [idle], post: started() });
    const out = await runReview(opts(), deps(app));
    expect(out).toMatchObject({ ok: false, kind: 'refused' });
    expect(out.message).toMatch(/3 \/ 3/);
    expect(app.posts).toHaveLength(0);
    expect(onDisk().count).toBe(3);
  });

  it('reports an errored module as a failure with its reason, never success', async () => {
    const app = stubApp({
      gets: [idle, () => json(200, { success: true, data: { batch: batchOf('error', 'error', 'timeout: no callback') } })],
      post: started(),
    });
    const out = await runReview(opts(), deps(app));
    expect(out).toMatchObject({ ok: false, kind: 'failed' });
    expect(out.message).toContain('timeout: no callback');
    expect(onDisk().count).toBe(1); // it did spend a run
  });

  it.each([
    [400, 'Unknown or undefined module id(s): nope'],
    [409, 'A batch review is already running'],
  ])('a %i from the POST is reported with its reason and does NOT count', async (status, error) => {
    const app = stubApp({ gets: [idle], post: json(status, { success: false, error }) });
    const out = await runReview(opts({ moduleId: 'nope' }), deps(app));
    expect(out).toMatchObject({ ok: false, kind: 'failed' });
    expect(out.message).toContain(error);
    expect(app.posts).toHaveLength(1);
    expect(existsSync(ledgerPath)).toBe(false);
  });
});

describe('runReview refusals and dry-run', () => {
  it('dry-run prints the plan and neither POSTs nor writes the ledger', async () => {
    const app = stubApp({ gets: [idle] });
    const d = deps(app);
    const out = await runReview(opts({ write: false }), d);
    expect(out).toMatchObject({ ok: true, kind: 'dry-run' });
    expect(app.posts).toHaveLength(0);
    expect(existsSync(ledgerPath)).toBe(false);
    const plan = d.lines.join('\n');
    expect(plan).toContain('combat');
    expect(plan).toContain('C:\\Games\\PoF');
    expect(plan).toContain('5.7.3');
    expect(plan).toContain('0 / 3');
  });

  it('dry-run leaves an existing ledger byte-identical', async () => {
    recordReview(ledgerPath, TODAY, entry('b1'));
    const before = readFileSync(ledgerPath, 'utf8');
    const out = await runReview(opts({ write: false }), deps(stubApp({ gets: [idle] })));
    expect(out.message).toContain('1 / 3');
    expect(readFileSync(ledgerPath, 'utf8')).toBe(before);
  });

  it.each([
    ['fetch rejects', () => { throw new Error('ECONNREFUSED'); }],
    ['non-2xx', () => json(503, { success: false, error: 'down' })],
    ['not the app envelope', () => json(200, { hello: 'world' })],
  ])('refuses when the app is down (%s), with no POST', async (_name, get) => {
    const app = stubApp({ gets: [get as () => ReturnType<typeof json>], post: started() });
    const out = await runReview(opts(), deps(app));
    expect(out).toMatchObject({ ok: false, kind: 'refused' });
    expect(out.message).toMatch(/not up/);
    expect(app.posts).toHaveLength(0);
    expect(existsSync(ledgerPath)).toBe(false);
  });

  it('refuses while a batch is already running', async () => {
    const app = stubApp({ gets: [() => json(200, { success: true, data: { batch: batchOf('running', 'running', null, 'batch-9') } })], post: started() });
    const out = await runReview(opts(), deps(app));
    expect(out).toMatchObject({ ok: false, kind: 'refused' });
    expect(out.message).toContain('batch-9');
    expect(app.posts).toHaveLength(0);
    expect(existsSync(ledgerPath)).toBe(false);
  });

  it('refuses inside the test suite before any fetch (VITEST, NODE_ENV=test)', async () => {
    for (const env of [{ VITEST: 'true' }, { NODE_ENV: 'test' }]) {
      let calls = 0;
      const d = deps(stubApp({ gets: [idle] }), { env, fetch: async () => { calls++; throw new Error('must not fetch'); } });
      const out = await runReview(opts(), d);
      expect(out).toMatchObject({ ok: false, kind: 'refused' });
      expect(out.message).toBe('the runner never runs in the test suite');
      expect(calls).toBe(0);
    }
  });
});

describe('probeApp', () => {
  it('reports up/down and whether a batch is running', async () => {
    const running = stubApp({ gets: [() => json(200, { success: true, data: { batch: batchOf('running', 'pending') } })] });
    expect(await probeApp(ORIGIN, running.fetch)).toMatchObject({ up: true, running: true });
    expect(await probeApp(ORIGIN, stubApp({ gets: [idle] }).fetch)).toMatchObject({ up: true, running: false, batch: null });
    expect((await probeApp(ORIGIN, stubApp({ gets: [() => json(500, {})] }).fetch)).up).toBe(false);
  });
});

describe('parseArgs', () => {
  const base = ['combat', '--project-path', 'C:\\Games\\PoF', '--ue-version', '5.7.3'];

  it('parses a full command and applies the defaults (dry-run, localhost, basename)', () => {
    const r = parseArgs(base, { POF_REVIEW_LEDGER: '/tmp/l.json' });
    expect(r).toMatchObject({
      ok: true,
      options: { moduleId: 'combat', projectPath: 'C:\\Games\\PoF', ueVersion: '5.7.3', projectName: 'PoF', origin: 'http://localhost:3000', write: false, ledgerPath: '/tmp/l.json' },
    });
  });

  it('honours --write, --origin, --project-name and --ledger over the defaults', () => {
    const r = parseArgs([...base, '--write', '--origin', 'http://x:1/', '--project-name', 'N', '--ledger', '/a/b.json'], { POF_REVIEW_LEDGER: '/tmp/l.json' });
    expect(r).toMatchObject({ ok: true, options: { write: true, origin: 'http://x:1', projectName: 'N', ledgerPath: '/a/b.json' } });
  });

  it('defaults the ledger under ~/.pof when nothing overrides it', () => {
    const r = parseArgs(base);
    expect(r.ok && r.options.ledgerPath.replace(/\\/g, '/')).toMatch(/\/\.pof\/review-runner-ledger\.json$/);
  });

  it.each([
    ['a missing module id', ['--project-path', 'p', '--ue-version', '5.7.3'], /module id/],
    ['a missing --project-path', ['combat', '--ue-version', '5.7.3'], /--project-path/],
    ['a missing --ue-version', ['combat', '--project-path', 'p'], /--ue-version/],
    ['a flag with no value', ['combat', '--project-path'], /needs a value/],
    ['an unknown flag', [...base, '--force'], /unknown option/],
    ['two module ids', [...base, 'loot'], /one module id/],
  ])('rejects %s', (_name, argv, error) => {
    const r = parseArgs(argv as string[]);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(error);
  });

  it('treats --help as a help request, not a run', () => {
    expect(parseArgs(['--help'])).toMatchObject({ ok: false, help: true });
  });
});
