/**
 * The `--cull-interior` memory bomb, closed.
 *
 * ── What happened ─────────────────────────────────────────────────────────────────
 * On 2026-08-18 a python script in this repo consumed 211 GB of RAM and crashed the
 * operator's machine: `pof_mesh_critique.py` called `trimesh.Trimesh.split()` on a
 * fragmented 1600-component textured mesh. That call was fixed the same day.
 *
 * `pof_mesh_finish.py` held a SECOND instance of the same class. `loose_shell_count`
 * built a Python dict mapping every vertex to a list of every polygon touching it, then
 * BFS'd per polygon — and `main()` calls it on `low` while `low` is still
 * `high.data.copy()`, i.e. the UNDECIMATED high-poly. `FACES_IN=1500000` is an ordinary
 * input here. Its only protection was that nothing set `cullInterior`, while
 * `POST /api/visual-gen/mesh-finish` still accepted the flag from any caller.
 *
 * ── What these tests do and do not prove ──────────────────────────────────────────
 * They are SOURCE-SHAPE and SEAM tests. They prove:
 *   - the unbounded allocation is gone from the script's source and the replacement
 *     allocates from counts known before the walk;
 *   - the script refuses the cull above a stated face ceiling, and that refusal reaches
 *     the TypeScript caller as a reason rather than as an absent `facesCulled`;
 *   - the HTTP route no longer accepts `cullInterior` at all.
 *
 * They do NOT prove the python is memory-safe at runtime. Nothing here executes python —
 * this lot is about a python memory bomb, and running python to test it would be the
 * failure mode itself. The runtime claim rests on reading the code: two `array('i')`
 * buffers of `len(vertices)` and `len(polygons)` entries, allocated once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = readFileSync(join(process.cwd(), 'scripts', 'visual-gen', 'pof_mesh_finish.py'), 'utf8');

/**
 * The CODE of one top-level `def`, from its line to the next top-level one, with the
 * docstring removed — the docstrings deliberately quote the old dict-of-lists shape as
 * history, and a guard that matched prose would fire on the explanation instead of the
 * implementation.
 */
function pyFunction(name: string): string {
  const start = SCRIPT.indexOf(`\ndef ${name}(`);
  expect(start, `pof_mesh_finish.py has no top-level def ${name}`).toBeGreaterThan(-1);
  const rest = SCRIPT.slice(start + 1);
  const next = rest.indexOf('\ndef ');
  const whole = next === -1 ? rest : rest.slice(0, next);
  return whole.replace(/"""[\s\S]*?"""/g, '');
}

