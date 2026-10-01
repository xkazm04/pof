// @vitest-environment node
/**
 * The operator's Tripo CLI (`scripts/visual-gen/pof_tripo.mjs`) previews what it will buy,
 * pins the audited model, and RESUMES a paid task instead of buying it again.
 *
 * Before: the script was a second, hand-copied Tripo client. It sent no `model_version`
 * unless `--model` was passed (so the account default the character-pipeline arena graded
 * FAIL), passed the benchmarked-and-rejected `smart_low_poly` flag straight through, had no
 * preview, and printed `POF_TRIPO_ERROR=timed out` for a task that was still running and
 * already paid — with no flag that could collect it. These cases pin the planner and the
 * executor over the app's own Tripo client. FAKES ONLY: nothing here reaches Tripo.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import {
  parseTripoCliArgs,
  planTripoCli,
  executeTripoCli,
  type TripoCliDeps,
} from '@/lib/visual-gen/tripo-cli';
import {
  buildCreateTaskBody,
  isRecoverableTripoFailure,
  isTripoTaskId,
  runTripo,
  type TripoDeps,
  type TripoHttp,
  type TripoResult,
  type TripoSpec,
} from '@/lib/visual-gen/tripo-runner';
import { SMART_LOW_POLY_VERDICT, TRIPO_AUDITED_MODEL, tripoModelFor } from '@/lib/visual-gen/tripo-models';
import { readMarkerBlock } from '@/lib/visual-gen/script-markers';

const GUARDS = { smartLowPoly: SMART_LOW_POLY_VERDICT, isTripoTaskId };
const plan = (argv: string[]) => planTripoCli(parseTripoCliArgs(argv), tripoModelFor(), GUARDS);
const IMAGE = ['--image', 'ref.png', '--output', 'o.glb'];
const TASK = '7f08effe-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

/** Runner fakes. `onRun` lets a fake fire the runner's hooks the way the real one does. */
function fakes(result: Partial<TripoResult> = { ok: true, meshPath: 'o.glb', taskId: 't-1' }, onRun?: (d: TripoDeps) => void) {
  const out = { durationMs: 1, ...result } as TripoResult;
  const deps = {
    runTripo: vi.fn(async (_spec: TripoSpec, d: TripoDeps = {}) => { onRun?.(d); return out; }),
    awaitTripoTask: vi.fn(async (_id: string, _path: string, d: TripoDeps = {}) => { onRun?.(d); return out; }),
    buildCreateTaskBody,
    isRecoverableTripoFailure,
    fileSize: vi.fn(() => 1234),
    downloadFile: vi.fn(async () => true),
    ensureParentDir: vi.fn(),
  } satisfies TripoCliDeps;
  return deps;
}
const lineOf = (lines: string[], key: string) => lines.filter((l) => l.startsWith(`POF_TRIPO_${key}=`));

describe('planTripoCli: the paid request is pinned before it is sent', () => {
  it('an unflagged image run pins the audited model and says so in the preview', () => {
    const p = plan(IMAGE);
    expect(p.kind).toBe('create');
    if (p.kind !== 'create') return;
    expect(p.spec.modelVersion).toBe('v3.1-20260211');
    expect(p.spec.textureQuality).toBe('detailed');
    expect(p.preview.some((l) => l.includes('v3.1-20260211') && /audited/i.test(l))).toBe(true);
  });

  it('an explicit --model is kept, and named unaudited', () => {
    const p = plan([...IMAGE, '--model', 'v2.5-20250123']);
    if (p.kind !== 'create') throw new Error(`expected create, got ${p.kind}`);
    expect(p.spec.modelVersion).toBe('v2.5-20250123');
    expect(p.warnings.join('\n')).toContain('unaudited');
  });

  it('--smart-low-poly is refused with the benchmark verdict; --force-smart-low-poly opts in with a warning', async () => {
    const refused = plan([...IMAGE, '--smart-low-poly']);
    if (refused.kind !== 'refuse') throw new Error(`expected refuse, got ${refused.kind}`);
    expect(refused.error).toContain('rejected');
    expect(refused.error).toContain('2026-08-18');
    const f = fakes();
    const r = await executeTripoCli(refused, f);
    expect(f.runTripo).toHaveBeenCalledTimes(0);
    expect(r.exitCode).toBe(1);
    const forced = plan([...IMAGE, '--smart-low-poly', '--force-smart-low-poly']);
    if (forced.kind !== 'create') throw new Error(`expected create, got ${forced.kind}`);
    expect(forced.spec.smartLowPoly).toBe(true);
    expect(forced.warnings.join('\n')).toContain(SMART_LOW_POLY_VERDICT.benchmarked);
  });
});

