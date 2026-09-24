/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * FAMILY ART SETS (/diablo W06): a monster that SHARES its family's model, recoloured.
 *
 *   npx tsx scripts/diablo/family.ts --catalog bestiary --id d1-MT_BZOMBIE --source d1-MT_NZOMBIE \
 *     --tint 0.72,0.80,0.98 --sprites "<dir with dir0..7.png>"
 *
 * Diablo builds art per FAMILY: monstdat's asset set is shared by Zombie, Ghoul and Rotting Carcass,
 * and each member is a palette swap (trnFile). PoF's pipeline produces art per ENTITY, so a family of
 * three cost three generations and drifted apart. This records the real relationship instead:
 *   3D & Rig      — the SOURCE entity's rigged mesh, with `sharedWith` + the member's tint on the
 *                   candidate payload (the rig gate grades the same real mesh, because it IS the mesh);
 *   Sprite Render — the member's own tinted render of that shared mesh.
 * Both go through the server grader; nothing here decides a verdict.
 */
import { readdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { join } from 'node:path';
import '../../src/lib/catalog/pipelines/registry.generated';
import { listArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { submitStepArtifact } from '../../src/lib/catalog/headless';
import { seededEntities } from '../../src/lib/catalog/seed';
import { SPRITE_DIRECTIONS, SPRITE_PROJECTION } from '../../src/lib/catalog/acceptance/spriteCheckers';
import { familyHeadOf } from '../../src/lib/catalog/reference/familyHead';
import { checkFamily } from '../../src/lib/visual-gen/family-check';
import { upsertVerdict } from '../../src/lib/status/judge-verdicts-db';
import { stepContentHash } from '../../src/lib/judge/contentHash';

const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog') ?? 'bestiary';
const entityId = opt('id');
const tint = (opt('tint') ?? '').split(',').map(Number).filter((n) => Number.isFinite(n));
const spritesDir = opt('sprites');
// The member's recolour is judged like the head's render (render.ts): does it still read as its creature
// at sprite scale? W07: every darkened Burning Dead tint read as a zombie while the step graded pass unseen.
const FAMILY = opt('family');
const FAMILIES = (opt('families') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
if (!entityId) { console.error('usage: family.ts --catalog <id> --id <member> [--source <family head>] [--tint r,g,b] [--sprites <dir>]'); process.exit(2); }
const member = seededEntities(catalogId).find((e) => e.id === entityId);
if (!member) { console.error(`REFUSED: ${entityId} is not seeded/promoted`); process.exit(1); }
// The head is DERIVED from the art set (W07: monstdat assetsSuffix → data.artSet) — the member of the same
// set that owns its rigged mesh. --source stays as an explicit override.
const ownsRig = (id: string) => {
  const h = listArtifacts(catalogId, id).find((a) => a.step === '3D & Rig')?.data.genHistory as { selectedId?: string; batches?: { candidates?: { id: string; payload?: Record<string, unknown> }[] }[] } | undefined;
  const c = h?.batches?.flatMap((b) => b.candidates ?? []).find((x) => x.id === h.selectedId);
  return c?.payload?.glbUrl ? { owned: !c.payload.sharedWith } : null;
};
const derived = opt('source') ? null : familyHeadOf(member, seededEntities(catalogId), ownsRig);
if (derived && !derived.ok) { console.error(`REFUSED: ${derived.reason}`); process.exit(1); }
const sourceId = opt('source') ?? (derived as { headId: string }).headId;
if (derived?.ok) console.log(`family head (derived from art set "${derived.artSet}"): ${sourceId}`);
const head = seededEntities(catalogId).find((e) => e.id === sourceId);
if (!member || !head) { console.error('REFUSED: member or source entity is not seeded/promoted'); process.exit(1); }

// The family's rigged mesh: the SOURCE entity's own selected 3D & Rig candidate.
const srcRig = listArtifacts(catalogId, sourceId).find((a) => a.step === '3D & Rig');
const srcHist = srcRig?.data.genHistory as { selectedId?: string; batches?: { candidates?: { id: string; payload?: Record<string, unknown> }[] }[] } | undefined;
const srcCand = srcHist?.batches?.flatMap((b) => b.candidates ?? []).find((c) => c.id === srcHist.selectedId);
if (!srcCand?.payload?.glbUrl) { console.error(`REFUSED: ${sourceId} has no selected 3D & Rig mesh to share`); process.exit(1); }

const rig = submitStepArtifact(catalogId, entityId, '3D & Rig', {
  mesh: 0,
  selectedId: 'fam-0',
  genHistory: {
    batches: [{
      id: 'fam', createdAt: new Date().toISOString(),
      direction: `family art set: shares ${head.name}'s rigged mesh, recoloured${tint.length === 3 ? ` (tint ${tint.join(', ')})` : ''}`,
      prompt: `shared with ${sourceId} — Diablo builds art per family, not per monster`,
      candidates: [{ id: 'fam-0', swatch: 'linear-gradient(#333,#111)', payload: { ...srcCand.payload, mesh: 0, sharedWith: sourceId, ...(tint.length === 3 ? { tint } : {}) } }],
    }],
    selectedId: 'fam-0',
  },
}, srcRig?.ueAssets ?? []);
console.log(`3D & Rig (shared with ${sourceId}): ${rig.acceptance.status} — ${rig.acceptance.detail ?? ''}`);

if (spritesDir) {
  const files = readdirSync(spritesDir).filter((f) => /^dir\d\.png$/.test(f)).sort();
  if (files.length !== SPRITE_DIRECTIONS) console.log(`WARNING: ${files.length} direction frames in ${spritesDir}, the step needs ${SPRITE_DIRECTIONS}`);
  const sprite = submitStepArtifact(catalogId, entityId, 'Sprite Render', {
    sprites: {
      directions: files.map((f) => join(spritesDir, f).replace(/\\/g, '/')),
      camera: { ...SPRITE_PROJECTION },
      frameSize: 96,
      requestedPose: 'family recolour of the shared mesh',
      sharedWith: sourceId,
      ...(tint.length === 3 ? { tint } : {}),
    },
  }, []);
  console.log(`Sprite Render (tinted): ${sprite.acceptance.status} — ${sprite.acceptance.detail ?? sprite.acceptance.reason ?? ''}`);
  if (FAMILY && files.length) {
    void (async () => {
      const view = await sharp(readFileSync(join(spritesDir, files[0]))).resize(384, 384, { kernel: 'nearest' })
        .flatten({ background: { r: 14, g: 12, b: 12 } }).jpeg().toBuffer();
      const v = await checkFamily({ base64: view.toString('base64'), mime: 'image/jpeg' }, FAMILY, FAMILIES.length ? FAMILIES : [FAMILY]);
      if (!v.ok) { console.log(`family at sprite scale: UNCHECKED — ${v.error}`); return; }
      console.log(`family at sprite scale: ${v.pass ? 'PASS' : 'FAIL'} — ${v.reason}`);
      upsertVerdict({
        catalogId, entityId, step: 'Sprite Render', judge: 'vlm', verdict: v.pass ? 'pass' : 'fail', score: v.pass ? 100 : 0,
        findings: `Blind creature-family check of the RECOLOURED member at sprite scale (96px, 4x nearest): ${v.reason}`,
        model: 'routed-vision/family-check', contentHash: stepContentHash(sprite.artifact.data),
      });
      console.log(`VERDICT vlm ${v.pass ? 'pass' : 'fail'} recorded`);
    })().catch((e) => { console.error('FATAL', e); process.exit(1); });
  }
}
