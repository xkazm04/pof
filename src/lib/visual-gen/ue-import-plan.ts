/**
 * The UE import PLAN — the one authority for the two quantities the import edge decides about
 * a generated mesh: how it blocks (collision) and how big it is (scale). Pure and node-free.
 *
 * Why one plan. `world-scale.ts` has always derived the `importUniformScale` that turns a
 * generator-normalised ~1 m box into the size it was meant to be, and the Studio / Asset Viewer
 * display it — while nothing applied it. The executing import (`ue-import-job-store.ts`) called
 * the critic with the path alone, so at the import the scale grade was always `unmeasured`; and
 * a second import theory (Import Automation) typed `scale: 1.0` and `bAutoGenerateCollision`
 * by hand. Both quantities are now derived here, from the SAME gate critique, applied by the
 * import python below and READ BACK after the import (`importGlbToUE`).
 *
 * Rules (registry: generated-asset-world-scale#import-scale-derivation):
 *  - the factor is applied in exactly one place — the import edge — and recorded;
 *  - a missing input is "not derivable", never a scale of 1;
 *  - collision keeps its own evidence basis (measured / declared / assumed / not-needed).
 *
 * Node-free ON PURPOSE: Import Automation is a client component that renders this python, so
 * this module (and everything it imports) must never reach `node:*`, the experiment runner or
 * `mesh-critique.ts` — a vitest walk of its static imports enforces that.
 */
import { SCALE_TOLERANCE, type Axis, type OrientationVerdict, type ScaleGrade, type OrientationGrade } from './world-scale';
import { classifyComponents } from './component-split';

/**
 * What the imported mesh is FOR. Collision is a use-decision, not a mesh property: the same
 * geometry wants hulls as a crate and nothing at all as a wall decoration.
 */
export type CollisionUse = 'blocking' | 'decorative' | 'character';

/**
 * How collision should be built for one imported mesh.
 *
 * `complex` (the render mesh used directly as collision) is deliberately NOT representable.
 * It is forbidden for anything that moves and is a last resort everywhere else; leaving it out
 * of the type means no plan can quietly select it.
 */
export interface CollisionPlan {
  kind: 'none' | 'simple' | 'convex';
  /** Primitive for `simple`. */
  shape?: 'BOX' | 'SPHERE' | 'CAPSULE' | 'NDOP10_X';
  /** Hull budget for `convex`. */
  hullCount?: number;
  maxHullVerts?: number;
  /** Why this plan, in one line — a bare enum cannot explain a refusal. */
  reason: string;
}

/** Hulls for a multi-part blocking prop. Low on purpose: raise only if the silhouette blocks wrongly. */
export const DEFAULT_HULL_COUNT = 6;
export const DEFAULT_MAX_HULL_VERTS = 16;

/**
 * Decide collision for an imported generated mesh. Pure.
 *
 * A generated `.glb` carries no collision of any kind, and glTF has no `UCX_` convention to
 * carry one (that is FBX-importer-only — a `UCX_` object exported into a `.glb` imports as a
 * second VISIBLE mesh). So collision has to be built after import, and something has to decide
 * what shape it takes. See the `generated-mesh-arrives-without-collision` gotcha.
 */
export function collisionPlan(req: { use: CollisionUse; components?: number }): CollisionPlan {
  if (req.use === 'decorative') {
    return {
      kind: 'none',
      reason: 'decorative asset — no collision at all; a wrong hull blocks the player worse than nothing does',
    };
  }
  // One shell → one primitive reads correctly and costs nothing. Multiple shells mean the
  // silhouette has concavities a single box would bridge, which is what hulls are for.
  if ((req.components ?? 1) <= 1) {
    return {
      kind: 'simple',
      shape: 'BOX',
      reason: 'single-shell mesh — one box primitive is the cheapest collision that reads correctly',
    };
  }
  return {
    kind: 'convex',
    hullCount: DEFAULT_HULL_COUNT,
    maxHullVerts: DEFAULT_MAX_HULL_VERTS,
    reason: `${req.components} shells — convex decomposition at ${DEFAULT_HULL_COUNT} hulls; raise the budget only if the silhouette blocks wrongly`,
  };
}

