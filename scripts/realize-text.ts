/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Realize the text-hardening wins on /status: apply each `.claude/quality-hardening/text-*.json`
 * deliverable's `bestContent` to its stored artifact (server re-grades with the shape checker),
 * so a subsequent rejudge records the ≥90 verdict and the cell turns verified-green.
 *
 *   npx tsx scripts/realize-text.ts        # apply all text-* deliverables
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ORIGIN = process.env.POF_JUDGE_ORIGIN ?? 'http://localhost:3007';
const DIR = '.claude/quality-hardening';

async function main() {
  const files = readdirSync(DIR).filter((f) => f.startsWith('text-') && f.endsWith('.json'));
  for (const f of files) {
    const d = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { subject: string; bestContent?: Record<string, unknown>; bestScore?: number };
    if (!d.bestContent) { console.log(`  SKIP ${f} — no bestContent`); continue; }
    const [catalogId, rest] = d.subject.split('::').map((s) => s.trim());
    const step = rest.split('(')[0].trim();

    // Find the artifact for this step; prefer an entity named in the subject, else first sorted.
    const arts = ((await (await fetch(`${ORIGIN}/api/pipeline-artifacts?catalogId=${catalogId}`)).json()).data ?? []) as { entityId: string; step: string }[];
    const forStep = arts.filter((a) => a.step === step).sort((a, b) => a.entityId.localeCompare(b.entityId));
    const named = forStep.find((a) => d.subject.includes(a.entityId));
    const entityId = (named ?? forStep[0])?.entityId;
    if (!entityId) { console.log(`  MISS ${catalogId}::${step} — no artifact`); continue; }

    const r = await fetch(`${ORIGIN}/api/pipeline-artifacts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ catalogId, entityId, step, data: d.bestContent, status: 'pass' }),
    });
    const j = await r.json();
    const graded = j.data?.status ?? (j.success === false ? `ERR ${JSON.stringify(j.error).slice(0, 80)}` : '?');
    console.log(`  ${catalogId}::${step} [${entityId}] applied → checker=${graded} (target rejudge ${d.bestScore})`);
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
