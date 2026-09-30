/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Re-grade stored step artifacts after a checker change (/diablo W16), through the SAME door a produce uses
 * (`submitStepArtifact`), and print every verdict that moved — the measurement a checker adjustment needs.
 *
 *   npx tsx scripts/diablo/regrade.ts --catalog dialog-trees [--ids a,b] [--steps "A,B"] [--dry]
 *
 * Only `source: ingest` entities are re-graded unless `--all`. The artifact's data is re-submitted unchanged, so
 * `upsertArtifact` archives no revision (content did not change) — only the verdict can move.
 */
import '../../src/lib/catalog/pipelines/registry.generated';
import { listAllArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { listEntities } from '../../src/lib/catalog-db';
import { submitStepArtifact } from '../../src/lib/catalog/headless';

const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog');
if (!catalogId) { console.error('usage: regrade.ts --catalog <id> [--ids a,b] [--steps "A,B"] [--all]'); process.exit(2); }
const ids = opt('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
const steps = opt('steps')?.split(',').map((s) => s.trim()).filter(Boolean);
const ingested = new Set(listEntities(catalogId).filter((e) => process.argv.includes('--all') || e.source === 'ingest').map((e) => e.entityId));

const moved: Record<string, number> = {};
let same = 0;
for (const a of listAllArtifacts({ catalogId })) {
  if (!ingested.has(a.entityId) || (ids && !ids.includes(a.entityId)) || (steps && !steps.includes(a.step))) continue;
  const before = a.status;
  const r = submitStepArtifact(catalogId, a.entityId, a.step, a.data as Record<string, unknown>, a.ueAssets ?? []);
  const after = r.acceptance.status;
  if (before === after) { same++; continue; }
  const k = `${a.step}: ${before} → ${after}`;
  moved[k] = (moved[k] ?? 0) + 1;
  console.log(`${a.entityId} · ${k}${r.acceptance.reason ? ` — ${r.acceptance.reason.slice(0, 160)}` : ''}`);
}
console.log(`\nunchanged ${same}; moved ${JSON.stringify(moved)}`);