/**
 * Where a collision plan's shell count came from. The same convention as
 * `scoreBreakdown`'s `basis`: a plan that states its kind but not its evidence lets an
 * assumed shape read exactly like a measured one.
 */
export type CollisionPlanBasis = 'measured' | 'declared' | 'assumed' | 'not-needed';

export interface PlanDerivation {
  plan: CollisionPlan;
  basis: CollisionPlanBasis;
  shells?: number;
}

/**
 * The slice of a Tier-1 `CritiqueResult` the plan reads — stated structurally so this module
 * never imports `mesh-critique.ts` (node:*). A `CritiqueResult` is assignable to it.
 */
export interface PlanCritique {
  ok: boolean;
  unavailable?: boolean;
  error?: string;
  metrics?: { components: number; componentFaces?: number[]; componentFacesOmitted?: number };
  scale?: ScaleGrade;
  orientation?: OrientationGrade;
}

/**
 * Derive a collision plan from what was actually measured about the mesh. Pure.
 *
 * Shell counting uses `classifyComponents`, not the raw `components` number: an assembled
 * character is legitimately multi-shell, and a shattered one carries dozens of two-face
 * specks. Planning hull budgets off the raw count would reason about concavity that is
 * really shrapnel. When the histogram is absent the raw count is still a MEASUREMENT and is
 * used as one — it is only the critic failing to run that drops the basis to `declared` or
 * `assumed`.
 */
export function collisionPlanFor(
  critique: PlanCritique | undefined,
  use: CollisionUse,
  declared?: number,
): PlanDerivation {
  // A decorative asset gets no collision, so nothing needs measuring and no doubt is
  // introduced by not having measured.
  if (use === 'decorative') return { plan: collisionPlan({ use }), basis: 'not-needed' };

  const m = critique?.ok === true ? critique.metrics : undefined;
  if (m) {
    const split = classifyComponents(m.componentFaces, m.componentFacesOmitted);
    const shells = split.measured ? split.parts : m.components;
    return { plan: collisionPlan({ use, components: shells }), basis: 'measured', shells };
  }

  if (declared !== undefined) {
    return { plan: collisionPlan({ use, components: declared }), basis: 'declared', shells: declared };
  }

  // Nothing measured it and nobody said. A plan is still made — refusing to import over a
  // missing critic would be worse — but the doubt rides on the plan's own reason line,
  // because `kind: 'simple'` alone cannot say "and I never looked at the mesh".
  const plan = collisionPlan({ use });
  return {
    plan: {
      ...plan,
      reason: `${plan.reason} — ASSUMED: the geometry critic did not run and no shell count was declared, so the mesh was never inspected`,
    },
    basis: 'assumed',
  };
}

/** Where a scale plan came from. `measured` is the only basis that yields a factor. */
export type ScalePlanBasis = 'measured' | 'no-target' | 'unmeasured';

export interface ScalePlan {
  /** True only when a measured extent AND a target were both known. */
  derivable: boolean;
  /** `target / measured` — the uniform factor applied at import. Absent unless derivable. */
  factor?: number;
  basis: ScalePlanBasis;
  /** The longest extent (cm, after the importer's m→cm) the imported mesh must read back. */
  targetExtentCm?: number;
  measuredExtentCm?: number;
  reason: string;
}

/** The factor + the extent it must produce — what the importer applies and then checks. */
export interface ImportScale {
  factor: number;
  targetExtentCm: number;
}

export interface OrientationReport {
  verdict: OrientationVerdict;
  suggestedRotation?: { axis: Axis; degrees: number };
  /** Always false: no import-time rotation call has been verified, so none is emitted. */
  applied: false;
  reason: string;
}

