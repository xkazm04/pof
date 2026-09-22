/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Sprite Render for an ingested entity (/diablo W05, D16 + D18) — in-process + Blender headless.
 *
 *   npx tsx --env-file=.env scripts/diablo/render.ts --catalog bestiary --id d1-MT_NZOMBIE \
 *     --family zombie --families zombie,skeleton,goat-demon,demon,beast [--frame 1] [--size 96]
 *
 * Reads the rigged mesh from the entity's OWN `3D & Rig` artifact (the selected candidate's glbUrl),
 * renders it with scripts/diablo/sprite_render.py (fixed orthographic 30°/45° camera, 8 directions,
 * box-downsampled), then judges the result at SPRITE scale with the blind family check — does it
 * still read as its creature at the size the player sees? — and submits `Sprite Render` through the
 * server grader, recording the family verdict (vlm, content-bound). The pose/frame size requested on
 * the step's own artifact (its direction) wins over the flags.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import '../../src/lib/catalog/pipelines/registry.generated';
import { listArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { submitStepArtifact } from '../../src/lib/catalog/headless';
import { SPRITE_DIRECTIONS, SPRITE_PROJECTION } from '../../src/lib/catalog/acceptance/spriteCheckers';
import { checkFamily } from '../../src/lib/visual-gen/family-check';
import { upsertVerdict } from '../../src/lib/status/judge-verdicts-db';
import { stepContentHash } from '../../src/lib/judge/contentHash';

const STEP = 'Sprite Render';
const BLENDER = process.env.POF_BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe';
const RUNS = process.env.POF_DIABLO_MEDIA ?? 'C:/Users/kazda/Documents/Obsidian/pof/Diablo/Media';
const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog') ?? 'bestiary';
const entityId = opt('id');
const FAMILY = opt('family');
const FAMILIES = (opt('families') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!entityId) { console.error('usage: render.ts --catalog <id> --id <entityId> [--family f --families a,b] [--frame N] [--size N]'); process.exit(2); }

const arts = listArtifacts(catalogId, entityId);
const rig = arts.find((a) => a.step === '3D & Rig');
const hist = rig?.data.genHistory as { selectedId?: string; batches?: { candidates?: { id: string; payload?: Record<string, unknown> }[] }[] } | undefined;
const cand = hist?.batches?.flatMap((b) => b.candidates ?? []).find((c) => c.id === hist.selectedId);
const glbUrl = typeof cand?.payload?.glbUrl === 'string' ? cand.payload.glbUrl : '';
const m = /\/api\/visual-gen\/asset\/([^?]+)(?:\?dir=([\w-]+))?/.exec(glbUrl);
if (!m) { console.error(`REFUSED: ${entityId} has no selected 3D & Rig mesh — Sprite Render depends on it`); process.exit(1); }
const glb = resolve('generated', m[2] ?? 'triposr', decodeURIComponent(m[1]));
if (!existsSync(glb)) { console.error(`REFUSED: the 3D & Rig mesh ${glb} is not on disk`); process.exit(1); }

// The step's own artifact carries the render REQUEST (its direction): frame size + pose.
const req = (arts.find((a) => a.step === STEP)?.data.sprites ?? {}) as { frameSize?: number; requestedPose?: string };
const size = Number(opt('size') ?? req.frameSize ?? 96);
const frame = Number(opt('frame') ?? (/frame\s*(\d+)/i.exec(req.requestedPose ?? '')?.[1] ?? 1));
const out = join(RUNS, entityId, `sprite-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`);
mkdirSync(out, { recursive: true });

console.log(`rendering ${glb} → ${out} (frame ${frame}, ${size}px)`);
const log = execFileSync(BLENDER, ['-b', '-P', resolve('scripts/diablo/sprite_render.py'), '--', glb, out,
  '--size', String(size), '--frame', String(frame), '--render', String(size * 4)], { encoding: 'utf8', maxBuffer: 1 << 26, timeout: 600000 });
const done = /POF_SPRITE_DONE=.*/.exec(log)?.[0];
if (!done) { console.error(`REFUSED: the render reported no POF_SPRITE_DONE marker\n${log.slice(-800)}`); process.exit(1); }
console.log(done);

(async () => {
  const dirs = Array.from({ length: SPRITE_DIRECTIONS }, (_, d) => join(out, `dir${d}.png`));
  // One native-resolution strip (the artifact carries it inline — ~8 small frames).
  const strip = await sharp({ create: { width: size * SPRITE_DIRECTIONS, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(dirs.map((f, d) => ({ input: f, left: d * size, top: 0 }))).png().toBuffer();

  // Judge at SPRITE scale: the front-facing frame, enlarged 4x nearest-neighbour on a dark ground.
  let family: { pass: boolean | null; note: string } = { pass: null, note: 'no --family given — nothing measured' };
  if (FAMILY) {
    const view = await sharp(readFileSync(dirs[0])).resize(size * 4, size * 4, { kernel: 'nearest' })
      .flatten({ background: { r: 14, g: 12, b: 12 } }).jpeg().toBuffer();
    const v = await checkFamily({ base64: view.toString('base64'), mime: 'image/jpeg' }, FAMILY, FAMILIES.length ? FAMILIES : [FAMILY]);
    family = v.ok ? { pass: v.pass, note: v.reason } : { pass: null, note: `family check did not run: ${v.error}` };
    console.log(`family at sprite scale: ${family.pass === null ? 'UNCHECKED' : family.pass ? 'PASS' : 'FAIL'} — ${family.note}`);
  }

  const data = {
    sprites: {
      directions: dirs.map((f) => f.replace(/\\/g, '/')),
      camera: { ...SPRITE_PROJECTION },
      frameSize: size,
      requestedPose: req.requestedPose ?? `frame ${frame}`,
      frame,
      source: glbUrl,
      sheet: `data:image/png;base64,${strip.toString('base64')}`,
    },
  };
  const r = submitStepArtifact(catalogId, entityId, STEP, data, []);
  console.log(`SUBMITTED ${STEP} → server verdict ${r.acceptance.status} (${r.acceptance.tier}) ${r.acceptance.reason ?? r.acceptance.detail ?? ''}`);
  if (family.pass !== null) {
    upsertVerdict({
      catalogId, entityId, step: STEP, judge: 'vlm', verdict: family.pass ? 'pass' : 'fail', score: family.pass ? 100 : 0,
      findings: `Blind creature-family check at sprite scale (${size}px, 4x nearest): ${family.note}`,
      model: 'routed-vision/family-check', contentHash: stepContentHash(r.artifact.data),
    });
    console.log(`VERDICT vlm ${family.pass ? 'pass' : 'fail'} recorded`);
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
