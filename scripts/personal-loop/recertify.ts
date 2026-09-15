/**
 * /personal-loop recertify — one cell's R rung + A level, read exactly as /status reads it.
 *
 *   npx tsx scripts/personal-loop/recertify.ts <catalogId> "<step>"                 # human summary
 *   npx tsx scripts/personal-loop/recertify.ts <catalogId> "<step>" --entity <id>   # pilot-scoped reading
 *   npx tsx scripts/personal-loop/recertify.ts <catalogId> "<step>" --baseline      # save as the item's BEFORE
 *   npx tsx scripts/personal-loop/recertify.ts <catalogId> "<step>" --compare       # AFTER vs saved BEFORE
 *   add --json for machine-readable output
 *
 * The baseline is stored beside the item note (`Personal/items/<slug>.baseline.json`) so a
 * walk interrupted across sessions still compares against the reading taken BEFORE any work.
 * This script only READS — it never judges or gauges. A stale/absent A reading after work is
 * reported `unmeasured`: run the craft gauge, then recertify again.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { craftMovement, itemSlug, overallMovement, readinessMovement } from '@/lib/status/personalLoop';
import { personalDir, readCell, type CellReading } from './truth';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const [catalogId, step] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--entity');

function fmt(c: CellReading): string {
  const scope = c.scope === 'cell' ? 'whole cell' : `pilot ${c.scope.entityId}`;
  const a = c.a ? `${c.a.level}${c.a.state === 'at-ceiling' ? '^' : c.a.state === 'stale' ? '~' : ''} (ceiling ${c.a.ceiling}, lens ${c.a.lens})` : 'no A chip (step not in the fleet audit)';
  const lines = [
    `${c.catalogId} · ${c.step}  [${scope}]`,
    `  R  ${c.r.level} ${c.r.state} — ${c.r.because}`,
    `  A  ${a}${c.a ? ` — ${c.a.because}` : ''}`,
    `  engine ${c.engine} · grade ${c.grade} · counts pass ${c.counts.pass} / deferred ${c.counts.deferred} / fail ${c.counts.fail} / pending ${c.counts.pending}`,
  ];
  if (c.fact) lines.push(`  audit: deliverable ${c.fact.deliverable} · generatorWired ${c.fact.generatorWired} · judge ${c.fact.judge} · checkerMeaningful ${c.fact.checkerMeaningful}`);
  if (c.judged) lines.push(`  judged ${c.judged.verdict} ${c.judged.score} (${c.judged.model}${c.judged.rubricVersion != null ? `, rubric v${c.judged.rubricVersion}` : ''})`);
  lines.push(`  entities (${c.entities.length}):`);
  for (const e of c.entities) {
    lines.push(`    ${e.entityId.padEnd(28)} ${e.status.padEnd(9)}${e.judge ? ` judge ${e.judge.verdict} ${e.judge.score}` : ''}${e.aLevel ? ` ${e.aLevel}` : ''}${e.reason ? ` — ${e.reason.slice(0, 80)}` : ''}`);
  }
  return lines.join('\n');
}

function main() {
  if (!catalogId || !step) {
    process.stderr.write('usage: recertify.ts <catalogId> "<step>" [--entity <id>] [--baseline | --compare] [--json]\n');
    process.exit(2);
  }
  const reading = readCell(catalogId, step, opt('entity'));
  if (!reading) {
    process.stderr.write(`Not a registered pipeline step: ${catalogId} · ${step}\n`);
    process.exit(2);
  }

  const itemsDir = join(personalDir(), 'items');
  const suffix = opt('entity') ? `.${opt('entity')}` : '';
  const baselinePath = join(itemsDir, `${itemSlug(catalogId, step)}${suffix}.baseline.json`);

  if (flag('baseline')) {
    mkdirSync(itemsDir, { recursive: true });
    writeFileSync(baselinePath, JSON.stringify({ takenAt: new Date().toISOString(), reading }, null, 2));
  }

  let comparison: Record<string, string> | undefined;
  if (flag('compare')) {
    if (!existsSync(baselinePath)) {
      process.stderr.write(`No baseline at ${baselinePath} — take one with --baseline before working the item.\n`);
      process.exit(2);
    }
    const before = (JSON.parse(readFileSync(baselinePath, 'utf8')) as { reading: CellReading }).reading;
    const r = readinessMovement(before.r, reading.r);
    const a = craftMovement(before.a, reading.a);
    comparison = {
      r: `${before.r.level}${before.r.state === 'reached' ? '' : ` ${before.r.state}`} → ${reading.r.level}${reading.r.state === 'reached' ? '' : ` ${reading.r.state}`}  ${r}`,
      a: `${before.a?.level ?? '—'} → ${reading.a?.level ?? '—'}  ${a}`,
      overall: overallMovement(r, a),
    };
  }

  if (flag('json')) {
    process.stdout.write(JSON.stringify({ reading, ...(comparison ? { comparison } : {}) }, null, 2) + '\n');
    return;
  }
  process.stdout.write(fmt(reading) + '\n');
  if (flag('baseline')) process.stdout.write(`\nBaseline saved → ${baselinePath}\n`);
  if (comparison) process.stdout.write(`\nRECERTIFY  R ${comparison.r}\n           A ${comparison.a}\n           overall: ${comparison.overall.toUpperCase()}\n`);
}

main();
