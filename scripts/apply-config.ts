/* eslint-disable no-console -- CLI helper; stdout is its interface. */
/**
 * Apply an authored text config to a stored artifact (text-hardening rollout). Reads a JSON file
 * of the improved config and POSTs it to /api/pipeline-artifacts (server re-grades with the shape
 * checker). Use after authoring content with the banked TEXT_TECHNIQUE; a later batch rejudge
 * records the verdict.
 *
 *   npx tsx scripts/apply-config.ts --catalog items --entity item-1 --step "Concept Brief" --file cb.json
 */
import { readFileSync } from 'node:fs';

const ORIGIN = process.env.POF_JUDGE_ORIGIN ?? 'http://localhost:3007';
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const catalogId = arg('catalog'); const entityId = arg('entity'); const step = arg('step'); const file = arg('file');
  if (!catalogId || !entityId || !step || !file) { console.error('need --catalog --entity --step --file'); process.exit(2); }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const r = await fetch(`${ORIGIN}/api/pipeline-artifacts`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogId, entityId, step, data, status: 'pass' }),
  });
  const j = await r.json();
  console.log(j.success === false ? `ERR ${JSON.stringify(j.error).slice(0, 120)}` : `applied ${catalogId}::${step} [${entityId}] checker=${j.data?.status ?? '?'}`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
