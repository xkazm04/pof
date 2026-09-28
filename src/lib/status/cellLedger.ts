/**
 * The ENTITY LEDGER behind one /status cell — which entity holds a step where it is.
 *
 * A map cell is an aggregate over every entity of a step (`deriveCell` counts passes and
 * picks one reported verdict across all of them), so it cannot say WHICH entity is condemned
 * or still pending. The ledger answers that by running the map's SAME derivation
 * (`buildSwimlane` → `readinessOf`) over one entity's rows + verdicts at a time — exactly what
 * the CLI's `scripts/personal-loop/truth.ts` `readCell` does for a pilot entity — so every
 * row's rung is the map's rule, not a second opinion.
 *
 * DISPLAY-ONLY. Nothing here feeds a cell grade, acceptance or a route: the map's cell is
 * still derived from all entities at once, and the ledger only shows who is holding it down.
 *
 * Pure (JSON + args), like the model it reads.
 */
import type { ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from './judge-verdicts-db';
import type { Result } from '@/types/result';
import { newestRubricVerdicts } from '@/lib/judge/rubrics';
import {
  buildSwimlane,
  getHeadlessFact,
  getStepFact,
  isSyntheticEntity,
  type HeadlessLookup,
  type StepCell,
  type StepMeta,
} from './statusModel';
import { LADDER, rank, readinessOf, type Readiness, type ReadinessLevel } from './readiness';

/**
 * What the judge record says about ONE entity:
 *  - `judge-blocked` / `judge-passed` — a verdict on record moved this entity's grade;
 *  - `not-applied` — a verdict is on record but is stale / superseded / unconfirmable;
 *  - `none` — no judge has scored this entity;
 *  - `unavailable` — the verdict read FAILED, so nobody knows (never "none").
 */
export type LedgerVerdictState = 'judge-blocked' | 'judge-passed' | 'not-applied' | 'none' | 'unavailable';

export interface LedgerRow {
  entityId: string;
  status: ArtifactVerdictRow['status'];
  tier?: string;
  reason?: string;
  /** This entity's own cell — the map's derivation over this entity alone. */
  cell: StepCell;
  readiness: Readiness;
  verdict: LedgerVerdictState;
  /** Per-dimension craft scores of the verdict `cell.judged` reports — this entity's only. */
  dimensions?: Record<string, number>;
}

export interface CellLedger {
  catalogId: string;
  step: string;
  /** Holding-down order: blocked first, then ascending rung (waiting just below reached),
   *  then entityId. */
  rows: LedgerRow[];
  /** The entity the modal opens on — the one holding the step down. */
  decides: string | null;
  /** Reached rungs only; `blocked` and `waiting` are states, counted apart. */
  distribution: Partial<Record<ReadinessLevel, number>>;
  blocked: number;
  waiting: number;
  /** e.g. `1 of 3 entities at R3 · 2 at R1`. */
  summary: string;
  /** Set when the verdict read failed — the ledger says so instead of "no judgment". */
  verdictNote: string | null;
}

export interface CellLedgerInput {
  catalogId: string;
  step: StepMeta;
  /** Artifact rows (any step of the catalog; filtered here). Blob-free rows are fine. */
  rows: readonly ArtifactVerdictRow[];
  /** The verdict read AS A RESULT — a failure is UNKNOWN, never an empty list. */
  verdicts: Result<readonly JudgeVerdict[], string>;
  headless?: HeadlessLookup;
}

/** Sort weight: blocked holds a step down hardest; `waiting` sits just below its rung. */
function weight(r: Readiness): number {
  if (r.state === 'blocked') return -1;
  return rank(r.level) * 2 + (r.state === 'waiting' ? 0 : 1);
}

function verdictState(cell: StepCell, readable: boolean): LedgerVerdictState {
  if (!readable) return 'unavailable';
  const a = cell.judgeAttribution;
  if (!a) return 'none';
  if (!a.applied) return 'not-applied';
  return a.verdict === 'fail' ? 'judge-blocked' : 'judge-passed';
}

/** The dimensions of exactly the verdict the entity's cell reports — never a sibling's. */
function dimensionsOf(cell: StepCell, verdicts: JudgeVerdict[]): Record<string, number> | undefined {
  const j = cell.judged;
  if (!j) return undefined;
  const match = newestRubricVerdicts(verdicts).find(
    (v) => v.verdict === j.verdict && v.score === j.score && v.model === j.model && v.findings === j.findings,
  );
  return match?.dimensions;
}

function summarize(rows: LedgerRow[], distribution: CellLedger['distribution'], waiting: number, blocked: number): string {
  const n = rows.length;
  if (!n) return 'No entity has produced this step';
  const parts: string[] = [];
  for (const level of [...LADDER].reverse()) {
    if (distribution[level]) parts.push(`${distribution[level]} at ${level}`);
  }
  if (waiting) parts.push(`${waiting} waiting`);
  if (blocked) parts.push(`${blocked} blocked`);
  const [first, ...rest] = parts;
  const [count, ...tail] = first.split(' ');
  return [`${count} of ${n} ${n === 1 ? 'entity' : 'entities'} ${tail.join(' ')}`, ...rest].join(' · ');
}

export function cellLedger({ catalogId, step, rows, verdicts, headless = getHeadlessFact }: CellLedgerInput): CellLedger {
  const readable = verdicts.ok;
  const inStep = <T extends { step: string; entityId: string }>(x: T) =>
    x.step === step.label && !isSyntheticEntity(x.entityId);
  const stepRows = rows.filter(inStep);
  const stepVerdicts = verdicts.ok ? verdicts.data.filter(inStep) : [];
  const fact = getStepFact(catalogId, step.label);

  const byEntity = new Map<string, ArtifactVerdictRow[]>();
  for (const r of stepRows) byEntity.set(r.entityId, [...(byEntity.get(r.entityId) ?? []), r]);

  const ledgerRows: LedgerRow[] = [...byEntity.entries()].map(([entityId, own]) => {
    const ownVerdicts = stepVerdicts.filter((v) => v.entityId === entityId);
    const cell = buildSwimlane(catalogId, catalogId, [step], own, ownVerdicts, headless).cells[0];
    // The same judge-relevance filter `deriveCell` applies, so dimensions pair with its pick.
    const relevant = ownVerdicts.filter((v) => !fact || v.judge === fact.judge || v.judge === 'human');
    const dimensions = dimensionsOf(cell, relevant);
    return {
      entityId,
      status: own[0].status,
      ...(own[0].tier ? { tier: own[0].tier } : {}),
      ...(own[0].reason ? { reason: own[0].reason } : {}),
      cell,
      readiness: readinessOf(cell),
      verdict: verdictState(cell, readable),
      ...(dimensions ? { dimensions } : {}),
    };
  });
  ledgerRows.sort((x, y) => weight(x.readiness) - weight(y.readiness) || x.entityId.localeCompare(y.entityId));

  const distribution: CellLedger['distribution'] = {};
  let waiting = 0;
  let blocked = 0;
  for (const r of ledgerRows) {
    if (r.readiness.state === 'blocked') blocked += 1;
    else if (r.readiness.state === 'waiting') waiting += 1;
    else distribution[r.readiness.level] = (distribution[r.readiness.level] ?? 0) + 1;
  }

  return {
    catalogId,
    step: step.label,
    rows: ledgerRows,
    decides: ledgerRows[0]?.entityId ?? null,
    distribution,
    blocked,
    waiting,
    summary: summarize(ledgerRows, distribution, waiting, blocked),
    verdictNote: verdicts.ok
      ? null
      : `Judge verdicts could not be read (${verdicts.error}) — every entity's judgment is UNKNOWN, and rungs are checker-only.`,
  };
}

/** One entity's paired evidence: its own row, verdict, attribution and dimensions. */
export interface EntityEvidence {
  row: LedgerRow;
  judged?: StepCell['judged'];
  attribution?: StepCell['judgeAttribution'];
  dimensions?: Record<string, number>;
}

export function evidenceFor(ledger: CellLedger, entityId: string): EntityEvidence | null {
  const row = ledger.rows.find((r) => r.entityId === entityId);
  if (!row) return null;
  return {
    row,
    ...(row.cell.judged ? { judged: row.cell.judged } : {}),
    ...(row.cell.judgeAttribution ? { attribution: row.cell.judgeAttribution } : {}),
    ...(row.dimensions ? { dimensions: row.dimensions } : {}),
  };
}
