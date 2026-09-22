/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * 3D & Rig for an ingested entity (/diablo W04) — gate a rigged .glb and submit it, in-process.
 *
 *   npx tsx scripts/diablo/rig.ts --catalog bestiary --id d1-MT_NZOMBIE \
 *     --glb generated/tripo3d/d1_mt_nzombie_rigged.glb --morphology biped [--provider tripo3d] [--budget 40000]
 *
 * The .glb is produced upstream (e.g. scripts/visual-gen/pof_tripo.mjs from the entity's accepted
 * Concept 2D Art, then pof_tripo_animate.mjs). This script only JUDGES and records: the Tier-1 rig
 * gate (`gateRig`, with the morphology the entity needs) runs on the file, its verdict rides on the
 * candidate payload (`rigCandidatePayload`), and the SERVER grades the step (`riggedMeshSelected`).
 * An unreadable file is a refusal, never a pass.
 */
import { basename, resolve } from 'node:path';
import '../../src/lib/catalog/pipelines/registry.generated';
import { gateRig } from '../../src/lib/visual-gen/rig-gate';
import type { Morphology } from '../../src/lib/visual-gen/skeleton-profiles';
import { rigCandidatePayload } from '../../src/lib/catalog/acceptance/rigArtifact';
import { assetUrl } from '../../src/lib/visual-gen/generated-assets';
import { submitStepArtifact } from '../../src/lib/catalog/headless';
import { declaredGlbTriangles } from '../../src/lib/visual-gen/mesh-fetch';
import { gradeFaceBudget } from '../../src/lib/visual-gen/face-budget';
import { readFileSync } from 'node:fs';
import { diabloUeRoot } from './ueRoot';
import { seededEntities } from '../../src/lib/catalog/seed';

const STEP = '3D & Rig';

const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog') ?? 'bestiary';
const entityId = opt('id');
const glb = opt('glb');
const morphology = (opt('morphology') ?? 'biped') as Morphology;
const provider = opt('provider') ?? 'tripo3d';
// The triangle budget the mesh was COMMISSIONED at (asset-class-poly-budgeting): graded delivered-vs-requested.
const budget = opt('budget') ? Number(opt('budget')) : undefined;
if (!entityId || !glb) { console.error('usage: rig.ts --catalog <id> --id <entityId> --glb <file> [--morphology biped] [--provider tripo3d]'); process.exit(2); }

// Declared UE paths live at the entity's real content root (ueRoot.ts) — never a guessed one.
const stored = seededEntities(catalogId).find((e) => e.id === entityId);
const { root: ueRoot, slug: ueSlug } = diabloUeRoot(stored?.name ?? entityId);

const g = gateRig(resolve(glb), { morphology });
if (!g.ok || !g.facts || !g.verdict) { console.error(`REFUSED: ${g.error ?? 'the rig gate returned no verdict'}`); process.exit(1); }
const { facts, verdict } = g;
console.log(`rig gate: ${verdict.pass ? 'PASS' : 'FAIL'} score=${verdict.score} joints=${facts.jointCount} (referenced ${facts.referencedJoints}) vertices=${facts.vertexCount} zero-weight=${facts.zeroWeightVertices}`);
for (const f of verdict.failures) console.log(`  failure: ${f}`);
for (const w of verdict.warnings) console.log(`  warning: ${w}`);

// Measured independently of whatever produced the file: triangles declared by the glb's own index buffers.
const measured = declaredGlbTriangles(readFileSync(resolve(glb))) ?? undefined;
const faceBudget = gradeFaceBudget(measured, budget ? { triangleBudget: budget, topology: 'triangles' } : undefined);
console.log(`face budget: ${faceBudget.verdict} — measured ${measured ?? '?'} triangles vs requested ${budget ?? 'none'}${faceBudget.reason ? ` (${faceBudget.reason})` : ''}`);

const name = basename(glb);
const data = {
  mesh: 0,
  selectedId: 'b0-c0',
  genHistory: {
    batches: [{
      id: 'b0', createdAt: new Date().toISOString(),
      direction: `image-to-3D from the accepted Concept 2D Art; rig ${provider}; gated as ${morphology}`,
      prompt: `${provider} image_to_model + animate_rig (${morphology})`,
      candidates: [{
        id: 'b0-c0', swatch: 'linear-gradient(#333,#111)',
        payload: { mesh: 0, glbUrl: assetUrl(name, provider), provider, faceBudget, ...rigCandidatePayload({ rig: verdict, facts }) },
      }],
    }],
    selectedId: 'b0-c0',
  },
};
const r = submitStepArtifact(catalogId, entityId, STEP, data, [`${ueRoot}/SK_${ueSlug}`]);
console.log(`SUBMITTED ${STEP} → server verdict ${r.acceptance.status} (${r.acceptance.tier}) ${r.acceptance.reason ?? r.acceptance.detail ?? ''}`);
