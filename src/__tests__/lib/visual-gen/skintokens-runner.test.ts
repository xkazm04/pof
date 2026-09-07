import { describe, it, expect } from 'vitest';
import {
  SKINTOKENS_CRASH_EXIT_CODES,
  isCrashExit,
  buildSkintokensArgs,
  parseSkintokensOutput,
  resolveSkintokensBin,
  resolveSkintokensModelDir,
  runSkintokens,
  SKINTOKENS_SUCCESS_MARKER,
} from '@/lib/visual-gen/skintokens-runner';

const ROOT = 'C:/k/skintokens';
const BIN = `${ROOT}/dist/bin/skintokens-cli.exe`;
const MODELS = `${ROOT}/models/SkinTokens-GGUF/F16`;

describe('resolveSkintokensBin / resolveSkintokensModelDir', () => {
  it('prefers an explicit path over the env root', () => {
    expect(resolveSkintokensBin('C:/x/st.exe', { POF_SKINTOKENS_ROOT: ROOT }, () => true)).toBe('C:/x/st.exe');
  });

  it('derives the installed CLI from POF_SKINTOKENS_ROOT', () => {
    expect(resolveSkintokensBin(undefined, { POF_SKINTOKENS_ROOT: ROOT }, (p) => p === BIN)).toBe(BIN);
  });

  it('returns null when neither is available, rather than a guessed path', () => {
    expect(resolveSkintokensBin(undefined, {}, () => true)).toBeNull();
    expect(resolveSkintokensBin(undefined, { POF_SKINTOKENS_ROOT: ROOT }, () => false)).toBeNull();
  });

  it('derives the F16 model dir from the root — F32 is parity-only', () => {
    expect(resolveSkintokensModelDir(undefined, { POF_SKINTOKENS_ROOT: ROOT }, () => true)).toBe(MODELS);
  });
});

describe('buildSkintokensArgs', () => {
  it('builds a rig argv: subcommand, MODEL_DIR, mesh, output', () => {
    const a = buildSkintokensArgs({ meshPath: 'm.glb', outputPath: 'o.glb' }, MODELS);
    expect(a).toEqual(['rig', MODELS, 'm.glb', 'o.glb', '--device', 'vulkan']);
  });

  it('passes the optional generation levers only when set', () => {
    const a = buildSkintokensArgs(
      { meshPath: 'm.glb', outputPath: 'o.glb', device: 'vulkan', postprocess: true, beams: 4 },
      MODELS,
    );
    expect(a).toEqual(['rig', MODELS, 'm.glb', 'o.glb', '--device', 'vulkan', '--postprocess', '--beams', '4']);
  });

  it('builds a skin argv with the skeleton positional between mesh and output', () => {
    const a = buildSkintokensArgs(
      { mode: 'skin', meshPath: 'm.glb', skeletonPath: 's.glb', outputPath: 'o.glb', fit: 'none' },
      MODELS,
    );
    expect(a).toEqual(['skin', MODELS, 'm.glb', 's.glb', 'o.glb', '--device', 'vulkan', '--fit', 'none']);
  });

  it('never emits --fit on rig — the CLI only accepts it on skin/bind', () => {
    const a = buildSkintokensArgs({ meshPath: 'm.glb', outputPath: 'o.glb', fit: 'global' }, MODELS);
    expect(a).not.toContain('--fit');
  });
});

describe('parseSkintokensOutput', () => {
  it('reads the success marker and the path the CLI reports writing', () => {
    const p = parseSkintokensOutput(`load_backend: loaded CPU backend\n${SKINTOKENS_SUCCESS_MARKER} C:/out/rigged.glb\n`, 0);
    expect(p.ok).toBe(true);
    expect(p.writtenPath).toBe('C:/out/rigged.glb');
  });

  it('treats a non-zero exit as a failure and keeps the message', () => {
    const p = parseSkintokensOutput('failed to open mesh: no such file\n', 1);
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/failed to open mesh/);
  });

  it('names exit code 2 as a usage error, which means WE built the argv wrong', () => {
    const p = parseSkintokensOutput('usage:\n  skintokens-cli rig MODEL_DIR ...\n', 2);
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/usage/i);
  });

  it('does not report success on exit 0 without the marker', () => {
    // Guards the case that would otherwise let a silent no-op read as a rig.
    const p = parseSkintokensOutput('load_backend: loaded CPU backend\n', 0);
    expect(p.ok).toBe(false);
  });
});

