/**
 * One local-process seam for the local 3D / motion / rig runners (TripoSR, Hunyuan3D,
 * TRELLIS.2, ARDY, SkinTokens). A process that ends without a script marker must say WHY
 * — timed out, exited with a code (and its last output), or could not start — instead of
 * { ok: false, error: undefined }, which the forge rounds to a bare "generation failed".
 * And a timeout is not a crash: SkinTokens must not retry a 60-min kill 8 times.
 */
import { describe, it, expect } from 'vitest';
import {
  processFailureReason,
  readMarker,
  runLocalProcess,
} from '@/lib/visual-gen/local-process';
import { runHunyuan } from '@/lib/visual-gen/hunyuan-runner';
import { runTriposr } from '@/lib/visual-gen/triposr-runner';
import { runTrellis } from '@/lib/visual-gen/trellis-runner';
import { runArdy } from '@/lib/visual-gen/ardy-runner';
import { runSkintokens, SKINTOKENS_SUCCESS_MARKER } from '@/lib/visual-gen/skintokens-runner';

const MESH_SPEC = { imagePath: 'in.png', outputPath: 'out/mesh.glb' };
const yes = () => true;

const PASSING_GATE = {
  ok: true as const,
  facts: {
    hasSkin: true, jointCount: 28, referencedJoints: 28, hasInverseBindMatrices: true,
    vertexCount: 26788, zeroWeightVertices: 0, negativeWeights: 0, nonFiniteWeights: 0,
    maxInfluences: 4, weightSumMin: 1, weightSumMax: 1, weightSumMean: 1,
  },
  verdict: { pass: true, score: 100, failures: [] as string[], warnings: [] as string[] },
};

