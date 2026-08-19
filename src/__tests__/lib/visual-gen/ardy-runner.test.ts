import { describe, it, expect } from 'vitest';
import {
  buildArdyArgs, parseArdyOutput, resolveArdyEnv, runArdy, preflightArdy,
  type ArdySpec, type ArdyDeps,
} from '@/lib/visual-gen/ardy-runner';

const ROOT = 'C:/ardy';
const PY = 'C:/ardy/.venv/Scripts/python.exe';
const SCRIPT = 'C:/ardy/scripts/generate.py';

const SPEC: ArdySpec = { prompt: 'a person walks forward', outputPath: 'out/walk', ardyRoot: ROOT };

/** Verbatim stdout from a real ARDY 0.2.0 run, 2026-08-19. */
const REAL_OK = [
  'Using device: cuda:0',
  'sparsify_token_seq: False',
  'Loaded model: ARDY-Core-RP-20FPS-Horizon40',
  "Will generate 'a person walks forward at a steady pace' with 80 frames (4.0s at 20 fps)",
  'Using 10 denoising steps',
  'Using 160 history frames per autoregressive step',
  'Saving the npz output to outputs\\pof_walk.npz',
].join('\n');

function deps(over: Partial<ArdyDeps> = {}, present: string[] = [ROOT, PY, SCRIPT]): ArdyDeps {
  return {
    env: {},
    now: () => 0,
    fileExists: (p) => present.includes(p.replace(/\\/g, '/')),
    run: async () => ({ stdout: REAL_OK, code: 0 }),
    ...over,
  };
}

describe('buildArdyArgs', () => {
  it('builds the documented argv', () => {
    const a = buildArdyArgs(SCRIPT, { ...SPEC, durationSec: 2.5, seed: 3 });
    expect(a[0]).toBe(SCRIPT);
    expect(a[1]).toBe('a person walks forward');
    expect(a).toEqual(expect.arrayContaining(['--model', 'core', '--duration', '2.5', '--seed', '3']));
  });

  it('OMITS --seed when unset rather than defaulting it to 0', () => {
    // ARDY's own default is random. Forcing 0 would make every un-seeded call return the
    // same clip, which would silently break re-rolls.
    expect(buildArdyArgs(SCRIPT, SPEC)).not.toContain('--seed');
  });

  it('passes constraints and both cfg weights', () => {
    const a = buildArdyArgs(SCRIPT, { ...SPEC, constraintsPath: 'c.json', cfgWeight: [2, 4] });
    expect(a).toEqual(expect.arrayContaining(['--constraints', 'c.json', '--cfg_weight', '2', '4']));
  });

  it('adds --no-postprocess only when asked', () => {
    expect(buildArdyArgs(SCRIPT, SPEC)).not.toContain('--no-postprocess');
    expect(buildArdyArgs(SCRIPT, { ...SPEC, noPostprocess: true })).toContain('--no-postprocess');
  });
});

describe('resolveArdyEnv', () => {
  it('always sets the two vars that decide WHICH encoder loads', () => {
    // Without these ARDY reaches for the GATED meta-llama repo instead of the local assembly.
    const env = resolveArdyEnv(ROOT, SPEC, { PATH: 'x' });
    expect(env.TEXT_ENCODER_MODE).toBe('local');
    expect(env.TEXT_ENCODERS_DIR.replace(/\\/g, '/')).toBe('C:/ardy/text_encoders');
    expect(env.PATH).toBe('x');
  });

  it('honours an explicit encoders dir', () => {
    const env = resolveArdyEnv(ROOT, { ...SPEC, textEncodersDir: 'D:/enc' });
    expect(env.TEXT_ENCODERS_DIR).toBe('D:/enc');
  });

  it('drops undefined base vars instead of stringifying them', () => {
    expect(resolveArdyEnv(ROOT, SPEC, { GONE: undefined })).not.toHaveProperty('GONE');
  });
});

describe('parseArdyOutput', () => {
  it('parses a real successful run', () => {
    const p = parseArdyOutput(REAL_OK);
    expect(p.ok).toBe(true);
    expect(p.npzPath).toBe('outputs\\pof_walk.npz');
    expect(p.frames).toBe(80);
    expect(p.fps).toBe(20);
    expect(p.durationSec).toBe(4.0);
    expect(p.model).toBe('ARDY-Core-RP-20FPS-Horizon40');
    expect(p.device).toBe('cuda:0');
  });

  it('reports a traceback as the error and refuses ok', () => {
    const out = 'Using device: cuda:0\nTraceback (most recent call last):\n  ...\nRuntimeError: CUDA out of memory';
    const p = parseArdyOutput(out);
    expect(p.ok).toBe(false);
    expect(p.error).toContain('CUDA out of memory');
  });

  it('refuses ok on stdout it did not understand, rather than assuming success', () => {
    const p = parseArdyOutput('some unrelated chatter');
    expect(p.ok).toBe(false);
    expect(p.error).toContain('did not report a saved npz');
  });
});

