/* eslint-disable no-console -- CLI helper; stdout is its interface. */
/**
 * Dump a catalog's stored step configs for the text-hardening loop. With --step, prints that
 * step's config JSON (to judge/diagnose). Without --step, prints ALL steps' configs keyed by
 * step (sibling context — author consistent content, don't contradict siblings). Media-heavy
 * fields (genHistory/audioAssets/_provenance) are stripped.
 *
 *   npx tsx scripts/get-config.ts --catalog items --step "Concept Brief" [--entity item-1] [--out f.json]
 *   npx tsx scripts/get-config.ts --catalog items                         # all siblings
 */
import { writeFileSync } from 'node:fs';

const ORIGIN = process.env.POF_JUDGE_ORIGIN ?? 'http://localhost:3007';
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };

function clean(d: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) { if (k === 'genHistory' || k === 'audioAssets' || k === '_provenance') continue; o[k] = v; }
  return o;
}

async function main() {
  const catalog = arg('catalog'); const step = arg('step'); const entity = arg('entity'); const out = arg('out');
  if (!catalog) { console.error('need --catalog'); process.exit(2); }
  const j = await (await fetch(`${ORIGIN}/api/pipeline-artifacts?catalogId=${catalog}`)).json();
  const arts = (j.data?.artifacts ?? j.data ?? []) as { step: string; entityId: string; data: Record<string, unknown> }[];
  const scoped = entity ? arts.filter((a) => a.entityId === entity) : arts;

  let result: unknown;
  if (step) {
    const a = scoped.find((x) => x.step === step);
    result = a ? clean(a.data) : { error: `no artifact for ${catalog}::${step}` };
  } else {
    result = Object.fromEntries(scoped.map((a) => [a.step, clean(a.data)]));
  }
  const text = JSON.stringify(result, null, 2);
  if (out) { writeFileSync(out, text); console.log(`wrote ${out} (${text.length} chars)`); }
  else console.log(text);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
