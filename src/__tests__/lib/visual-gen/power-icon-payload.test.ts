import { describe, it, expect } from 'vitest';
import {
  buildIconList as libBuildIconList,
  iconFileBase as libIconFileBase,
  iconSlug as libIconSlug,
  resolveIconFor as libResolveIconFor,
} from '@/lib/visual-gen/generated-icons';
import {
  PASS_AT,
  iconSlug,
  slugOfIconFile,
  iconFileBase,
  iconFileName,
  gateOutcome,
  buildArtifactPayload,
  buildVerdictPayload,
  reachableIconSlugs,
  unreachableIconNames,
} from '../../../../scripts/gap-loop/power-icon-payload.mjs';

/**
 * `scripts/gap-loop/power-icon.mjs` used to hardcode `status: 'pass'` on its artifact POST
 * while computing `score >= 7 ? 'pass' : 'fail'` three lines later and posting THAT to
 * `/api/judge-verdicts` — a sub-threshold image persisted as a passing artifact with a
 * failing verdict beside it. It also wrote `${catalogId}__${entityId}__t${i}.jpg`, which
 * `iconSlug` can never match, so the art it generated was invisible to the step that
 * needed it.
 *
 * These tests drive the extracted pure module (the script cannot be run here: it costs a
 * live Leonardo generation and spawns a Python VLM). They are the forced-failure proof for
 * both defects.
 */
describe('power-icon payload — the artifact carries the score\'s own verdict', () => {
  it('score below the gate is NOT persisted as pass', () => {
    const gate = gateOutcome(4.5);
    expect(gate.status).toBe('fail');
    expect(gate.verdict).toBe('fail');
    expect(gate.ran).toBe(true);
    expect(buildArtifactPayload({ catalogId: 'items', entityId: 'item-1', step: 'Art', data: {}, gate }).status)
      .toBe('fail');
  });

  it('score at or above the gate passes', () => {
    expect(gateOutcome(7).status).toBe('pass');
    expect(gateOutcome(9.5).status).toBe('pass');
    expect(gateOutcome(6.9).status).toBe('fail');
  });

  it('a gate that did not run reports the honest third state, not a default either way', () => {
    for (const absent of [null, undefined, NaN]) {
      const gate = gateOutcome(absent as number | null | undefined, PASS_AT, 'python.exe ENOENT');
      expect(gate.ran).toBe(false);
      expect(gate.status).toBe('pending');
      expect(gate.status).not.toBe('pass');
      expect(gate.status).not.toBe('fail');
      expect(gate.verdict).toBeNull();
      expect(gate.reason).toMatch(/did not run/i);
      expect(gate.reason).toMatch(/UNVERIFIED/);
    }
    expect(gateOutcome(null, PASS_AT, 'python.exe ENOENT').reason).toContain('python.exe ENOENT');
  });

  it('the artifact status and the judge verdict can never disagree — both read one gate', () => {
    for (const score of [0, 3, 6.99, 7, 8, 10]) {
      const gate = gateOutcome(score);
      const art = buildArtifactPayload({ catalogId: 'c', entityId: 'e', step: 's', data: {}, gate });
      const verdict = buildVerdictPayload({ catalogId: 'c', entityId: 'e', step: 's', gate, findings: 'x'.repeat(20) });
      expect(verdict).not.toBeNull();
      expect(art.status).toBe(verdict!.verdict);
    }
  });

  it('no judge verdict is posted when nothing was measured', () => {
    const gate = gateOutcome(null, PASS_AT, 'VLM crashed');
    expect(buildVerdictPayload({ catalogId: 'c', entityId: 'e', step: 's', gate, findings: 'x'.repeat(20) })).toBeNull();
  });

  it('the artifact carries the gate reason so a persisted status is auditable', () => {
    const p = buildArtifactPayload({ catalogId: 'c', entityId: 'e', step: 's', data: { a: 1 }, gate: gateOutcome(3) });
    expect(p.reason).toMatch(/3\/10/);
    expect(p.reason).toMatch(/below/);
    expect(p.tier).toBe('L1');
    expect(p.data).toEqual({ a: 1 });
  });

  it('the verdict score is the 0-100 scale the judge-verdicts schema requires', () => {
    const v = buildVerdictPayload({ catalogId: 'c', entityId: 'e', step: 's', gate: gateOutcome(8.5), findings: 'y'.repeat(20) });
    expect(v!.score).toBe(85);
    expect(v!.judge).toBe('vlm');
  });
});

