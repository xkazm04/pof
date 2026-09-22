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
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import '../../src/lib/catalog/pipelines/registry.generated';
import { listArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { submitStepArtifact } from '../../src/lib/catalog/headless';
import { seededEntities } from '../../src/lib/catalog/seed';
import { SPRITE_DIRECTIONS, SPRITE_PROJECTION } from '../../src/lib/catalog/acceptance/spriteCheckers';

const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog') ?? 'bestiary';
const entityId = opt('id');
const sourceId = opt('source');
const tint = (opt('tint') ?? '').split(',').map(Number).filter((n) => Number.isFinite(n));
const spritesDir = opt('sprites');
if (!entityId || !sourceId) { console.error('usage: family.ts --catalog <id> --id <member> --source <family head> [--tint r,g,b] [--sprites <dir>]'); process.exit(2); }
const member = seededEntities(catalogId).find((e) => e.id === entityId);
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
}
