/**
 * Readiness TIERS — what each judged cell actually needs, rebuilt from CURRENT evidence.
 *
 * The 2026-07-30 sweep proved the previous tier model was void: it was built from v3 scores
 * without checking whether the artifact had been rewritten since the verdict was recorded.
 * 59 of 90 cells were being planned against verdicts for content that no longer existed, so
 * "re-judging clears this" was a prediction about vanished text.
 *
 * Two independent axes decide a tier, and BOTH must hold before a score is believed:
 *
 *   1. RUBRIC CURRENCY — was it judged under the current RUBRIC_VERSION? An older verdict
 *      was produced by a different (here: defective) harness input.
 *   2. FRESHNESS — was it judged AFTER the artifact was last written? A verdict older than
 *      its artifact grades text that has since been replaced. This is the check that the
 *      previous model omitted, and the single reason its numbers were wrong.
 *
 * A cell failing either axis is NOT scored — it is Tier 1 (needs a verdict), regardless of
 * how good or bad its stale number looks. That is the honest position: we do not know.
 *
 *   npx tsx scripts/readiness/tiers.ts                 # summary
 *   npx tsx scripts/readiness/tiers.ts --tier 2        # one tier, listed
 *   npx tsx scripts/readiness/tiers.ts --json          # machine-readable worklist
 *   npx tsx scripts/readiness/tiers.ts --json --tier 1 > sweep-list.json
 */
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RUBRIC_VERSION, BANDS } from '@/lib/judge/rubrics';
import { getStepFact, isSyntheticEntity } from '@/lib/status/statusModel';

const DB_PATH = process.env.POF_DB_PATH ?? join(homedir(), '.pof', 'pof.db');
const arg = (k: string): string | undefined => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (k: string) => process.argv.includes(`--${k}`);

/** Deliverable classes no text agent can produce — lifting these needs a real generator,
 *  so they are flagged rather than handed to an authoring fleet (the honest floor). */
const MEDIA = new Set(['2d-art', '3d-mesh', 'audio', 'animation', 'vfx-particles']);

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

export const TIER_NAME: Record<Tier, string> = {
  0: 'CHECKER BROKEN  — the artifact itself is invalid (gap-loop, not authoring)',
  1: 'NEEDS VERDICT   — no current+fresh verdict; re-judge before planning any work',
  2: 'NEAR MISS       — fresh, current, 85-89: small authoring gap',
  3: 'MODERATE        — fresh, current, 70-84: real authoring against live findings',
  4: 'DEEP            — fresh, current, <70: major rework or an honest ceiling',
  5: 'AT THE BAR      — fresh, current, >=90: already shippable',
};

export interface TierRow {
  tier: Tier;
  catalogId: string;
  entityId: string;
  step: string;
  /** Score of the newest verdict, or null when there is none. Present but UNTRUSTED for
   *  tier 1 rows — kept only so a reader can see what the stale number claimed. */
  score: number | null;
  trusted: boolean;
  rubric: number | null;
  /** Why it is not trusted. A cell can fail BOTH axes, so these are independent flags,
   *  not a single first-match reason — reporting only the first would hide how much of
   *  the map is stale behind how much is old-rubric. */
  untrusted?: { stale: boolean; oldRubric: boolean; neverJudged: boolean };
  artifactStatus: string;
  deliverable: string;
  media: boolean;
}

interface ArtifactRow { catalog_id: string; entity_id: string; step: string; status: string; updated_at: string }
interface VerdictRow { catalog_id: string; entity_id: string; step: string; score: number; rubric_version: number | null; judged_at: string }