describe('runSkintokens', () => {
  const deps = (over: Record<string, unknown> = {}) => ({
    env: { POF_SKINTOKENS_ROOT: ROOT },
    fileExists: () => true,
    now: () => 0,
    run: async () => ({ stdout: `${SKINTOKENS_SUCCESS_MARKER} o.glb\n`, code: 0 }),
    ...over,
  });

  it('reports the rigged mesh path on success', async () => {
    const r = await runSkintokens({ meshPath: 'm.glb', outputPath: 'o.glb' }, deps());
    expect(r.ok).toBe(true);
    expect(r.riggedPath).toBe('o.glb');
  });

  it('fails with an actionable message when the CLI is not installed', async () => {
    const r = await runSkintokens({ meshPath: 'm.glb', outputPath: 'o.glb' }, deps({ env: {}, fileExists: () => false }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/POF_SKINTOKENS_ROOT/);
  });

  it('fails when the input mesh is missing, naming it', async () => {
    const r = await runSkintokens(
      { meshPath: 'gone.glb', outputPath: 'o.glb' },
      deps({ fileExists: (p: string) => p !== 'gone.glb' }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/gone\.glb/);
  });

  it('requires a skeleton for skin mode', async () => {
    const r = await runSkintokens({ mode: 'skin', meshPath: 'm.glb', outputPath: 'o.glb' }, deps());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/skeleton/i);
  });

  it('does not report success when the CLI claims a write but no file lands', async () => {
    // The CLI prints its marker before the caller can see the file; a marker is a
    // claim, the file on disk is the evidence.
    const r = await runSkintokens(
      { meshPath: 'm.glb', outputPath: 'o.glb' },
      deps({ fileExists: (p: string) => p !== 'o.glb' }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no file was written/i);
  });
});

describe('runSkintokens — the CPU device is refused by default', () => {
  // MEASURED 2026-09-07, not assumed: `rig` on bestiary_grunt.glb (26,788 verts /
  // 39,735 faces) with --device cpu ran 24 minutes, held ~5.5 of 8 cores and 2.6 GB,
  // made the workstation unusable, and wrote NO output file. A rig step that can do
  // that to the machine must not be reachable by accident, so CPU is opt-in and the
  // refusal quotes the measurement.
  const deps = (over: Record<string, unknown> = {}) => ({
    env: { POF_SKINTOKENS_ROOT: ROOT },
    fileExists: () => true,
    now: () => 0,
    run: async () => ({ stdout: `${SKINTOKENS_SUCCESS_MARKER} o.glb
`, code: 0 }),
    ...over,
  });

  it('refuses device cpu unless explicitly allowed, and says why', async () => {
    const r = await runSkintokens({ meshPath: 'm.glb', outputPath: 'o.glb', device: 'cpu' }, deps());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/24 min/);
    expect(r.error).toMatch(/allowCpu/);
  });

  it('runs on cpu when the caller opts in deliberately', async () => {
    const r = await runSkintokens(
      { meshPath: 'm.glb', outputPath: 'o.glb', device: 'cpu', allowCpu: true },
      deps(),
    );
    expect(r.ok).toBe(true);
  });

  it('refuses `auto` too — this build has no Vulkan, so auto silently means cpu', async () => {
    const r = await runSkintokens({ meshPath: 'm.glb', outputPath: 'o.glb', device: 'auto' }, deps());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/auto/i);
  });

  it('lets vulkan through without an opt-in', async () => {
    const r = await runSkintokens({ meshPath: 'm.glb', outputPath: 'o.glb' }, deps());
    expect(r.ok).toBe(true);
  });
});

describe('crash retry — the Vulkan backend is flaky, so a crash is retried and an error is not', () => {
  // MEASURED 2026-09-07 on an RTX 4090 (Vulkan 1.4.325, NV_coopmat2): the SAME input
  // crashes nondeterministically. 10 identical runs of one mesh gave ok=2/fail=8; with
  // GGML_VK_DISABLE_COOPMAT+COOPMAT2, ok=5/fail=5; with DISABLE_ASYNC, ok=4/fail=6. No
  // knob makes it stable, so this is a bug in the Vulkan path, not a tunable. A crash
  // costs ~0.4s while a success takes ~10s, so retrying is far cheaper than failing:
  // the real bestiary creature rigged on attempt 3 of 3, and later on attempt 6 of 6.
  it('recognizes the platform crash signatures', () => {
    expect(isCrashExit(139)).toBe(true);           // POSIX 128+SIGSEGV
    expect(isCrashExit(-1073741819)).toBe(true);   // Windows 0xC0000005, signed
    expect(isCrashExit(3221225477)).toBe(true);    // Windows 0xC0000005, unsigned
    expect(isCrashExit(null)).toBe(true);          // spawn error / killed
    expect(SKINTOKENS_CRASH_EXIT_CODES.length).toBeGreaterThan(0);
  });

  it('does not treat ordinary failures as crashes', () => {
    expect(isCrashExit(0)).toBe(false);
    expect(isCrashExit(1)).toBe(false);            // real error (bad mesh)
    expect(isCrashExit(2)).toBe(false);            // usage error — OUR argv is wrong
  });

  it('retries past crashes and reports how many attempts it took', async () => {
    let n = 0;
    const r = await runSkintokens(
      { meshPath: 'm.glb', outputPath: 'o.glb' },
      {
        env: { POF_SKINTOKENS_ROOT: ROOT },
        fileExists: () => true,
        now: () => 0,
        run: async () => {
          n += 1;
          return n < 3
            ? { stdout: '', code: -1073741819 }
            : { stdout: `${SKINTOKENS_SUCCESS_MARKER} o.glb`, code: 0 };
        },
      },
    );
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(3);
  });

  it('never retries a usage error — that would just repeat our own bug 8 times', async () => {
    let n = 0;
    const r = await runSkintokens(
      { meshPath: 'm.glb', outputPath: 'o.glb' },
      {
        env: { POF_SKINTOKENS_ROOT: ROOT },
        fileExists: () => true,
        now: () => 0,
        run: async () => { n += 1; return { stdout: 'usage:', code: 2 }; },
      },
    );
    expect(r.ok).toBe(false);
    expect(n).toBe(1);
  });

  it('gives up after maxAttempts and says the crash was the reason', async () => {
    let n = 0;
    const r = await runSkintokens(
      { meshPath: 'm.glb', outputPath: 'o.glb', maxAttempts: 4 },
      {
        env: { POF_SKINTOKENS_ROOT: ROOT },
        fileExists: () => true,
        now: () => 0,
        run: async () => { n += 1; return { stdout: '', code: 139 }; },
      },
    );
    expect(r.ok).toBe(false);
    expect(n).toBe(4);
    expect(r.attempts).toBe(4);
    expect(r.error).toMatch(/crashed 4/i);
  });
});