describe('power-icon naming — a written icon is reachable by the step that must show it', () => {
  const CASES: [string, string][] = [
    ['items', 'Art'],
    ['character-pipeline', '3D Generation'],
    ['achievements', 'Icon 2D Art'],
    ['combat-map', 'Icon 2D Art'],
    ['zone_map', '3D Biome'],
    ['hud-elements', 'Wireframe / Layout'],
    ['vfx', 'Mesh + Sprite'],
    ['props', 'Icon 2D Art'],
  ];

  it('replicates the app iconSlug byte-for-byte', () => {
    for (const [catalogId, step] of CASES) {
      expect(iconSlug(catalogId, step)).toBe(libIconSlug(catalogId, step));
    }
  });

  it('names the file so the consumer\'s own matcher finds it', () => {
    for (const [catalogId, step] of CASES) {
      const file = iconFileName(catalogId, step);
      expect(file.endsWith('.jpg')).toBe(true);
      // This is the exact comparison `iconsForStep` / the icons route filter make.
      expect(slugOfIconFile(file)).toBe(libIconSlug(catalogId, step));
    }
  });

  it('rejects the old try-indexed name — that is the shape that was unmatchable', () => {
    const old = 'items__item-1__t0.jpg';
    expect(slugOfIconFile(old)).not.toBe(libIconSlug('items', 'Art'));
    expect(iconFileName('items', 'Art')).not.toBe(old);
  });
});

describe('power-icon reachability report — dead files are named, never silently listed', () => {
  const PIPELINES = [
    { catalogId: 'items', steps: ['Art', 'Economy'] },
    { catalogId: 'achievements', steps: ['Icon 2D Art'] },
  ];

  it('reports exactly the files no registered step can match', () => {
    const reachable = reachableIconSlugs(PIPELINES);
    const names = [
      'items_Art.jpg',
      'achievements_Icon_2D_Art.jpg',
      'items__item-1__t0.jpg',
      'charpipeline_face.jpg',
      'props__crate__hero.jpg',
    ];
    expect(unreachableIconNames(names, reachable)).toEqual([
      'items__item-1__t0.jpg',
      'charpipeline_face.jpg',
      'props__crate__hero.jpg',
    ]);
  });

  it('a file this script writes is never in the report', () => {
    const reachable = reachableIconSlugs(PIPELINES);
    expect(unreachableIconNames([iconFileName('items', 'Art')], reachable)).toEqual([]);
  });

  it('tolerates an empty or absent pipeline list without claiming everything is fine', () => {
    expect(unreachableIconNames(['x.jpg'], reachableIconSlugs([]))).toEqual(['x.jpg']);
    expect(unreachableIconNames(undefined, reachableIconSlugs(undefined))).toEqual([]);
  });
});

/**
 * D1 — the entity dimension. The library key is the ARTIFACT identity
 * `(catalog, entity, step)`, so the script's naming helper must stay byte-identical to the
 * app's, and an entity-scoped file for a REGISTERED step must stop reading as dead art.
 */
describe('power-icon naming — the entity dimension stays byte-identical to the app', () => {
  const CASES: [string, string, string][] = [
    ['items', 'Icon 2D Art', 'item-1'],
    ['props', 'Icon 2D Art', 'prop-reinforced-crate'],
    ['character-pipeline', 'Concept 2D', 'char-captain-vael'],
  ];

  it('re-encodes the same slug as the app for every entity-scoped case', () => {
    for (const [catalogId, step, entityId] of CASES) {
      expect(iconSlug(catalogId, step, entityId)).toBe(libIconSlug(catalogId, step, entityId));
      expect(iconFileBase(catalogId, step, entityId)).toBe(libIconFileBase(catalogId, step, entityId));
    }
  });

  it('writes a name the app resolves back to that entity, with entity scope', () => {
    for (const [catalogId, step, entityId] of CASES) {
      const file = iconFileName(catalogId, step, 'jpg', entityId);
      const icons = libBuildIconList([{ name: file, mtimeMs: 1 }]);
      const hit = libResolveIconFor(icons, catalogId, step, entityId);
      expect(hit?.scope).toBe('entity');
      expect(hit?.name).toBe(file);
    }
  });

  it('leaves the per-step name untouched when no entity scope is asked for', () => {
    expect(iconFileName('items', 'Icon 2D Art')).toBe('items_icon_2d_art.jpg');
  });

  it('stops reporting entity-scoped art for a REGISTERED step as unreachable', () => {
    const reachable = reachableIconSlugs([{ catalogId: 'items', steps: ['Icon 2D Art'] }]);
    const live = iconFileName('items', 'Icon 2D Art', 'jpg', 'item-1');
    expect(unreachableIconNames([live], reachable)).toEqual([]);
    // …but an entity file whose STEP is not registered is still named as dead.
    expect(unreachableIconNames(['items__item-1__nope.jpg'], reachable)).toEqual(['items__item-1__nope.jpg']);
  });
});