export interface UeImportPlan {
  collision: CollisionPlan;
  collisionBasis: CollisionPlanBasis;
  shells?: number;
  scale: ScalePlan;
  orientation: OrientationReport;
}

export interface UeImportPlanInput {
  critique: PlanCritique | undefined;
  use: CollisionUse;
  /** Shell count asserted by the caller — used ONLY when the critic could not measure. */
  declaredShells?: number;
  /** Named in reasons only; the target itself arrives inside the critique's scale grade. */
  assetClass?: string;
  targetExtentM?: number;
}

const usable = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const cm = (m: number) => Math.round(m * 1000) / 10;

function planScale(input: UeImportPlanInput): ScalePlan {
  const c = input.critique;
  const g = c?.ok === true && c.metrics ? c.scale : undefined;
  if (!g) {
    const why = !c ? 'no critique ran' : c.unavailable ? `the critic could not run (${c.error ?? 'reason not reported'})` : c.ok ? 'the critique carried no scale grade' : `the critique did not complete (${c.error ?? 'unknown error'})`;
    return { derivable: false, basis: 'unmeasured', reason: `${why} — no measured extent, so no scale is derivable; nothing is applied (a missing input is not a scale of 1)` };
  }
  if (!usable(g.targetExtentM)) {
    const cls = input.assetClass ? `class '${input.assetClass}' has no honest nominal extent` : 'no asset class with a nominal extent was given';
    return {
      derivable: false,
      basis: 'no-target',
      ...(usable(g.measuredExtentM) ? { measuredExtentCm: cm(g.measuredExtentM) } : {}),
      reason: `no targetExtentM was declared and ${cls} — nothing to scale to; the mesh imports at its delivered size (a missing target is not a scale of 1)`,
    };
  }
  if (!usable(g.measuredExtentM) || !usable(g.importUniformScale)) {
    return { derivable: false, basis: 'unmeasured', targetExtentCm: cm(g.targetExtentM), reason: g.reason ?? 'the mesh extent was not measured — the target cannot be applied without one' };
  }
  const factor = Math.round(g.importUniformScale * 1e4) / 1e4;
  return {
    derivable: true,
    factor,
    basis: 'measured',
    targetExtentCm: cm(g.targetExtentM),
    measuredExtentCm: cm(g.measuredExtentM),
    reason: `measured ${g.measuredExtentM.toFixed(2)} m against a ${g.targetExtentM.toFixed(2)} m target — applied as build scale ×${factor} at import and read back from the imported bounds`,
  };
}

function reportOrientation(critique: PlanCritique | undefined): OrientationReport {
  const o = critique?.ok === true ? critique.orientation : undefined;
  return {
    verdict: o?.verdict ?? 'unmeasured',
    ...(o?.suggestedRotation ? { suggestedRotation: o.suggestedRotation } : {}),
    applied: false,
    reason: 'reported, not applied — no import-time rotation call has been verified against a live editor' +
      (o?.suggestedRotation ? `; rotate ${o.suggestedRotation.degrees}° about ${o.suggestedRotation.axis.toUpperCase()} before import` : ''),
  };
}

/** The ONE plan for importing a generated mesh: collision + scale (+ orientation, reported). Pure. */
export function planUeImport(input: UeImportPlanInput): UeImportPlan {
  const { plan, basis, shells } = collisionPlanFor(input.critique, input.use, input.declaredShells);
  return {
    collision: plan,
    collisionBasis: basis,
    ...(shells !== undefined ? { shells } : {}),
    scale: planScale(input),
    orientation: reportOrientation(input.critique),
  };
}

/** The scale an importer should apply for a plan, or undefined when none is derivable. */
export function importScaleOf(scale: ScalePlan): ImportScale | undefined {
  return scale.derivable && usable(scale.factor) && usable(scale.targetExtentCm)
    ? { factor: scale.factor, targetExtentCm: scale.targetExtentCm }
    : undefined;
}

