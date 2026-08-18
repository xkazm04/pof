/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * P-series ("Smart Mesh" / marketed as P1-P2) arena — a same-model, same-format A/B
 * between Tripo's audited baseline (already pinned by tripo-models.ts) and
 * `smart_low_poly: true` on the SAME model_version, for the three budgeted classes
 * that have no production caller yet: weapon, prop, modular-part.
 *
 * Deliberately does NOT trust `scoreMesh`'s pass/fail verdict as the arena's grade —
 * docs/research/impact-map.md (2026-08-14) already found the Tier-1 gate reads raw,
 * pre-retopo provider output against FINISHED game-tier thresholds and fails it near
 * 100% of the time regardless of quality. This script reports the underlying signals
 * instead: does the delivery honour the requested face budget (gradeFaceBudget), what
 * does its raw component/floater shape look like (classifyComponents), and how does a
 * Qwen-VL judge score the provider's own preview render against the reference image
 * (reusing anim-critique's makeQwenVision seam — generic (images, prompt) => text).
 *
 * Real spend: 2 Tripo tasks per class (smart_low_poly costs +10 credits on top of the
 * base task) + 1 Qwen vision call per delivered render. Nothing here writes production
 * data or pins anything — it only prints a comparison table. Pinning a result is a
 * separate, human-reviewed edit to tripo-models.ts.
 *
 *   npx tsx scripts/visual-gen/pof_tripo_smartlowpoly_arena.ts --dry
 *   npx tsx scripts/visual-gen/pof_tripo_smartlowpoly_arena.ts --class weapon
 *   npx tsx scripts/visual-gen/pof_tripo_smartlowpoly_arena.ts
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { runTripo, type TripoSpec } from '../../src/lib/visual-gen/tripo-runner';
import { parseCritiqueMetrics, classifyComponents } from '../../src/lib/visual-gen/mesh-critique';
import { polycountFor } from '../../src/lib/visual-gen/polycount-presets';
import { gradeFaceBudget } from '../../src/lib/visual-gen/face-budget';

// critiqueMesh() requires POF_TRIPOSR_ROOT (a dedicated venv) which is unset on this
// machine; trimesh is importable from the system Python directly, so this arena calls
// pof_mesh_critique.py through it and parses with the same pure parseCritiqueMetrics
// the server uses — same metrics, no invented venv dependency.
const CRITIQUE_PYTHON = process.env.POF_ARENA_PYTHON
  ?? 'C:/Users/kazda/AppData/Local/Programs/Python/Python312/python.exe';

function runCritiqueScript(glbPath: string): Promise<{ stdout: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(CRITIQUE_PYTHON, ['scripts/visual-gen/pof_mesh_critique.py', '--mesh', glbPath], { windowsHide: true });
    let stdout = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stdout += d.toString(); });
    child.on('exit', (code) => resolve({ stdout, code }));
    child.on('error', (e) => resolve({ stdout: `spawn error: ${e.message}`, code: null }));
  });
}
import { TRIPO_AUDITED_MODEL, TRIPO_AUDITED_TEXTURE_QUALITY } from '../../src/lib/visual-gen/tripo-models';
import { makeQwenVision } from '../../src/lib/anim-critique/qwen';
import type { VisionImage } from '../../src/lib/anim-critique/critique';

const OUT_DIR = join(process.cwd(), '.benchmark-tripo');
mkdirSync(OUT_DIR, { recursive: true });

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (k: string) => process.argv.includes(`--${k}`);
const DRY = has('dry');
const ONLY_CLASS = arg('class');
const ONLY_VARIANT = arg('variant'); // 'baseline' | 'smart_low_poly' — skip a variant already paid for on a retry

interface ClassCase {
  assetClass: 'weapon' | 'prop' | 'modular-part';
  referenceImage: string;
  subject: string;
}

const CASES: ClassCase[] = [
  { assetClass: 'weapon', referenceImage: 'generated/icons/items__item-1__hero.jpg', subject: 'an ornate fantasy longsword with a wire-wrapped grip and engraved crossguard' },
  { assetClass: 'prop', referenceImage: 'generated/icons/props__crate__hero.jpg', subject: 'a reinforced wooden shipping crate with metal corner brackets' },
  { assetClass: 'modular-part', referenceImage: '.benchmark-tripo/modular_pauldron.png', subject: 'a leather-and-steel shoulder pauldron armor piece with filigree engraving and a buckle strap' },
];

