/**
 * One import plan: the gate's scale is derived once, applied and read back.
 *
 * `world-scale.ts` computes the `importUniformScale` that makes a generator-normalised ~1 m
 * box the size it was meant to be, and until this plan nothing applied it. `planUeImport` is
 * the ONE authority for both quantities the import edge decides — how the mesh blocks
 * (collision) and how big it is (scale) — so no second theory can type either by hand.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { planUeImport, collisionPlanFor } from '@/lib/visual-gen/ue-import-plan';
import type { CritiqueResult, MeshMetrics } from '@/lib/visual-gen/mesh-critique';

const metrics = (over: Partial<MeshMetrics> = {}): MeshMetrics => ({
  verts: 1000, faces: 2000, watertight: true, windingConsistent: true,
  components: 3, euler: 2, bbox: [0.4, 1.0, 0.3], volume: 1, area: 6, degenerateFaces: 0,
  componentFaces: [900, 800, 700],
  ...over,
});

const okCritique = (scale: CritiqueResult['scale']): CritiqueResult =>
  ({ ok: true, metrics: metrics(), verdict: 'warn', score: 85, reasons: [], scale }) as CritiqueResult;

describe('planUeImport — scale is derived from the gate, never typed', () => {
  it('case 1: an off-scale measured mesh with a target yields the gate factor, and the same collision plan', () => {
    const critique = okCritique({ verdict: 'off', measuredExtentM: 1.0, targetExtentM: 1.8, importUniformScale: 1.8 });
    const plan = planUeImport({ critique, use: 'blocking' });
    expect(plan.scale).toMatchObject({ derivable: true, factor: 1.8, basis: 'measured', targetExtentCm: 180 });
    expect(plan.collision).toEqual(collisionPlanFor(critique, 'blocking').plan);
    expect(plan.collisionBasis).toBe('measured');
    expect(plan.shells).toBe(3);
  });

  it('case 2: no target is NOT a scale of 1 — not derivable, and the reason names targetExtentM', () => {
    const critique = okCritique({ verdict: 'unmeasured', measuredExtentM: 1.0 });
    const plan = planUeImport({ critique, use: 'blocking' });
    expect(plan.scale.derivable).toBe(false);
    expect(plan.scale.factor).toBeUndefined();
    expect(plan.scale.basis).toBe('no-target');
    expect(plan.scale.reason).toMatch(/targetExtentM/);
    expect(plan.scale.factor).not.toBe(1);
  });

  it('case 3: an unavailable critic leaves scale unmeasured and carries the collision honesty unchanged', () => {
    const critique: CritiqueResult = { ok: false, unavailable: true, error: 'no trimesh' };
    const plan = planUeImport({ critique, use: 'blocking' });
    expect(plan.scale).toMatchObject({ derivable: false, basis: 'unmeasured' });
    expect(plan.scale.factor).toBeUndefined();
    expect(plan.collisionBasis).toBe('assumed');
    expect(plan.collision).toEqual(collisionPlanFor(critique, 'blocking').plan);
  });

  it('reports orientation from the same critique, and says it is not applied', () => {
    const critique = {
      ...okCritique({ verdict: 'matches', measuredExtentM: 1.8, targetExtentM: 1.8, importUniformScale: 1 }),
      orientation: { verdict: 'lying', suggestedRotation: { axis: 'x', degrees: 90 } },
    } as CritiqueResult;
    const plan = planUeImport({ critique, use: 'character' });
    expect(plan.orientation.verdict).toBe('lying');
    expect(plan.orientation.suggestedRotation).toEqual({ axis: 'x', degrees: 90 });
    expect(plan.orientation.applied).toBe(false);
  });
});

// ── The client bundle (coordinator revision, binding) ─────────────────────────
// ImportAutomationView is 'use client' and renders the plan's python. If the plan module (or
// the template it feeds) reaches node:* / the editor runner / the trimesh critic, the view
// pulls server code into the browser bundle — invisible to typecheck, lint and every unit test.
const SRC = resolve(process.cwd(), 'src');

function resolveSpec(fromFile: string, spec: string): string | undefined {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(fromFile), spec) : undefined;
  if (!base) return undefined;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(c) && c.match(/\.tsx?$/)) return c;
  }
  return undefined;
}

/** Every static specifier reachable from `entry` (type-only imports included — stricter). */
function walk(entry: string): { specs: string[]; files: string[] } {
  const seen = new Set<string>();
  const specs: string[] = [];
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const text = readFileSync(f, 'utf8');
    const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const m of text.matchAll(re)) {
      const spec = m[1] ?? m[2] ?? m[3];
      specs.push(spec);
      const next = resolveSpec(f, spec);
      if (next) stack.push(next);
    }
  }
  return { specs, files: [...seen].map((p) => p.replace(/\\/g, '/')) };
}

describe('case 8 (revision): the plan and the template stay node-free', () => {
  for (const rel of ['lib/visual-gen/ue-import-plan.ts', 'lib/visual-gen/ue5-import-templates.ts']) {
    it(`${rel} reaches no node:*, no ue-experiment/runner, no mesh-critique.ts`, () => {
      const entry = join(SRC, rel);
      expect(existsSync(entry)).toBe(true);
      const { specs, files } = walk(entry);
      expect(specs.filter((s) => s.startsWith('node:'))).toEqual([]);
      expect(specs.filter((s) => /^(fs|path|os|child_process|crypto)$/.test(s))).toEqual([]);
      expect(files.filter((f) => f.includes('ue-experiment/runner'))).toEqual([]);
      expect(files.filter((f) => f.endsWith('mesh-critique.ts'))).toEqual([]);
    });
  }

  it('the template actually reaches the plan (the walk is not vacuous)', () => {
    const { files } = walk(join(SRC, 'lib/visual-gen/ue5-import-templates.ts'));
    expect(files.some((f) => f.endsWith('ue-import-plan.ts'))).toBe(true);
  });
});