describe('executeTripoCli --dry: the exact paid request, nothing spent', () => {
  it('prints one POF_TRIPO_DRY body equal to buildCreateTaskBody(spec), with zero runner calls', async () => {
    const p = plan([...IMAGE, '--dry']);
    expect(p.kind).toBe('dry');
    if (p.kind !== 'dry') return;
    const f = fakes();
    const r = await executeTripoCli(p, f);
    expect(f.runTripo).toHaveBeenCalledTimes(0);
    expect(f.awaitTripoTask).toHaveBeenCalledTimes(0);
    expect(f.downloadFile).toHaveBeenCalledTimes(0);
    expect(f.ensureParentDir).toHaveBeenCalledTimes(0);
    const dry = lineOf(r.lines, 'DRY');
    expect(dry).toHaveLength(1);
    const body = JSON.parse(dry[0].slice('POF_TRIPO_DRY='.length));
    expect(body).toEqual(JSON.parse(JSON.stringify(buildCreateTaskBody(p.spec))));
    expect(body.model_version).toBe('v3.1-20260211');
    expect(r.lines.some((l) => l.includes('ref.png') && /pending/i.test(l))).toBe(true);
    expect(r.exitCode).toBe(0);
  });
});

describe('executeTripoCli --resume: collect a paid task, never buy it twice', () => {
  it('polls the existing task by id and creates nothing', async () => {
    const p = planTripoCli(parseTripoCliArgs(['--resume', TASK, '--output', 'o.glb']), tripoModelFor(), GUARDS);
    expect(p.kind).toBe('resume');
    const f = fakes({ ok: true, meshPath: 'o.glb', taskId: TASK });
    const r = await executeTripoCli(p, f);
    expect(f.awaitTripoTask).toHaveBeenCalledTimes(1);
    expect(f.awaitTripoTask.mock.calls[0].slice(0, 2)).toEqual([TASK, 'o.glb']);
    expect(f.runTripo).toHaveBeenCalledTimes(0);
    expect(r.exitCode).toBe(0);
  });

  it('refuses a malformed task id before any call', async () => {
    const p = planTripoCli(parseTripoCliArgs(['--resume', '../x y', '--output', 'o.glb']), tripoModelFor(), GUARDS);
    expect(p.kind).toBe('refuse');
    if (p.kind === 'refuse') expect(p.error).toContain('invalid Tripo task id');
    const f = fakes();
    const r = await executeTripoCli(p, f);
    expect(f.runTripo).toHaveBeenCalledTimes(0);
    expect(f.awaitTripoTask).toHaveBeenCalledTimes(0);
    expect(r.exitCode).toBe(1);
  });

  it('a recoverable failure prints the exact resume command; a Tripo verdict does not', async () => {
    const fail = { ok: false, taskId: 'abc-1', recoverable: true, error: 'timed out after 150 polls' };
    const r = await executeTripoCli(plan(IMAGE), fakes(fail));
    expect(r.lines).toContain('POF_TRIPO_ERROR=timed out after 150 polls');
    expect(r.lines).toContain('POF_TRIPO_RESUME=--resume abc-1 --output o.glb');
    expect(r.exitCode).toBe(1);
    const terminal = await executeTripoCli(plan(IMAGE), fakes({ ...fail, recoverable: false }));
    expect(lineOf(terminal.lines, 'RESUME')).toHaveLength(0);
    expect(terminal.exitCode).toBe(1);
  });
});