async function downloadToBase64(url: string): Promise<VisionImage> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') ?? 'image/jpeg';
  return { mime, base64: buf.toString('base64') };
}

function fileToVisionImage(path: string): VisionImage {
  const buf = readFileSync(path);
  const ext = (path.split('.').pop() ?? 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return { mime, base64: buf.toString('base64') };
}

interface Variant {
  label: 'baseline' | 'smart_low_poly';
  spec: Partial<TripoSpec>;
}

function variantsFor(c: ClassCase): Variant[] {
  const preset = polycountFor(c.assetClass);
  if (!preset) throw new Error(`no polycount preset for ${c.assetClass}`);
  const faceLimit = preset.faceLimit; // triangles == faces here (topology stays 'triangles', quad untouched)
  const common: Partial<TripoSpec> = {
    modelVersion: TRIPO_AUDITED_MODEL,
    textureQuality: TRIPO_AUDITED_TEXTURE_QUALITY,
    texture: true,
    pbr: true,
    faceLimit,
  };
  return [
    { label: 'baseline', spec: { ...common, smartLowPoly: false } },
    // smart_low_poly requires face_limit in [1000, 20000] — every current class preset
    // (8k/10k/15k) is inside that band, so no clamping needed; asserted defensively.
    { label: 'smart_low_poly', spec: { ...common, smartLowPoly: true } },
  ];
}

interface RunOutcome {
  assetClass: string;
  variant: string;
  ok: boolean;
  error?: string;
  meshPath?: string;
  renderUrl?: string;
  durationMs?: number;
  faces?: number;
  watertight?: boolean;
  components?: number;
  /** parts vs specks by face-share (classifyComponents), not raw component count. */
  substantialParts?: number;
  floaterFragments?: number;
  budgetVerdict?: string;
  budgetRatio?: number;
  critiqueError?: string;
  qwenScore?: number;
  qwenNotes?: string;
}

async function runOne(c: ClassCase, v: Variant): Promise<RunOutcome> {
  const stamp = Date.now();
  const outputPath = join(OUT_DIR, `${c.assetClass}_${v.label}_${stamp}.glb`).replace(/\\/g, '/');
  const spec: TripoSpec = {
    mode: 'image-to-3d',
    imagePath: c.referenceImage,
    outputPath,
    // smart_low_poly is unbenchmarked, so its generation time is unknown — give it real
    // room rather than the runner's default 300s poll budget. These belong on TripoSpec
    // itself, NOT the runTripo() deps argument (tsx doesn't type-check; a first attempt
    // passed them as deps and they were silently dropped, so both timeouts below were
    // actually testing the untouched 300s default).
    pollIntervalMs: 5000,
    maxPollMs: 600_000,
    ...v.spec,
  } as TripoSpec;

  console.log(`  -> ${c.assetClass}/${v.label}: requesting face_limit=${spec.faceLimit} smart_low_poly=${spec.smartLowPoly ?? false}`);
  const result = await runTripo(spec);
  if (!result.ok || !result.meshPath) {
    return { assetClass: c.assetClass, variant: v.label, ok: false, error: result.error, durationMs: result.durationMs };
  }

  const { stdout, code } = await runCritiqueScript(result.meshPath);
  const parsed = parseCritiqueMetrics(stdout);
  const critiqueError = !parsed.ok || !parsed.metrics ? (parsed.error ?? `critique script exit ${code}: ${stdout.slice(0, 300)}`) : undefined;
  const metrics = parsed.metrics;
  const budgetGrade = metrics ? gradeFaceBudget(metrics.faces, { triangleBudget: spec.faceLimit!, topology: 'triangles' }) : undefined;
  const split = metrics ? classifyComponents(metrics.componentFaces, metrics.componentFacesOmitted) : undefined;

  let qwenScore: number | undefined;
  let qwenNotes: string | undefined;
  if (result.renderUrl) {
    try {
      const vision = makeQwenVision();
      const rendered = await downloadToBase64(result.renderUrl);
      const reference = fileToVisionImage(c.referenceImage);
      const prompt = [
        `You are grading a generated 3D game-asset mesh render against a reference concept image.`,
        `Subject: ${c.subject}.`,
        `Image 1 is the REFERENCE the generator was given. Image 2 is a render of the GENERATED mesh.`,
        `Score the generated mesh 0-10 on: shape fidelity to the reference, and whether the surface reads as clean, artist-plausible topology (not visibly shattered, spiky, or melted) at a glance.`,
        `Reply as exactly: SCORE=<0-10> NOTES=<one sentence>`,
      ].join(' ');
      const reply = await vision([reference, rendered], prompt);
      const m = reply.match(/SCORE\s*=\s*(\d+(?:\.\d+)?)/i);
      qwenScore = m ? Number(m[1]) : undefined;
      const n = reply.match(/NOTES\s*=\s*(.+)/i);
      qwenNotes = n ? n[1].trim().slice(0, 200) : reply.trim().slice(0, 200);
    } catch (e) {
      qwenNotes = `qwen gate error: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    qwenNotes = 'no renderUrl in task output — could not run the aesthetic gate';
  }

  return {
    assetClass: c.assetClass,
    variant: v.label,
    ok: true,
    meshPath: result.meshPath,
    renderUrl: result.renderUrl,
    durationMs: result.durationMs,
    faces: metrics?.faces,
    watertight: metrics?.watertight,
    components: metrics?.components,
    substantialParts: split?.parts,
    floaterFragments: split?.floaters,
    budgetVerdict: budgetGrade?.verdict,
    budgetRatio: budgetGrade?.ratio,
    critiqueError,
    qwenScore,
    qwenNotes,
  };
}

async function main() {
  const cases = ONLY_CLASS ? CASES.filter((c) => c.assetClass === ONLY_CLASS) : CASES;
  if (!cases.length) { console.log(`no case matches --class ${ONLY_CLASS}`); process.exitCode = 1; return; }

  for (const c of cases) {
    if (!existsSync(c.referenceImage)) { console.log(`POF_ARENA_ERROR=reference image missing: ${c.referenceImage}`); process.exitCode = 1; return; }
  }

  const variantsOf = (c: ClassCase) => {
    const vs = variantsFor(c);
    return ONLY_VARIANT ? vs.filter((v) => v.label === ONLY_VARIANT) : vs;
  };

  console.log(`Plan (${cases.length} class(es)):`);
  for (const c of cases) {
    for (const v of variantsOf(c)) {
      console.log(`  ${c.assetClass}/${v.label}: model=${v.spec.modelVersion} face_limit=${v.spec.faceLimit} smart_low_poly=${v.spec.smartLowPoly} texture_quality=${v.spec.textureQuality}`);
    }
  }
  if (DRY) { console.log('POF_ARENA_DRY_DONE'); return; }

  const outcomes: RunOutcome[] = [];
  for (const c of cases) {
    for (const v of variantsOf(c)) {
      // Sequential by design: real paid API calls, one at a time, easy to abort between them.
      const o = await runOne(c, v);
      outcomes.push(o);
      console.log(`POF_ARENA_RESULT=${JSON.stringify(o)}`);
    }
  }

  writeFileSync(join(OUT_DIR, 'arena-results.json'), JSON.stringify(outcomes, null, 2));
  console.log('\n=== Arena summary ===');
  for (const c of cases) {
    console.log(`\n${c.assetClass} (budget ${polycountFor(c.assetClass)!.faceLimit} triangles):`);
    for (const o of outcomes.filter((x) => x.assetClass === c.assetClass)) {
      if (!o.ok) { console.log(`  ${o.variant}: FAILED — ${o.error}`); continue; }
      if (o.critiqueError) { console.log(`  ${o.variant}: mesh delivered but critique FAILED — ${o.critiqueError}`); continue; }
      console.log(
        `  ${o.variant}: faces=${o.faces} (budget ${o.budgetVerdict}, ratio=${o.budgetRatio?.toFixed(2)}) ` +
        `watertight=${o.watertight} parts=${o.substantialParts} floaters=${o.floaterFragments} (raw components=${o.components}) ` +
        `qwen=${o.qwenScore ?? 'n/a'} — ${o.qwenNotes}`,
      );
    }
  }
  console.log('\nPOF_ARENA_DONE');
}

main().catch((e) => { console.error('POF_ARENA_FATAL', e); process.exitCode = 1; });
