/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Concept 2D Art for an ingested entity (/diablo W03) — in-process, no dev server.
 *
 *   npx tsx --env-file=.env scripts/diablo/media.ts --catalog bestiary --id d1-MT_NZOMBIE [--candidates 2] [--run r2] [--submit b0-c1]
 *
 * SUBJECT comes from the entity's own upstream `Concept & Role` artifact (its `anatomy:` line) —
 * never from canon prose (W02d: canon subject words contaminated the figure) and never hand-written
 * here. No Concept & Role anatomy ⇒ refusal naming the missing dependency.
 * STYLE comes from the entity's canon profile (`styleDnaForProfile`): PoF's own entities get the
 * active Style DNA, a diablo1 entity only diablo1's — never the other's.
 *
 * Each candidate is saved under generated/icons/ (entity-scoped `iconFileName`, the name the step's
 * gallery matches on) and measured: the share of pixels below middle gray (the d1-palette review
 * target is "more than half"). Without --submit nothing is written to the pipeline; with it, the
 * chosen candidate is submitted through the SERVER grader (`submitStepArtifact`).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import '../../src/lib/catalog/pipelines/registry.generated';
import { seededEntities } from '../../src/lib/catalog/seed';
import { labIdentityOf } from '../../src/lib/catalog/canon/profiles';
import { listArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { submitStepArtifact } from '../../src/lib/catalog/headless';
import { styleDnaForProfile } from '../../src/lib/visual-gen/style-dna-db';
import { subjectClassOf } from '../../src/lib/catalog/canon/subjectClass';
import { applyStyleFragment, styleDnaToPromptFragment, type StyleDna } from '../../src/lib/visual-gen/style-dna';
import { generateImage, MAX_PROMPT_LENGTH } from '../../src/lib/leonardo';
import { getDb } from '../../src/lib/db';
import { checkFamily } from '../../src/lib/visual-gen/family-check';
import { upsertVerdict } from '../../src/lib/status/judge-verdicts-db';
import { stepContentHash } from '../../src/lib/judge/contentHash';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs helper shared with the gap-loop scripts (the one naming rule).
import { iconFileName } from '../gap-loop/power-icon-payload.mjs';

const REPO = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const ICONS = join(REPO, 'generated', 'icons');
const RUNS = process.env.POF_DIABLO_MEDIA ?? 'C:/Users/kazda/Documents/Obsidian/pof/Diablo/Media';
const STEP = 'Concept 2D Art';

const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog') ?? 'bestiary';
const entityId = opt('id');
const candidates = Math.max(1, Math.min(4, Number(opt('candidates') ?? 2)));
const submitId = opt('submit');
if (!entityId) { console.error('usage: media.ts --catalog <id> --id <entityId> [--candidates N] [--submit <candidateId>]'); process.exit(2); }

const stored = seededEntities(catalogId).find((e) => e.id === entityId);
if (!stored) { console.error(`REFUSED: ${catalogId}/${entityId} is not a seeded/promoted entity`); process.exit(1); }
const entity = { id: stored.id, name: stored.name, data: stored.data, ...labIdentityOf(stored) };
const runDir = join(RUNS, entityId);
mkdirSync(runDir, { recursive: true });
mkdirSync(ICONS, { recursive: true });
const manifestPath = join(runDir, 'concept-2d.json');
const RUN = opt('run') ?? new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
// The family the figure must read as, and the blind alternatives (D15). Supplied by the operator from the
// data (Diablo groups monsters by shared art set) — reference values never enter the repo.
const FAMILY = opt('family');
const FAMILIES = (opt('families') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

interface Candidate {
  id: string; file: string; prompt: string; style: string | null;
  darkShare: { figure: number; darkOfFigure: number };
  family?: { expected: string; seen: string | null; pass: boolean | null; note: string };
}

/**
 * The subject: this entity's own Concept & Role `visualBrief` (the figure only, written for an image
 * model — the step's criteria ask for it since W04), else the legacy `anatomy:` line of its brief.
 */
function subjectOf(): string {
  const role = listArtifacts(catalogId, entityId!).find((a) => a.step === 'Concept & Role');
  const visual = typeof role?.data.visualBrief === 'string' ? role.data.visualBrief.trim() : '';
  if (visual) return visual;
  const brief = typeof role?.data.brief === 'string' ? role.data.brief : '';
  const m = /anatomy:\s*(.+)/.exec(brief);
  if (!m) {
    console.error(`REFUSED: ${entityId} has no Concept & Role visualBrief (or anatomy line) — Concept 2D Art depends on it (produce Concept & Role first)`);
    process.exit(1);
  }
  return m[1].trim();
}

/**
 * Share of the FIGURE's pixels below middle gray (luma < 128) — the d1-palette value target.
 * Measured on the figure only: over a whole frame the plain dark ground dominates and every image
 * scores ~0.99 (W03 run 1 — an instrument that cannot fail). The figure mask is every pixel whose
 * luma differs from the border-sampled ground by more than 12.
 */
async function darkShare(buf: Buffer): Promise<{ figure: number; darkOfFigure: number }> {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(data[x], data[(h - 1) * w + x]);
  for (let y = 0; y < h; y++) border.push(data[y * w], data[y * w + w - 1]);
  border.sort((a, b) => a - b);
  const ground = border[border.length >> 1];
  let fig = 0;
  let dark = 0;
  for (const v of data) {
    if (Math.abs(v - ground) <= 12) continue;
    fig++;
    if (v < 128) dark++;
  }
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { figure: r(fig / data.length), darkOfFigure: fig ? r(dark / fig) : 0 };
}

async function generate(): Promise<void> {
  // --subject: an ABLATION override (does the subject's wording cause the failure?), never a production run.
  const subject = opt('subject') ?? subjectOf();
  // Framing: NOT "concept art" and no "no text …" sentence — run 1 showed both invite an ArtStation
  // presentation-sheet footer with invented branding (Lucid Origin has no negative prompt).
  const base = `A single standing figure, full body, uncropped: ${entity.name}. ${subject} Isolated on a plain dark ground.`;
  // --no-style: an ABLATION (is a failure the subject's or the style's?), never a production run.
  const style = process.argv.includes('--no-style') ? null : styleDnaForProfile(getDb(), entity.canonProfile, subjectClassOf(catalogId));
  // --drop materials,motifs: ablate DNA lists (which list moves the subject?), never a production run.
  const drop = (opt('drop') ?? '').split(',').filter(Boolean) as (keyof StyleDna)[];
  const dna = style ? { ...style.dna, ...Object.fromEntries(drop.map((k) => [k, []])) } : null;
  const prompt = dna ? applyStyleFragment(base, styleDnaToPromptFragment(dna), MAX_PROMPT_LENGTH) : base;
  console.log(`subject (Concept & Role anatomy): ${subject}`);
  console.log(`style: ${style ? `${style.name} (${style.id})` : 'NONE — no style for this canon profile'}`);
  console.log(`prompt (${prompt.length} chars): ${prompt}`);
  const out: Candidate[] = [];
  for (let i = 0; i < candidates; i++) {
    const r = await generateImage(prompt, { width: 768, height: 768 });
    if (!r.imageBase64) throw new Error('generation returned no bytes (download-then-delete did not run)');
    const buf = Buffer.from(r.imageBase64, 'base64');
    const file = join(runDir, `${RUN}-c${i}.jpg`);
    writeFileSync(file, buf);
    const c: Candidate = { id: `b0-c${i}`, file, prompt, style: style?.name ?? null, darkShare: await darkShare(buf) };
    if (FAMILY) {
      const v = await checkFamily({ base64: buf.toString('base64'), mime: 'image/jpeg' }, FAMILY, FAMILIES.length ? FAMILIES : [FAMILY]);
      c.family = v.ok
        ? { expected: v.expected, seen: v.seen.family, pass: v.pass, note: v.reason }
        : { expected: v.expected, seen: null, pass: null, note: `family check did not run: ${v.error}` };
    }
    out.push(c);
    const fam = c.family ? `  family: ${c.family.pass === null ? 'UNCHECKED' : c.family.pass ? 'PASS' : 'FAIL'} (${c.family.note.slice(0, 90)})` : '';
    console.log(`candidate ${c.id} → ${file}  figure=${c.darkShare.figure} of frame, below-mid-gray share of figure=${c.darkShare.darkOfFigure}${fam}`);
  }
  writeFileSync(manifestPath, JSON.stringify({ entityId, catalogId, step: STEP, canonProfile: entity.canonProfile, candidates: out }, null, 2));
  console.log(`manifest → ${manifestPath}. Review, then re-run with --submit <candidateId>.`);
}

function submit(id: string): void {
  if (!existsSync(manifestPath)) { console.error('REFUSED: no manifest — generate first'); process.exit(1); }
  const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as { candidates: Candidate[] };
  const chosen = m.candidates.find((c) => c.id === id);
  if (!chosen) { console.error(`REFUSED: no candidate ${id}`); process.exit(1); }
  const bytes = readFileSync(chosen.file);
  const icon = join(ICONS, iconFileName(catalogId, STEP, 'jpg', entityId));
  writeFileSync(icon, bytes);
  const dataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  const data = {
    selected: 0,
    selectedId: chosen.id,
    genHistory: {
      batches: [{
        id: 'b0', createdAt: new Date().toISOString(),
        direction: `Lucid Origin; subject from Concept & Role anatomy; style ${chosen.style ?? 'none'} (canon ${entity.canonProfile})`,
        prompt: chosen.prompt,
        candidates: m.candidates.map((c) => ({
          id: c.id,
          swatch: c.id === chosen.id ? `url(${dataUrl})` : 'linear-gradient(#222,#111)',
          payload: { provider: 'leonardo-lucid-origin', assetPath: c.id === chosen.id ? icon : c.file, darkShare: c.darkShare, styleDna: c.style },
        })),
      }],
      selectedId: chosen.id,
    },
  };
  const r = submitStepArtifact(catalogId, entityId!, STEP, data, [`/Game/Bestiary/${entity.name.replace(/[^a-z0-9]+/gi, '')}/T_${entity.name.replace(/[^a-z0-9]+/gi, '')}_Concept`]);
  console.log(`SUBMITTED ${chosen.id} → icon ${icon}; server verdict ${r.acceptance?.status ?? r.artifact.status} ${r.acceptance?.reason ?? ''}`);
  // The checker grades only the SELECTION; the family check is the instrument that judged the image.
  // Recorded as a vision verdict bound to the content on record, so /status shows what actually looked.
  if (chosen.family && chosen.family.pass !== null) {
    upsertVerdict({
      catalogId, entityId: entityId!, step: STEP, judge: 'vlm',
      verdict: chosen.family.pass ? 'pass' : 'fail',
      score: chosen.family.pass ? 100 : 0,
      findings: `Blind creature-family check: ${chosen.family.note}`,
      model: 'routed-vision/family-check',
      contentHash: stepContentHash(r.artifact.data),
    });
    console.log(`VERDICT vlm ${chosen.family.pass ? 'pass' : 'fail'} recorded (family check)`);
  } else {
    console.log('VERDICT none — no family check ran for this candidate (nothing measured, nothing recorded)');
  }
}

if (submitId) submit(submitId);
else generate().catch((e) => { console.error('FATAL', e); process.exit(1); });
