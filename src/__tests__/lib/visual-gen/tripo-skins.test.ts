import { describe, it, expect } from 'vitest';
import {
  buildTextureTaskBody,
  planSkinSet,
  checkSkinGeometry,
  runTripoSkinSet,
  type SkinSetSpec,
} from '@/lib/visual-gen/tripo-skins';
import type { TripoHttp } from '@/lib/visual-gen/tripo-runner';

const spec = (over: Partial<SkinSetSpec> = {}): SkinSetSpec => ({
  originalTaskId: 'task-geo-1',
  outputDir: '/out',
  variants: [{ name: 'gold' }, { name: 'crimson' }],
  apiKey: 'k',
  pollIntervalMs: 1,
  maxPolls: 3,
  ...over,
});

describe('buildTextureTaskBody', () => {
  it('targets the shared geometry by its originating Tripo task id', () => {
    const b = buildTextureTaskBody('task-geo-1', { name: 'gold' });
    expect(b.type).toBe('texture_model');
    expect(b.original_model_task_id).toBe('task-geo-1');
  });

  it('defaults to a textured PBR standard bake aligned to the original image', () => {
    const b = buildTextureTaskBody('t', { name: 'gold' });
    expect(b.texture).toBe(true);
    expect(b.pbr).toBe(true);
    expect(b.texture_quality).toBe('standard');
    expect(b.texture_alignment).toBe('original_image');
  });

  it('passes the per-variant seed / quality / alignment through', () => {
    const b = buildTextureTaskBody('t', {
      name: 'crimson',
      textureSeed: 42,
      quality: 'detailed',
      alignment: 'geometry',
      pbr: false,
    });
    expect(b.texture_seed).toBe(42);
    expect(b.texture_quality).toBe('detailed');
    expect(b.texture_alignment).toBe('geometry');
    expect(b.pbr).toBe(false);
  });

  it('omits the seed entirely when unset (so Tripo picks its own)', () => {
    expect('texture_seed' in buildTextureTaskBody('t', { name: 'gold' })).toBe(false);
  });
});

describe('planSkinSet', () => {
  it('maps each variant to its own output file under the skin directory', () => {
    const p = planSkinSet(spec());
    expect(p.ok).toBe(true);
    expect(p.jobs?.map((j) => j.name)).toEqual(['gold', 'crimson']);
    expect(p.jobs?.[0].outputPath).toContain('gold');
    expect(p.jobs?.[0].outputPath).toMatch(/\.glb$/);
  });

  it('slugifies variant names into safe filenames', () => {
    const p = planSkinSet(spec({ variants: [{ name: 'Crimson Elite / MK II' }] }));
    expect(p.jobs?.[0].outputPath).toContain('crimson-elite-mk-ii');
  });

  it('refuses an empty variant list — a skin set of one texture is just a texture', () => {
    const p = planSkinSet(spec({ variants: [] }));
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/at least one/i);
  });

  it('refuses variant names that collide after slugification (they would overwrite each other)', () => {
    const p = planSkinSet(spec({ variants: [{ name: 'Gold' }, { name: 'gold' }] }));
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/gold/);
  });

  it('refuses a name with no usable characters', () => {
    const p = planSkinSet(spec({ variants: [{ name: '///' }] }));
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/name/i);
  });

  it('refuses a missing geometry task id — there is nothing to re-skin', () => {
    const p = planSkinSet(spec({ originalTaskId: '  ' }));
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/originalTaskId/);
  });
});

describe('checkSkinGeometry', () => {
  it('reports consistent when every skin carries the same face/vertex count', () => {
    const r = checkSkinGeometry([
      { name: 'gold', faces: 100, verts: 60 },
      { name: 'crimson', faces: 100, verts: 60 },
    ]);
    expect(r.status).toBe('consistent');
  });

  it('reports divergent and NAMES the odd skin when a re-mesh slipped in', () => {
    const r = checkSkinGeometry([
      { name: 'gold', faces: 100, verts: 60 },
      { name: 'crimson', faces: 137, verts: 80 },
    ]);
    expect(r.status).toBe('divergent');
    expect(r.reason).toContain('crimson');
  });

  it('reports unmeasured rather than claiming consistency it never checked', () => {
    const r = checkSkinGeometry([{ name: 'gold' }, { name: 'crimson' }]);
    expect(r.status).toBe('unmeasured');
    expect(r.reason).toMatch(/not measured/i);
  });

  it('is unmeasured when fewer than two skins carry measurements', () => {
    const r = checkSkinGeometry([{ name: 'gold', faces: 100, verts: 60 }, { name: 'crimson' }]);
    expect(r.status).toBe('unmeasured');
  });
});