describe('runArdy', () => {
  it('resolves ARDY\'s relative npz path against the checkout', async () => {
    const abs = 'C:/ardy/outputs/pof_walk.npz';
    const r = await runArdy(SPEC, deps({}, [ROOT, PY, SCRIPT, abs]));
    expect(r.ok).toBe(true);
    expect(r.npzPath?.replace(/\\/g, '/')).toBe(abs);
    expect(r.frames).toBe(80);
  });

  it('fails when the npz is absent despite the save line', async () => {
    // The save line is ARDY's claim; the file is the evidence.
    const r = await runArdy(SPEC, deps());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('npz not written despite save line');
  });

  it('names a MISSING INSTALL as gone rather than as misconfiguration', async () => {
    // This exact situation happened on 2026-08-19: the spec read PROVEN LIVE and the disk
    // held nothing. The message has to distinguish the two.
    const r = await runArdy(SPEC, deps({}, []));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('the install is gone, not misconfigured');
  });

  it('requires POF_ARDY_ROOT when no root is given', async () => {
    const r = await runArdy({ prompt: 'x', outputPath: 'y' }, deps());
    expect(r.error).toContain('POF_ARDY_ROOT not set');
  });

  it('rejects an empty prompt and a missing constraints file before spawning', async () => {
    let spawned = false;
    const spy = deps({ run: async () => { spawned = true; return { stdout: '', code: 0 }; } });
    expect((await runArdy({ ...SPEC, prompt: '  ' }, spy)).error).toBe('prompt is empty');
    expect((await runArdy({ ...SPEC, constraintsPath: 'nope.json' }, spy)).error)
      .toContain('constraints file not found');
    expect(spawned).toBe(false);
  });

  it('spawns with cwd = the ARDY checkout', async () => {
    // Regression, found by the live smoke on 2026-08-19: without cwd, ARDY resolves a
    // relative --output against the CALLER's directory and dropped an `outputs/` folder
    // straight into the PoF repo. The unit suite could not see it because the fake seam
    // has no filesystem.
    let cwd: string | undefined;
    await runArdy(SPEC, deps({ run: async (_c, _a, _t, _e, c) => { cwd = c; return { stdout: REAL_OK, code: 0 }; } }));
    expect(cwd).toBe(ROOT);
  });

  it('resolves the reported npz against the CHECKOUT, not the caller cwd', async () => {
    // The same-named stray in the caller's directory is what masked the cwd bug: checking
    // there first reported success for a file written in the wrong place.
    const strayInCaller = 'outputs/pof_walk.npz';
    const realInCheckout = 'C:/ardy/outputs/pof_walk.npz';
    const r = await runArdy(SPEC, deps({}, [ROOT, PY, SCRIPT, strayInCaller, realInCheckout]));
    expect(r.npzPath?.replace(/\\/g, '/')).toBe(realInCheckout);
  });

  it('passes the local-encoder env through to the spawn', async () => {
    let seen: Record<string, string> | undefined;
    await runArdy(SPEC, deps({ run: async (_c, _a, _t, env) => { seen = env; return { stdout: REAL_OK, code: 0 }; } }));
    expect(seen?.TEXT_ENCODER_MODE).toBe('local');
  });
});

describe('preflightArdy', () => {
  const OK_PROBE = 'POF_ARDY_PREFLIGHT_OK True';

  it('passes a healthy install', async () => {
    const r = await preflightArdy({ ardyRoot: ROOT }, deps(
      { run: async () => ({ stdout: OK_PROBE, code: 0 }) },
      [ROOT, PY, SCRIPT, 'C:/ardy/text_encoders'],
    ));
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => c.name)).toEqual(['install', 'text_encoders', 'motion_correction', 'cuda']);
  });

  it('catches the SILENT motion_correction failure and says why it is silent', async () => {
    // The C++ ext fails open: `import MotionCorrection` succeeds as an empty namespace
    // package, so foot-skate correction vanishes with no error anywhere.
    const r = await preflightArdy({ ardyRoot: ROOT }, deps(
      { run: async () => ({ stdout: 'ModuleNotFoundError: No module named \'motion_correction\'', code: 1 }) },
      [ROOT, PY, SCRIPT, 'C:/ardy/text_encoders'],
    ));
    expect(r.ok).toBe(false);
    const mc = r.checks.find((c) => c.name === 'motion_correction')!;
    expect(mc.ok).toBe(false);
    expect(mc.detail).toContain('--no-build-isolation');
    expect(mc.detail).toContain('would have SUCCEEDED');
  });

  it('flags missing text_encoders as a fall-back-to-GATED-repo risk', async () => {
    const r = await preflightArdy({ ardyRoot: ROOT }, deps(
      { run: async () => ({ stdout: OK_PROBE, code: 0 }) },
      [ROOT, PY, SCRIPT],
    ));
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === 'text_encoders')?.detail).toContain('GATED');
  });

  it('reports a CPU-only torch instead of letting generation crawl', async () => {
    const r = await preflightArdy({ ardyRoot: ROOT }, deps(
      { run: async () => ({ stdout: 'POF_ARDY_PREFLIGHT_OK False', code: 0 }) },
      [ROOT, PY, SCRIPT, 'C:/ardy/text_encoders'],
    ));
    expect(r.checks.find((c) => c.name === 'cuda')?.ok).toBe(false);
  });

  it('stops at the install check and does not spawn when nothing is on disk', async () => {
    let spawned = false;
    const r = await preflightArdy({ ardyRoot: ROOT }, deps(
      { run: async () => { spawned = true; return { stdout: '', code: 0 }; } }, [],
    ));
    expect(r.ok).toBe(false);
    expect(r.checks).toHaveLength(1);
    expect(spawned).toBe(false);
  });
});