/**
 * Judge the extent READ BACK from the imported mesh against the size the plan asked for.
 * Undefined when it holds; otherwise the reason the import must not claim a size. Pure.
 */
export function scaleReadBackError(scale: ImportScale, observedExtentCm: number | undefined): string | undefined {
  const ask = `×${scale.factor} toward ${scale.targetExtentCm} cm`;
  if (observedExtentCm === undefined || !Number.isFinite(observedExtentCm)) {
    return `scale requested but no extent observed (${ask}) — nothing read the imported bounds back, so the size is not claimed`;
  }
  const ratio = observedExtentCm / scale.targetExtentCm;
  if (Math.abs(ratio - 1) <= SCALE_TOLERANCE) return undefined;
  return `scale requested (${ask}) but the imported mesh measures ${observedExtentCm} cm against the ${scale.targetExtentCm} cm target (${ratio.toFixed(2)}x) — the build scale did not take`;
}

// ── The import python ────────────────────────────────────────────────────────

/** Save EVERYTHING the import produced, not just the mesh (see `gltf-import-returns-many-assets`). */
const SAVE_ALL = [
  'for p in paths:',
  '    a = unreal.load_asset(p)',
  '    if a:',
  '        unreal.EditorAssetLibrary.save_loaded_asset(a)',
];

/**
 * The python lines that build collision and READ IT BACK (no save).
 *
 * ⚠️ UNVERIFIED AGAINST A LIVE EDITOR. The call names come from the documented
 * `EditorStaticMeshLibrary` surface and the emitted source is syntax-checked, but the
 * `body_setup` -> `agg_geom` -> `convex_elems` / `box_elems` / `sphere_elems` / `sphyl_elems`
 * property chain has NOT been introspected on this project's UE build. Per the
 * `python-api-introspect-first` gotcha, the first live run should `dir()` the objects and
 * correct these names rather than assume them — and note that a wrong property name here fails
 * SAFE: the read-back throws or yields 0, and `importGlbToUE` then refuses to claim collision.
 */
function collisionCallPython(plan: CollisionPlan): string[] {
  const call =
    plan.kind === 'simple'
      ? `unreal.EditorStaticMeshLibrary.add_simple_collisions(mesh, unreal.ScriptingCollisionShapeType.${plan.shape ?? 'BOX'})`
      : `unreal.EditorStaticMeshLibrary.set_convex_decomposition_collisions(mesh, ${plan.hullCount ?? DEFAULT_HULL_COUNT}, ${plan.maxHullVerts ?? DEFAULT_MAX_HULL_VERTS}, 100000)`;
  return [
    'if mesh:',
    `    ${call}`,
    // The observation. A collision call that runs and produces nothing is indistinguishable
    // from one that worked unless the aggregate geometry is counted afterwards.
    "    bs = mesh.get_editor_property('body_setup')",
    '    agg = bs.get_editor_property(\'agg_geom\') if bs else None',
    '    n = (len(agg.get_editor_property(\'convex_elems\')) + len(agg.get_editor_property(\'box_elems\')) + len(agg.get_editor_property(\'sphere_elems\')) + len(agg.get_editor_property(\'sphyl_elems\'))) if agg else 0',
    "    unreal.log('POF_UE_COLLISION=' + str(n))",
  ];
}

/** Collision + save, the pre-scale shape. Empty for a `none` plan. */
function collisionPython(plan: CollisionPlan | undefined): string[] {
  if (!plan || plan.kind === 'none') return [];
  // Save after the collision call: `task.save` is False whenever a plan is present (the mesh
  // must not persist before collision is applied).
  return [...collisionCallPython(plan), ...SAVE_ALL];
}