describe('pof_mesh_finish.py loose_shell_count — bounded by construction', () => {
  const body = pyFunction('loose_shell_count');

  it('never builds a per-vertex list of polygons — the allocation that grew without bound', () => {
    // The exact shape of the 211 GB class: one Python container per mesh element.
    expect(body).not.toMatch(/setdefault\(/);
    expect(body).not.toMatch(/poly_of_vert/);
    // A BFS frontier list + `seen` set over every polygon is the same family.
    expect(body).not.toMatch(/\bstack\s*=/);
    expect(body).not.toMatch(/\bseen\s*=\s*set\(\)/);
  });

  it('allocates exactly two fixed-width buffers, sized from counts known before the walk', () => {
    expect(body).toMatch(/n_faces\s*=\s*len\(mesh\.polygons\)/);
    expect(body).toMatch(/n_verts\s*=\s*len\(mesh\.vertices\)/);
    // 4 bytes per polygon and 4 bytes per vertex — ~9 MB at 1.5M faces, and it does not
    // grow with how tangled the mesh is.
    expect(body).toMatch(/array\("i",\s*range\(n_faces\)\)/);
    expect(body).toMatch(/array\("i",\s*\[-1\]\)\s*\*\s*n_verts/);
    expect(SCRIPT).toMatch(/^from array import array$/m);
  });

  it('finds roots iteratively — no recursion depth to blow on a 1.5M-face mesh', () => {
    expect(body).toMatch(/while parent\[x\] != x:/);
    expect(body).not.toMatch(/return find\(/);
  });
});

describe('pof_mesh_finish.py — the cull is refused above a stated ceiling', () => {
  it('declares a face ceiling for the cull', () => {
    expect(SCRIPT).toMatch(/^CULL_FACE_CEILING\s*=\s*200_000$/m);
  });

  it('checks the mesh size BEFORE the shell walk and refuses with a marker', () => {
    const main = pyFunction('main');
    const guard = main.indexOf('CULL_FACE_CEILING');
    const walk = main.indexOf('loose_shell_count(');
    expect(guard, 'main() must consult CULL_FACE_CEILING').toBeGreaterThan(-1);
    expect(walk).toBeGreaterThan(-1);
    // The size check has to come first, or the bomb has already been attempted.
    expect(guard).toBeLessThan(walk);
    expect(main).toMatch(/marker\(\s*\n?\s*"CULL_REFUSED"/);
  });

  it('states the refusal rather than skipping silently — nothing culled, no shell count', () => {
    const main = pyFunction('main');
    const reason = main.slice(main.indexOf('"CULL_REFUSED"'));
    expect(reason).toMatch(/refused/i);
    expect(reason).toMatch(/before\s+"?\n?\s*"?decimation/i);
    expect(reason).toMatch(/Nothing was culled/i);
  });
});

describe('the refusal reaches the TypeScript caller', () => {
  it('parses CULL_REFUSED into a reason instead of leaving facesCulled merely absent', async () => {
    const { parseMeshFinishOutput } = await import('@/lib/visual-gen/mesh-finish');
    const p = parseMeshFinishOutput(
      [
        'POF_MESHFINISH_FACES_IN=1500000',
        'POF_MESHFINISH_CULL_REFUSED=interior cull refused at 1500000 faces (ceiling 200000): unbounded',
        'POF_MESHFINISH_FACES_OUT=39812',
        'POF_MESHFINISH_DONE=C:/gen/jinx_low.glb',
      ].join('\n'),
    );
    expect(p.ok).toBe(true);
    expect(p.cullRefusedReason).toMatch(/refused at 1500000 faces/);
    // A refused cull computed nothing — neither field may be invented.
    expect(p.facesCulled).toBeUndefined();
    expect(p.cullUnevaluatedShells).toBeUndefined();
    expect(p.cullLimitReason).toBeUndefined();
  });

  it('leaves the reason undefined when no cull was requested', async () => {
    const { parseMeshFinishOutput } = await import('@/lib/visual-gen/mesh-finish');
    expect(parseMeshFinishOutput('POF_MESHFINISH_DONE=C:/gen/a.glb').cullRefusedReason).toBeUndefined();
  });

  it('carries the reason all the way out of runMeshFinish', async () => {
    const { runMeshFinish } = await import('@/lib/visual-gen/mesh-finish');
    const res = await runMeshFinish(
      { highPolyPath: 'C:/gen/hi.glb', outputPath: 'C:/gen/low.glb', targetFaces: 40_000, cullInterior: true },
      {
        env: { POF_BLENDER: 'blender.exe' },
        fileExists: () => true,
        now: () => 0,
        run: async () =>
          ({
            stdout: 'POF_MESHFINISH_CULL_REFUSED=too big\nPOF_MESHFINISH_DONE=C:/gen/low.glb',
            code: 0,
          }),
      },
    );
    expect(res.ok).toBe(true);
    expect(res.cullRefusedReason).toBe('too big');
  });
});

// ── the route: defence in depth, not the structural guard ─────────────────────────
const startMeshFinishJob = vi.fn<(spec: Record<string, unknown>, cls?: string) => string>();
vi.mock('@/lib/visual-gen/mesh-finish-job-store', () => ({
  startMeshFinishJob: (spec: Record<string, unknown>, cls?: string) => startMeshFinishJob(spec, cls),
}));

describe('POST /api/visual-gen/mesh-finish refuses cullInterior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMeshFinishJob.mockReturnValue('job-1');
  });

  // A real file the route's own existsSync check will accept, and a throwaway output dir,
  // so the accept-path test exercises the route rather than a mocked filesystem.
  const HIGH_POLY = join(process.cwd(), 'scripts', 'visual-gen', 'pof_mesh_finish.py');
  const OUT = join(tmpdir(), 'pof-cull-guard', 'out.glb');

  const post = async (body: unknown) => {
    const { POST } = await import('@/app/api/visual-gen/mesh-finish/route');
    const { NextRequest } = await import('next/server');
    return POST(
      new NextRequest('http://localhost/api/visual-gen/mesh-finish', { method: 'POST', body: JSON.stringify(body) }),
    );
  };

  it('400s a cullInterior request and starts no job', async () => {
    const res = await post({ highPolyPath: HIGH_POLY, outputPath: OUT, cullInterior: true });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/cullInterior is not accepted over HTTP/);
    // Refused BEFORE the work is queued — a refusal after the job starts is not one.
    expect(startMeshFinishJob).not.toHaveBeenCalled();
  });

  it('still accepts an ordinary finish request, and the spec it queues carries no cull flag', async () => {
    const res = await post({ highPolyPath: HIGH_POLY, outputPath: OUT, targetFaces: 40_000 });
    expect(res.status).toBe(202);
    expect(startMeshFinishJob).toHaveBeenCalledTimes(1);
    expect(startMeshFinishJob.mock.calls[0][0]).not.toHaveProperty('cullInterior');
  });
});