describe('card cases — a marker-less ending names its reason', () => {
  it('Hunyuan killed by its 15-min timeout says so', async () => {
    const r = await runHunyuan(MESH_SPEC, {
      run: async () => ({ stdout: 'Loading model...\n', code: null, timedOut: true }),
      fileExists: yes,
      env: { POF_HUNYUAN_ROOT: 'r', POF_HUNYUAN_VENV: 'py' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timed out after 15 min/);
  });

  it('TripoSR native CUDA crash names the exit code and the last output line', async () => {
    const r = await runTriposr(MESH_SPEC, {
      run: async () => ({ stdout: 'CUDA error: an illegal memory access\n', code: -1073741819 }),
      fileExists: yes,
      env: { POF_TRIPOSR_ROOT: 'r' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('exited with code -1073741819');
    expect(r.error).toContain('CUDA error: an illegal memory access');
  });

  it("TRELLIS through a wrong WSL distro surfaces wsl.exe's own message", async () => {
    const r = await runTrellis(MESH_SPEC, {
      run: async () => ({ stdout: 'There is no distribution with the supplied name.\n', code: 4294967295 }),
      fileExists: yes,
      env: { POF_TRELLIS_ROOT: 'r', POF_TRELLIS_VENV: '/home/u/t2env/bin/python', POF_TRELLIS_WSL: 'Ubuntu' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('There is no distribution with the supplied name.');
  });

  it('a spawn failure says the process could not start', async () => {
    const r = await runTriposr(MESH_SPEC, {
      run: async () => ({ stdout: '', code: null, spawnError: 'spawn python.exe ENOENT' }),
      fileExists: yes,
      env: { POF_TRIPOSR_ROOT: 'r' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/could not start .*ENOENT/);
  });

  it('SkinTokens: a timeout is terminal — one invocation, not 8, and no Vulkan blame', async () => {
    let n = 0;
    const r = await runSkintokens(
      { meshPath: 'm.glb', outputPath: 'o.glb' },
      {
        run: async () => { n += 1; return { stdout: '', code: null, timedOut: true }; },
        fileExists: yes,
        now: () => 0,
        env: { POF_SKINTOKENS_ROOT: 'r' },
      },
    );
    expect(n).toBe(1);
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(1);
    expect(r.error).toMatch(/timed out/);
    expect(r.error).not.toMatch(/Vulkan/);
  });

  it('processFailureReason names the tool, the exit code and the last line (pure, tail capped)', () => {
    const reason = processFailureReason(
      { stdout: 'a\nb\nlast line', code: 1, timedOut: false },
      { tool: 'pof_hunyuan.py', timeoutMs: 900_000 },
    );
    expect(reason).toContain('pof_hunyuan.py');
    expect(reason).toContain('exited with code 1');
    expect(reason).toContain('last line');

    const long = processFailureReason(
      { stdout: 'x'.repeat(5000), code: 1 },
      { tool: 't', timeoutMs: 1 },
    );
    expect(long.length).toBeLessThanOrEqual(300 + 't exited with code 1'.length + 20);
  });

  it('[guard] SkinTokens still retries a real native crash', async () => {
    let n = 0;
    const r = await runSkintokens(
      { meshPath: 'm.glb', outputPath: 'o.glb' },
      {
        run: async () => {
          n += 1;
          return n === 1
            ? { stdout: '', code: -1073741819 }
            : { stdout: `${SKINTOKENS_SUCCESS_MARKER} o.glb`, code: 0 };
        },
        fileExists: yes,
        now: () => 0,
        gate: () => PASSING_GATE,
        env: { POF_SKINTOKENS_ROOT: 'r' },
      },
    );
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
  });

  it("[guard] a script's own ERROR marker still wins over the process reason", async () => {
    const r = await runHunyuan(MESH_SPEC, {
      run: async () => ({ stdout: "POF_HY3D_ERROR=RuntimeError('OOM')\n", code: 1 }),
      fileExists: yes,
      env: { POF_HUNYUAN_ROOT: 'r', POF_HUNYUAN_VENV: 'py' },
    });
    expect(r.error).toBe("RuntimeError('OOM')");
  });
});

describe('processFailureReason — every ending has a sentence', () => {
  const opts = { tool: 'pof_triposr.py', timeoutMs: 300_000 };

  it('a timeout names the ceiling and keeps the last output', () => {
    const r = processFailureReason({ stdout: 'Loading model...\n', code: null, timedOut: true }, opts);
    expect(r).toMatch(/pof_triposr\.py timed out after 5 min/);
    expect(r).toContain('Loading model...');
  });

  it('a signal death without a timeout is not called a timeout', () => {
    const r = processFailureReason({ stdout: '', code: null }, opts);
    expect(r).not.toMatch(/timed out/);
    expect(r).toMatch(/without an exit code/);
  });

  it('exit 0 without a result marker is still a failure with a reason', () => {
    expect(processFailureReason({ stdout: 'hello', code: 0 }, opts)).toMatch(/exited 0 without reporting a result/);
  });

  it("strips the NULs of wsl.exe's UTF-16 output so its message stays readable", () => {
    const utf16 = 'No distro.'.split('').join('\u0000');
    expect(processFailureReason({ stdout: utf16, code: 1 }, opts)).toContain('No distro.');
  });

  it('formats sub-minute ceilings in seconds', () => {
    expect(processFailureReason({ stdout: '', code: null, timedOut: true }, { tool: 't', timeoutMs: 45_000 }))
      .toMatch(/timed out after 45 s/);
  });
});

describe('readMarker', () => {
  it('reads a KEY=value line anywhere in the output, trimmed', () => {
    expect(readMarker('noise\nPOF_X_DONE= out.glb \nmore', 'POF_X_DONE')).toBe('out.glb');
    expect(readMarker('POF_X_DONEISH=1', 'POF_X_DONE')).toBeUndefined();
  });
});

describe('ARDY — a marker-less timeout says timed out, not "did not report a saved npz"', () => {
  it('names the timeout', async () => {
    const r = await runArdy(
      { prompt: 'a person walks', outputPath: 'out/walk' },
      {
        run: async () => ({ stdout: 'Using device: cuda:0\n', code: null, timedOut: true }),
        fileExists: yes,
        env: { POF_ARDY_ROOT: 'C:/ardy' },
      },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timed out after 15 min/);
  });
});

describe('runLocalProcess — the one real spawn seam', () => {
  const node = process.execPath;

  it('returns the merged output and the exit code', async () => {
    const o = await runLocalProcess(node, ['-e', 'console.log("out");console.error("err");process.exit(3)'], { timeoutMs: 20_000 });
    expect(o.code).toBe(3);
    expect(o.stdout).toContain('out');
    expect(o.stdout).toContain('err');
    expect(o.timedOut).toBeFalsy();
    expect(o.spawnError).toBeUndefined();
  });

  it('marks a kill by its own timer as timedOut', async () => {
    const o = await runLocalProcess(node, ['-e', 'setTimeout(() => {}, 30000)'], { timeoutMs: 300 });
    expect(o.timedOut).toBe(true);
    expect(o.code).toBeNull();
  });

  it('reports a missing binary as spawnError, not as an exit', async () => {
    const o = await runLocalProcess('pof-no-such-binary-4f2a', [], { timeoutMs: 5_000 });
    expect(o.spawnError).toMatch(/ENOENT/);
    expect(o.timedOut).toBeFalsy();
  });

  it('passes env and cwd through', async () => {
    const o = await runLocalProcess(
      node,
      ['-e', 'console.log(process.env.POF_LP_PROBE + "|" + process.cwd())'],
      { timeoutMs: 20_000, env: { ...process.env, POF_LP_PROBE: 'yes' }, cwd: process.cwd() },
    );
    expect(o.stdout).toContain(`yes|${process.cwd()}`);
  });
});