export function buildTiers(): TierRow[] {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const arts = db.prepare('SELECT catalog_id,entity_id,step,status,updated_at FROM pipeline_artifacts').all() as ArtifactRow[];
  const verds = db.prepare('SELECT catalog_id,entity_id,step,score,rubric_version,judged_at FROM judge_verdicts').all() as VerdictRow[];
  db.close();

  // Newest verdict per cell.
  const newest = new Map<string, VerdictRow>();
  for (const v of verds) {
    const k = `${v.catalog_id}|${v.entity_id}|${v.step}`;
    const prev = newest.get(k);
    if (!prev || v.judged_at > prev.judged_at) newest.set(k, v);
  }

  const rows: TierRow[] = [];
  for (const a of arts) {
    if (isSyntheticEntity(a.entity_id)) continue; // fixtures are not deliverables
    const fact = getStepFact(a.catalog_id, a.step);
    const deliverable = fact?.deliverable ?? 'unknown';
    const v = newest.get(`${a.catalog_id}|${a.entity_id}|${a.step}`);

    // Both axes evaluated independently — a verdict can be old-rubric AND stale, and the
    // stale count is the one the previous tier model silently got wrong, so it must not be
    // masked by whichever check happened to run first.
    const neverJudged = !v;
    const oldRubric = !!v && (v.rubric_version ?? 1) < RUBRIC_VERSION;
    const stale = !!v && a.updated_at > v.judged_at;
    const trusted = !!v && !oldRubric && !stale;

    let tier: Tier;
    if (a.status === 'fail') {
      // A broken artifact is not a quality problem — no judge score can make it valid.
      tier = 0;
    } else if (!trusted) {
      tier = 1;
    } else {
      const s = v!.score;
      tier = s >= BANDS.shippable ? 5 : s >= 85 ? 2 : s >= BANDS.placeholder ? 3 : 4;
    }

    rows.push({
      tier,
      catalogId: a.catalog_id,
      entityId: a.entity_id,
      step: a.step,
      score: v?.score ?? null,
      trusted,
      rubric: v?.rubric_version ?? null,
      ...(trusted ? {} : { untrusted: { stale, oldRubric, neverJudged } }),
      artifactStatus: a.status,
      deliverable,
      media: MEDIA.has(deliverable),
    });
  }
  return rows;
}

function main() {
  const rows = buildTiers();
  const want = arg('tier');
  const sel = want ? rows.filter((r) => String(r.tier) === want) : rows;

  if (has('json')) {
    process.stdout.write(JSON.stringify({ rubricVersion: RUBRIC_VERSION, total: rows.length, matched: sel.length, rows: sel }, null, 1));
    return;
  }

  const out: string[] = [];
  out.push(`READINESS TIERS — ${rows.length} entity-cells, judged against rubric v${RUBRIC_VERSION}`);
  out.push('');
  for (const t of [0, 1, 2, 3, 4, 5] as Tier[]) {
    const list = rows.filter((r) => r.tier === t);
    const media = list.filter((r) => r.media).length;
    out.push(`  T${t}  ${String(list.length).padStart(4)}  ${TIER_NAME[t]}${media ? `   [${media} media — honest floor]` : ''}`);
  }
  out.push('');

  const t1 = rows.filter((r) => r.tier === 1);
  // Independent counts — a cell can be both, so these deliberately do not sum to T1.
  out.push(`  T1 breakdown (flags are independent; a cell can carry both):`);
  out.push(`      ${String(t1.filter((r) => r.untrusted?.neverJudged).length).padStart(4)}  never judged`);
  out.push(`      ${String(t1.filter((r) => r.untrusted?.oldRubric).length).padStart(4)}  judged under rubric < v${RUBRIC_VERSION}`);
  out.push(`      ${String(t1.filter((r) => r.untrusted?.stale).length).padStart(4)}  artifact rewritten AFTER the verdict (the freshness filter)`);
  out.push(`      ${String(t1.filter((r) => r.untrusted?.stale && r.untrusted?.oldRubric).length).padStart(4)}  ... both stale AND old-rubric`);
  out.push('');
  out.push(`  Trusted (current rubric AND judged after the last write): ${rows.filter((r) => r.trusted).length} of ${rows.length}`);

  if (want) {
    out.push('');
    out.push(`--- T${want} rows ---`);
    const byCat = new Map<string, TierRow[]>();
    for (const r of sel) byCat.set(r.catalogId, [...(byCat.get(r.catalogId) ?? []), r]);
    for (const [cat, list] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
      out.push(`  ${cat} (${list.length})`);
      for (const r of list) {
        out.push(`      ${String(r.score ?? '—').padStart(3)}${r.trusted ? ' ' : '?'} ${r.step.padEnd(26)} ${r.entityId.padEnd(26)} ${r.media ? '[media]' : ''}`);
      }
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}

main();
