/**
 * The `contracts` row's checkers (spark `gta-quest-loop`, WP2). Pure over a step's slice of the quest's
 * `ContractSnapshot` — the server derives the slice from `games/gtai/quests/<id>/` (`contractsRead.ts`),
 * so every verdict here is a reading of files on disk, never a toggle.
 *
 * Shared rules:
 *  - a slice that is not a folder read (`source: 'awaiting-sync'`, a stub produce on an unsynced entity)
 *    DEFERS at L3 — the truth is produced out of band by the `/gta --quest` protocol + the sync, the same
 *    way the L3 drain owns runtime truth — and never passes;
 *  - "not yet" (unmeasured guard, no judge report, missing art) is `pending` with the reason, never pass;
 *  - a defect the folder proves (no source path, unparseable package, blocked guard, failed selftest) is `fail`.
 */
import type { AcceptanceResult, AcceptanceTier, Checker } from './types';
import { unboundReason } from '@/lib/games/ueBinding';
import type {
  ContractStepKey, CouncilFacts, GuardsFacts, InGameFacts, PackageFacts, PlanFacts,
} from '@/lib/catalog/pipelines/contracts/contractsSnapshot';

type Res = Omit<AcceptanceResult, 'label' | 'tier'>;
const ok = (detail: string): Res => ({ status: 'pass', detail });
const notYet = (detail: string, reason: string): Res => ({ status: 'pending', detail, reason });
const bad = (detail: string, reason: string): Res => ({ status: 'fail', detail, reason });
const list = (xs: readonly string[]) => xs.join(', ');

/** Wrap a slice grader: read `data[key]`, defer an unsynced slice, stamp label + tier. */
function sliceChecker<T>(key: ContractStepKey, label: string, tier: AcceptanceTier, grade: (s: T) => Res): Checker {
  return (data) => {
    const slice = data[key] as ({ source?: unknown; note?: unknown } & T) | undefined;
    if (!slice || typeof slice !== 'object' || slice.source !== 'quest-folder') {
      const note = typeof slice?.note === 'string' ? slice.note : 'no quest package mirrored into this step';
      return { label, tier: 'L3', status: 'deferred', detail: 'awaiting quest sync', reason: `awaiting quest sync — ${note}` };
    }
    return { label, tier, ...grade(slice) };
  };
}

export function councilFacts(c: CouncilFacts): Res {
  if (!c.sources.length) return bad('no source path', 'provenance.sources names no council path — the package cannot say which proposals it fused');
  if (!c.runId) {
    return c.candidates.length > 1
      ? notYet('council run ambiguous', `${c.candidates.length} council runs hold every source path (${list(c.candidates)}); record provenance.runId in quest.json`)
      : bad('no council run', `no run under games/gtai/quests/_council/ holds the source paths ${list(c.sources)}`);
  }
  if (!c.runDirExists) return bad('council run folder missing', `${c.runDir} does not exist (run id ${c.runIdBasis})`);
  const seats = c.seatsError
    ? `seats.json unreadable: ${c.seatsError}`
    : c.seats.length ? c.seats.map((s) => `${s.seat} ${s.state}`).join(', ') : 'seats.json unrecorded';
  return ok(`run ${c.runId} (${c.runIdBasis}) · ${seats} · ${c.paths.length} paths · fused from ${list(c.sources)}`);
}

export function planFacts(p: PlanFacts): Res {
  if (!p.parsed) return bad('package does not parse', `not gtai.quest/1 — ${p.error ?? 'unknown parse error'}`);
  const empty = [!p.whyNotFiller.trim() && 'whyNotFiller', !p.ownerNotes.trim() && 'provenance.ownerNotes'].filter(Boolean) as string[];
  if (empty.length) return bad(`${empty.length} required field(s) empty`, `empty: ${list(empty)} — no quest is filler, and the owner's fusion notes are kept verbatim`);
  return ok(`"${p.title}" · ${p.act} · ${p.beats.length} beats · ${p.autosavePoints.length} autosave point(s) · ${p.characters.length} characters`);
}