describe('[guard] the existing operator surface survives the move onto the app client', () => {
  it('[guard] TASK before any poll line, then BYTES, RENDER, RENDER_FILE and DONE', async () => {
    const p = plan([...IMAGE, '--render', 'r.webp']);
    const f = fakes(
      { ok: true, meshPath: 'o.glb', taskId: 't-1', renderUrl: 'https://r/x.webp' },
      (d) => { d.onImageUploaded?.('tok-1'); d.onTaskCreated?.('t-1'); d.onStatus?.('running', 40); },
    );
    const r = await executeTripoCli(p, f);
    expect(r.lines).toContain('POF_TRIPO_UPLOAD=tok-1');
    const task = r.lines.indexOf('POF_TRIPO_TASK=t-1');
    const poll = r.lines.findIndex((l) => l.startsWith('POF_TRIPO_STATUS='));
    expect(task).toBeGreaterThanOrEqual(0);
    expect(poll).toBeGreaterThan(task);
    expect(r.lines[poll]).toBe('POF_TRIPO_STATUS=running progress=40');
    expect(r.lines).toContain('POF_TRIPO_BYTES=1234');
    expect(r.lines).toContain('POF_TRIPO_RENDER=https://r/x.webp');
    expect(f.downloadFile).toHaveBeenCalledWith('https://r/x.webp', 'r.webp');
    expect(r.lines).toContain('POF_TRIPO_RENDER_FILE=r.webp');
    expect(r.lines[r.lines.length - 1]).toBe('POF_TRIPO_DONE=o.glb');
    expect(r.exitCode).toBe(0);
    // Every key it printed is declared in SCRIPT_MARKERS.tripo.
    const block = readMarkerBlock('tripo', r.lines.join('\n'));
    expect(block.undeclared).toEqual([]);
    expect(block.get('DONE')).toBe('o.glb');
  });

  it('[guard] --prompt builds text_to_model; --face-limit/--pbr/--quad/--texture-quality reach the body; --max-ms stays 600000', () => {
    const p = plan(['--prompt', 'x', '--output', 'o.glb', '--face-limit', '40000', '--pbr', '--quad', '--texture-quality', 'standard']);
    if (p.kind !== 'create') throw new Error(`expected create, got ${p.kind}`);
    const body = buildCreateTaskBody(p.spec);
    expect(body).toMatchObject({ type: 'text_to_model', prompt: 'x', face_limit: 40000, pbr: true, quad: true, texture_quality: 'standard' });
    expect(p.spec.maxPollMs).toBe(600_000);
    expect(p.warnings.join('\n')).toMatch(/standard/);
  });
});

describe('tripo-runner hooks the CLI prints from', () => {
  const http = (statuses: unknown[]) => {
    let i = 0;
    return {
      postJson: vi.fn(async () => ({ status: 200, json: { code: 0, data: { task_id: 't-9' } } })),
      getJson: vi.fn(async () => ({ status: 200, json: statuses[Math.min(i++, statuses.length - 1)] })),
      uploadImage: vi.fn(async () => ({ status: 200, json: { code: 0, data: { image_token: 'tok-9' } } })),
      download: vi.fn(async () => true),
    } satisfies TripoHttp;
  };

  it('onImageUploaded receives the token and onStatus every poll, in order', async () => {
    const seen: string[] = [];
    const r = await runTripo(
      { mode: 'image-to-3d', imagePath: 'ref.png', outputPath: 'o.glb', apiKey: 'k' },
      {
        http: http([
          { code: 0, data: { status: 'running', progress: 30 } },
          { code: 0, data: { status: 'success', output: { pbr_model: 'https://x/m.glb' } } },
        ]),
        fileExists: () => true,
        sleep: async () => {},
        onImageUploaded: (t) => seen.push(`up:${t}`),
        onTaskCreated: (t) => seen.push(`task:${t}`),
        onStatus: (s, p) => seen.push(`${s}:${p ?? '?'}`),
      },
    );
    expect(r.ok).toBe(true);
    expect(seen).toEqual(['up:tok-9', 'task:t-9', 'running:30', 'success:100']);
  });
});

describe('pof_tripo.mjs is a thin door over the app client', () => {
  const script = join(process.cwd(), 'scripts', 'visual-gen', 'pof_tripo.mjs');

  it('imports the runner, the model pin and the planner instead of carrying its own client', () => {
    const src = readFileSync(script, 'utf8');
    for (const mod of ['tripo-runner.ts', 'tripo-models.ts', 'tripo-cli.ts']) expect(src).toContain(mod);
    expect(src).not.toContain('api.tripo3d.ai');
    expect(src).not.toMatch(/\/task\b/);
  });

  it('--dry runs end to end in node with no API key and prints the pinned body', () => {
    const env = { ...process.env };
    delete env.TRIPO_API_KEY;
    const run = spawnSync(process.execPath, [script, '--dry', '--prompt', 'a crate', '--output', 'o.glb'], {
      env, encoding: 'utf8', timeout: 30_000,
    });
    expect(run.status).toBe(0);
    const dry = run.stdout.split(/\r?\n/).filter((l) => l.startsWith('POF_TRIPO_DRY='));
    expect(dry).toHaveLength(1);
    expect(JSON.parse(dry[0].slice('POF_TRIPO_DRY='.length))).toMatchObject({
      type: 'text_to_model', prompt: 'a crate', model_version: TRIPO_AUDITED_MODEL,
    });
  });
});