// ── orchestration ─────────────────────────────────────────────────────────────

function httpStub(over: Partial<TripoHttp> = {}): TripoHttp {
  return {
    postJson: async () => ({ status: 200, json: { code: 0, data: { task_id: 'tex-1' } } }),
    getJson: async () => ({ status: 200, json: { code: 0, data: { status: 'success', output: { pbr_model: 'https://x/m.glb' } } } }),
    uploadImage: async () => ({ status: 200, json: {} }),
    download: async () => true,
    ...over,
  };
}

const okDeps = (http: TripoHttp = httpStub()) => ({
  http,
  env: { TRIPO_API_KEY: 'k' },
  fileExists: () => true,
  now: () => 0,
  sleep: async () => {},
});

describe('runTripoSkinSet', () => {
  it('produces one mesh per variant off ONE geometry task', async () => {
    const bodies: unknown[] = [];
    const http = httpStub({
      postJson: async (_u, _h, body) => {
        bodies.push(body);
        return { status: 200, json: { code: 0, data: { task_id: `tex-${bodies.length}` } } };
      },
    });
    const r = await runTripoSkinSet(spec(), okDeps(http));
    expect(r.ok).toBe(true);
    expect(r.skins).toHaveLength(2);
    expect(r.skins.every((s) => s.ok)).toBe(true);
    expect(r.geometryTaskId).toBe('task-geo-1');
    expect(bodies.every((b) => (b as Record<string, unknown>).original_model_task_id === 'task-geo-1')).toBe(true);
  });

  it('surfaces the plan error without spending a single call', async () => {
    let calls = 0;
    const http = httpStub({ postJson: async () => { calls++; return { status: 200, json: {} }; } });
    const r = await runTripoSkinSet(spec({ variants: [] }), okDeps(http));
    expect(r.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it('fails without an API key rather than pretending to run', async () => {
    const r = await runTripoSkinSet(spec({ apiKey: undefined }), { ...okDeps(), env: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/TRIPO_API_KEY/);
  });

  it('keeps the skins that succeeded and reports the one that failed', async () => {
    let n = 0;
    const http = httpStub({
      postJson: async () => {
        n++;
        return n === 2
          ? { status: 200, json: { code: 2010, message: 'not enough credit' } }
          : { status: 200, json: { code: 0, data: { task_id: `tex-${n}` } } };
      },
    });
    const r = await runTripoSkinSet(spec(), okDeps(http));
    expect(r.ok).toBe(false);
    expect(r.skins[0].ok).toBe(true);
    expect(r.skins[1].ok).toBe(false);
    expect(r.skins[1].error).toMatch(/credit/);
  });

  it('reports a failed download instead of claiming a skin file that is not there', async () => {
    const r = await runTripoSkinSet(spec({ variants: [{ name: 'gold' }] }), {
      ...okDeps(httpStub({ download: async () => false })),
      fileExists: (p: string) => !p.endsWith('.glb'),
    });
    expect(r.ok).toBe(false);
    expect(r.skins[0].error).toMatch(/download/i);
  });

  it('measures the produced skins and grades geometry consistency when a measurer is supplied', async () => {
    const r = await runTripoSkinSet(spec(), {
      ...okDeps(),
      measure: async (p: string) => (p.includes('gold') ? { faces: 100, verts: 60 } : { faces: 100, verts: 60 }),
    });
    expect(r.geometry.status).toBe('consistent');
    expect(r.skins[0].faces).toBe(100);
  });

  it('flags a divergent skin set — same skin name, different geometry is not a skin', async () => {
    const r = await runTripoSkinSet(spec(), {
      ...okDeps(),
      measure: async (p: string) => (p.includes('gold') ? { faces: 100, verts: 60 } : { faces: 99, verts: 59 }),
    });
    expect(r.geometry.status).toBe('divergent');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/geometry/i);
  });

  it('stays unmeasured (not falsely consistent) with no measurer', async () => {
    const r = await runTripoSkinSet(spec(), okDeps());
    expect(r.geometry.status).toBe('unmeasured');
    expect(r.ok).toBe(true);
  });
});