/** A python float literal (`2` → `2.0`, `1.8` → `1.8`). */
const pyFloat = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(Math.round(n * 1e4) / 1e4));

/**
 * Apply the uniform factor on LOD0's build settings — BEFORE collision, because hulls must be
 * built on the scaled mesh — and, after all edits, log the imported longest extent (cm).
 *
 * ⚠️ UNVERIFIED AGAINST A LIVE EDITOR, like the collision chain: `StaticMeshEditorSubsystem`
 * `get/set_lod_build_settings` + `MeshBuildSettings.build_scale3d` and `get_bounds().box_extent`
 * are the documented surface, not introspected on this build. A wrong name fails SAFE: no
 * `POF_UE_EXTENT_CM` marker, and `importGlbToUE` refuses to claim a size.
 */
function scalePython(factor: number): string[] {
  const f = pyFloat(factor);
  return [
    'if mesh:',
    '    sms = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)',
    '    lod_build = sms.get_lod_build_settings(mesh, 0)',
    `    lod_build.set_editor_property('build_scale3d', unreal.Vector(${f}, ${f}, ${f}))`,
    '    sms.set_lod_build_settings(mesh, 0, lod_build)',
  ];
}

const EXTENT_READ_BACK = [
  'if mesh:',
  '    ext = mesh.get_bounds().box_extent',
  "    unreal.log('POF_UE_EXTENT_CM=' + str(2.0 * max(ext.x, ext.y, ext.z)))",
];

/**
 * UE python that imports a .glb via an AssetImportTask and logs the asset path. Pure.
 *
 * With a collision plan or a scale the task does NOT save at import time — saving before the
 * edits would persist the mesh without them — and every imported asset is saved explicitly
 * afterwards. With neither, the output is byte-identical to the pre-plan import.
 */
export function buildGlbImportPython(
  glbPath: string,
  destPath = '/Game/Generated',
  assetName = 'TripoSRMesh',
  opts: { collision?: CollisionPlan; scale?: number } = {},
): string {
  const glb = glbPath.replace(/\\/g, '/');
  const wantsCollision = !!opts.collision && opts.collision.kind !== 'none';
  const wantsScale = opts.scale !== undefined;
  const edits = wantsScale
    ? [
        ...scalePython(opts.scale!),
        ...(wantsCollision ? collisionCallPython(opts.collision!) : []),
        ...EXTENT_READ_BACK,
        ...SAVE_ALL,
      ]
    : collisionPython(opts.collision);
  return [
    'task = unreal.AssetImportTask()',
    `task.filename = '${glb}'`,
    `task.destination_path = '${destPath}'`,
    `task.destination_name = '${assetName}'`,
    'task.automated = True',
    'task.replace_existing = True',
    `task.save = ${wantsCollision || wantsScale ? 'False' : 'True'}`,
    'unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])',
    'paths = list(task.imported_object_paths)',
    // A glTF import produces SEVERAL assets — textures and materials among them — and
    // `imported_object_paths` is not ordered mesh-first. Measured on a live run: paths[0]
    // was a Texture2D, so the old `load_asset(paths[0])` handed a texture to
    // add_simple_collisions ("Cannot nativize 'Texture2D' as 'StaticMesh'") and the
    // reported asset path was a texture. Select by TYPE, before anything uses it.
    'mesh = None',
    "mesh_path = ''",
    'for p in paths:',
    '    o = unreal.load_asset(p)',
    '    if isinstance(o, unreal.StaticMesh):',
    '        mesh = o',
    '        mesh_path = p',
    '        break',
    "unreal.log('POF_UE_IMPORT=' + (mesh_path if mesh_path else (paths[0] if paths else 'NONE')))",
    // Distinguishes "imported something, but no mesh" from "imported nothing" — the two
    // have identical import markers and completely different causes.
    "unreal.log('POF_UE_MESH=' + ('YES' if mesh else 'NO'))",
    ...edits,
  ].join('\n');
}
