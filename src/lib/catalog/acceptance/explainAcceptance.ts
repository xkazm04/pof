import type { AcceptanceResult, AcceptanceStatus, AcceptanceTier, Checker, CheckerContext } from './types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { allOfMembers } from './combinators';
import { serverVerdictOverlay, type PersistedVerdict } from './resolveStepAcceptance';
import { bridgeJudgeVerdict, judgedContentOf, type JudgedContent } from './judgeBridge';
import { getStepFact } from '@/lib/status/statusModel';

/**
 * WHY IS THIS STEP THIS COLOUR? — a pure, on-demand explanation of one step's verdict.
 *
 * The truth spine could not explain itself. A step's reported status is the output of a
 * three-layer chain (`resolveStepAcceptance`: Checker → server drain overlay → judge bridge),
 * two of whose rules are invisible to the reader:
 *
 *  - the server overlay wins ONLY over a local `deferred` — a server pass/fail never
 *    silently overrides a checker that could decide for itself;
 *  - `allOf` reports the FIRST non-pass, so the tier and reason on screen belong to whichever
 *    composed member spoke, and nothing named it;
 *  - the judge bridge can condemn a shape-pass outright, and attaches its verdict's
 *    PROVENANCE even when it does not apply.
 *
 * Diagnosing one red step therefore took a scout, a three-commit bisect and a read-only DB
 * query. This reconstructs the chain in order — each layer's input, its output, and whether
 * it WON (changed the verdict) — so the same answer is one disclosure away.
 *
 * ── Guarantees ────────────────────────────────────────────────────────────────
 * DISPLAY ONLY. It re-applies the exact same functions in the exact same order as
 * {@link resolveStepAcceptance}, so `explanation.final` is that function's output by
 * construction; it never re-grades and never changes a verdict.
 *
 * ON DEMAND. It runs the step's checker (and every `allOf` member) again, so it must be
 * called when a reader asks — from an opened disclosure — never once per render of every step.
 */

/** One member of an `allOf` composition, and whether it produced the composition's verdict. */
export interface AcceptanceMember {
  index: number;
  label: string;
  status: AcceptanceStatus;
  tier: AcceptanceTier;
  reason?: string;
  /** This member's result IS the one `allOf` reported (the first non-pass, else the first). */
  spoke: boolean;
}

export type AcceptanceLayerId = 'checker' | 'server-overlay' | 'judge-bridge';

export interface AcceptanceLayer {
  id: AcceptanceLayerId;
  /** Human name for the layer. */
  label: string;
  /** What this layer received, as `status · tier` (or a description, for the checker's data). */
  input: string;
  /** What it emitted, as `status · tier`. */
  output: string;
  /** It CHANGED the verdict — i.e. it is (part of) why the step is this colour. */
  won: boolean;
  /** One plain sentence: what this layer did, or why it declined to act. */
  note: string;
  /** The composed members, for the checker layer of an `allOf` step. */
  members?: AcceptanceMember[];
}

export interface AcceptanceExplanation {
  /** Identical to `resolveStepAcceptance(...)` for the same inputs. */
  final: AcceptanceResult;
  /** The LAST layer that changed the status — the direct answer to "why this colour?". */
  decidedBy: AcceptanceLayerId;
  /** The chain, in the order it was applied. */
  layers: AcceptanceLayer[];
}

const shown = (r: AcceptanceResult) => `${r.status} · ${r.tier}`;

/** Re-run an `allOf` composition's members and mark the one whose result it reported. */
function explainMembers(checker: Checker, data: Record<string, unknown>, ctx?: CheckerContext): AcceptanceMember[] | undefined {
  const members = allOfMembers(checker);
  if (!members?.length) return undefined;
  const results = members.map((c) => c(data, ctx));
  // `allOf` returns the first non-pass, else the first result.
  const spokeAt = results.findIndex((r) => r.status !== 'pass');
  const decided = spokeAt === -1 ? 0 : spokeAt;
  return results.map((r, index) => ({
    index,
    label: r.label,
    status: r.status,
    tier: r.tier,
    ...(r.reason ? { reason: r.reason } : {}),
    spoke: index === decided,
  }));
}

export function explainAcceptance({ catalogId, step, local, checker, data, ctx, persisted, verdicts, judgeClass, content, updatedAt }: {
  catalogId?: string;
  step: string;
  /** The Checker's own verdict — the same value the caller fed `resolveStepAcceptance`. */
  local: AcceptanceResult;
  /** The step's checker, so an `allOf` composition can name the member that spoke. Optional:
   *  without it (or its `data`) the checker layer is still reported, just without members. */
  checker?: Checker;
  data?: Record<string, unknown>;
  ctx?: CheckerContext;
  persisted?: PersistedVerdict;
  verdicts?: JudgeVerdict[];
  judgeClass?: string;
  content?: JudgedContent;
  updatedAt?: string;
}): AcceptanceExplanation {
  const overlaid = serverVerdictOverlay(local, persisted);
  const cls = judgeClass ?? (catalogId ? getStepFact(catalogId, step)?.judge : undefined);
  const bound = content ?? (data ? judgedContentOf(data, updatedAt) : undefined);
  const final = verdicts?.length ? bridgeJudgeVerdict(overlaid, verdicts, cls, bound) : overlaid;

  const members = checker && data ? explainMembers(checker, data, ctx) : undefined;
  const spoke = members?.find((m) => m.spoke);

  const checkerLayer: AcceptanceLayer = {
    id: 'checker',
    label: 'Step checker',
    input: `produced data · ${Object.keys(data ?? {}).length} field${Object.keys(data ?? {}).length === 1 ? '' : 's'}`,
    output: shown(local),
    won: true, // the baseline verdict — overwritten below if a later layer changed it
    note: spoke
      ? `Composed of ${members!.length} checks; "${spoke.label}" produced the reported ${spoke.status} · ${spoke.tier}.`
      : members
        ? `Composed of ${members.length} checks, all passing.`
        : `The step's own checker graded its data as ${local.status}.`,
    ...(members ? { members } : {}),
  };

  const overlayChanged = overlaid.status !== local.status;
  const overlayLayer: AcceptanceLayer = {
    id: 'server-overlay',
    label: 'Server drain overlay',
    input: shown(local),
    output: shown(overlaid),
    won: overlayChanged,
    note: overlayChanged
      ? `The server ran this gate and reported ${persisted?.status}; a real L3/L4 outcome supersedes a local deferred.`
      : local.status === 'deferred'
        ? 'Still deferred: no server pass/fail is on record for this gate yet.'
        : `Not applied. A server verdict wins ONLY over a local "deferred" — the checker decided this one itself${persisted?.status ? ` (the server row says ${persisted.status})` : ''}.`,
  };

  const judgeChanged = final.status !== overlaid.status;
  const judgeLayer: AcceptanceLayer = {
    id: 'judge-bridge',
    label: 'Judge bridge',
    input: shown(overlaid),
    output: shown(final),
    won: judgeChanged,
    note: final.judge
      ? `${final.judge.judge} verdict "${final.judge.verdict}" (score ${final.judge.score}), provenance ${final.judge.provenance}. ${final.judge.note}`
      : verdicts?.length
        ? 'Judge verdicts exist for this step but none of them fails, so nothing is overlaid.'
        : 'No judge verdict is on record for this step.',
  };

  const decidedBy: AcceptanceLayerId = judgeChanged ? 'judge-bridge' : overlayChanged ? 'server-overlay' : 'checker';
  checkerLayer.won = decidedBy === 'checker';

  return { final, decidedBy, layers: [checkerLayer, overlayLayer, judgeLayer] };
}