export function guardsFacts(g: GuardsFacts): Res {
  if (g.error) return notYet('guards not measured', g.error);
  if (!g.verdict) return notYet('guards not run', 'the package does not parse, so there is nothing to assess (see Plan)');
  const v = g.verdict;
  if (v.blocked) {
    const errors = v.guards.filter((x) => v.blockedBy.includes(x.guard))
      .flatMap((x) => x.findings.filter((f) => f.severity === 'error').map((f) => `${x.guard}:${f.code}`));
    return bad(`blocked by ${list(v.blockedBy)}`, `red guard(s) without an owner override: ${list(v.blockedBy)} (${list(errors.slice(0, 6))})`);
  }
  const unmeasured = v.guards.filter((x) => x.state === 'unmeasured');
  if (unmeasured.length) {
    return notYet(`${unmeasured.length} guard(s) unmeasured`, `unmeasured is never green: ${unmeasured.map((x) => `${x.guard} (${x.basis})`).join('; ')}`);
  }
  if (!g.judge.present) return notYet('no line judge report', `${g.judge.path} is missing — run council.mjs judge`);
  if (g.judge.error) return bad('line judge report invalid', `${g.judge.path}: ${g.judge.error}`);
  const overridden = v.guards.filter((x) => x.state === 'red')
    .map((x) => `${x.guard} overridden: ${g.overrides.find((o) => o.guard === x.guard)?.reason ?? '(reason missing)'}`);
  return ok(`${v.guards.length} guards clear · judge ${g.judge.judgeSeat} on ${g.judge.authorSeat}'s lines${overridden.length ? ` · ${overridden.join(' · ')}` : ''}`);
}

export function packageFacts(p: PackageFacts): Res {
  if (!p.parsed) return notYet('package does not parse', 'nothing to check until quest.json parses (see Plan)');
  if (p.lines.unreserved.length) {
    return bad(`${p.lines.unreserved.length} line(s) without audio`, `lines must reserve \`audio\` (null until the voice pass): ${list(p.lines.unreserved)}`);
  }
  const missing = p.newCharacters.filter((c) => c.art.length === 0);
  if (missing.length) {
    return notYet(`${missing.length}/${p.newCharacters.length} new character(s) without art`, `no art under art/<characterId>* for: ${list(missing.map((c) => c.id))}`);
  }
  return ok(`${p.newCharacters.length} new character(s) with art · ${p.lines.total} lines, audio reserved (${p.lines.recorded} recorded)`);
}

export function inGameFacts(g: InGameFacts): Res {
  const adapter = unboundReason('gtai');
  if (!g.selftest.present) return { status: 'deferred', detail: 'no runtime evidence yet', reason: `${adapter}; no ${g.selftest.path} yet` };
  if (g.selftest.error) return bad('selftest unreadable', `${g.selftest.path}: ${g.selftest.error}`);
  if (g.selftest.state === 'failed' || g.selftest.state === 'error') return bad(`selftest ${g.selftest.state}`, `${g.selftest.path} records state "${g.selftest.state}"`);
  if (g.selftest.state !== 'succeeded') {
    return { status: 'deferred', detail: `selftest ${g.selftest.state}`, reason: `${adapter}; selftest state is "${g.selftest.state}", not "succeeded"` };
  }
  const frame = g.selftest.frame ? g.frames.find((f) => f === g.selftest.frame) : g.frames[0];
  if (!frame) {
    const want = g.selftest.frame ? `the named frame ${g.selftest.frame}` : 'a PNG frame';
    return { status: 'deferred', detail: 'selftest succeeded, no frame', reason: `${adapter}; ${want} is missing from the evidence folder` };
  }
  return ok(`file evidence: selftest succeeded + frame ${frame} (written by the Godot runtime; PoF did not observe the run — ${adapter})`);
}

export const contractsCouncilAccepted = () => sliceChecker<CouncilFacts>('council', 'Council run on record', 'L2', councilFacts);
export const contractsPlanAccepted = () => sliceChecker<PlanFacts>('plan', 'Plan parses, not filler', 'L0', planFacts);
export const contractsGuardsAccepted = () => sliceChecker<GuardsFacts>('guards', 'Guards clear + judged', 'L0', guardsFacts);
export const contractsPackageAccepted = () => sliceChecker<PackageFacts>('package', 'Package assets present', 'L2', packageFacts);
export const contractsInGameAccepted = () => sliceChecker<InGameFacts>('inGame', 'In-game runtime evidence', 'L3', inGameFacts);

/** One checker per step key — the ledger route grades with exactly what the registered steps use. */
export const CONTRACT_CHECKERS: Readonly<Record<ContractStepKey, Checker>> = {
  council: contractsCouncilAccepted(),
  plan: contractsPlanAccepted(),
  guards: contractsGuardsAccepted(),
  package: contractsPackageAccepted(),
  inGame: contractsInGameAccepted(),
};
