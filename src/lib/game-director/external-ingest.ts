/**
 * External playtest ingestion — the first writer in this repo that produces a
 * Game Director session stamped `source: 'external'`.
 *
 * Until now every session on this machine came from `game-director-sim.ts`: the
 * DB, triage, fingerprinting and alerting were real, but nothing measured
 * anything. The route has always exposed a complete external-writer API
 * (`create` / `update-status` / `add-finding` / `add-event` / `complete`), and
 * this module is the mapping that finally feeds it from a run PoF actually
 * produced.
 *
 * ── The run-record shape ───────────────────────────────────────────────────
 * The source of truth is the **harness run state pair** — `game-plan.json`
 * (a {@link GamePlan}) plus `progress.json` (a {@link ProgressEntry}[]) — the
 * only run-record shape with real, committed on-disk examples in this repo:
 * `.harness-dzin/`, `.harness-content/`, `.harness-ui/`, `.harness-dzin-full/`.
 * A harness run is a machine session against a real build: it compiles, it runs
 * gates (including `ue-compile` / `ue-test` / `ue-visual`), and every entry it
 * writes is an observation made at the time.
 *
 * ── The standard it is built to ────────────────────────────────────────────
 * ai-registry `game-production/craft-judgment/playtest-signal-to-defect`:
 *
 * - *"An agent playing a build is a playtester whose report is machine-generated"* —
 *   so the session contract is enforced, not assumed: a record with no build
 *   identity, no timeline, or no declared coverage is REFUSED
 *   (`session-instrumentation-contract`). A refused record never becomes an
 *   empty session that reads as a clean playtest.
 * - *"Observation before interpretation"* — the record's own measured fields
 *   (outcome, verification, gate errors) become the finding's `description`;
 *   the agent's narration and learnings — causal prose, written by a model —
 *   are quarantined in `suggestedFix`, clearly labelled as interpretation, and
 *   never reach the router.
 * - *"A finding without a repro is a rumour"* — every finding carries an
 *   evidence pointer naming the build, the area and the iteration to re-run.
 *   An entry that cannot produce one is rejected with its reason rather than
 *   filed as a bare finding.
 * - *"Frequency and severity are two axes and never one number"* — severity
 *   comes from the record's own gate verdict; frequency is stated separately,
 *   always with its denominator ("2 of 7 recorded iterations for this area").
 *   They are never multiplied into a priority.
 * - *"Routing is the move that makes this subject pay"* and **no default
 *   bucket** — a finding routes to the sub-module the entry names. An entry
 *   whose module has no finding-category route is NOT swept into a catch-all:
 *   it becomes a named `unrouted` entry, reported by the ingest and announced
 *   on the timeline, so the size of that queue measures the routing table.
 *
 * Confidence is deliberately left `null` (`not scored`) unless the record
 * supplies an observer score: a harness gate verdict is evidence, not a 0-100
 * confidence, and minting one from a quality figure would be exactly the
 * unmeasured number this module exists to avoid.
 *
 * Pure mapping (`buildIngestPlan`) is separated from the writes
 * (`ingestExternalPlaytest`, which drives an injected {@link DirectorWriter}),
 * so the mapping is unit-testable without a database.
 */

import type { GamePlan, ProgressEntry } from '@/lib/harness/types';
import type { SubModuleId } from '@/types/modules';
import { SUB_MODULE_IDS } from '@/types/modules';
import type {
  CreateSessionPayload,
  DirectorEvent,
  FindingCategory,
  FindingSeverity,
  PlaytestConfig,
  PlaytestFinding,
  PlaytestStatus,
  PlaytestSummary,
  TestCategory,
} from '@/types/game-director';
import { ok, err, type Result } from '@/types/result';

// ─── The run record ──────────────────────────────────────────────────────────

/** The harness run state pair, as it sits on disk in `<state-dir>/`. */
export interface HarnessRunRecord {
  plan: GamePlan;
  progress: ProgressEntry[];
}

/**
 * The session contract this ingest requires before it will write anything
 * (`session-instrumentation-contract`). Everything here is read off the record;
 * nothing is inferred.
 */
export interface SessionContract {
  /** Build identity precise enough that two people cannot disagree about it. */
  buildId: string;
  /** Where the build lives — the harness's project path. */
  buildPath: string;
  /**
   * World identity (map, seed, difficulty). A harness run does not record one,
   * so this is `null` and the timeline SAYS it is null rather than leaving the
   * reader to assume a scenario was held fixed.
   */
  worldIdentity: string | null;
  /** What the run set out to cover, declared before it ran: the planned areas. */
  declaredCoverage: string[];
  /** Sub-modules the declared coverage touches. */
  modules: SubModuleId[];
  /** Wall-clock the run actually accounts for, summed over its own entries. */
  durationMs: number;
  /** Recorded iterations — the run's input timeline. */
  entryCount: number;
}

// ─── Routing table (no default bucket) ───────────────────────────────────────

/**
 * Sub-module → finding category. The inverse of `findingFix.ts`'s
 * `CATEGORY_TO_MODULE`, which already assumes this correspondence in the other
 * direction.
 *
 * There is deliberately NO fallback entry. "A router with a default bucket
 * sends everything to the default": a module absent from this table produces an
 * `unrouted` entry that the ingest reports, not a finding quietly filed under
 * whichever category accepts anything.
 */
export const MODULE_TO_FINDING_CATEGORY: Partial<Record<SubModuleId, FindingCategory>> = {
  'materials': 'visual-glitch',
  'arpg-animation': 'animation-issue',
  'arpg-combat': 'gameplay-feel',
  'arpg-ui': 'ux-problem',
  'arpg-polish': 'performance',
  'arpg-world': 'level-pacing',
  'audio': 'audio-issue',
  'arpg-save': 'save-load',
  'arpg-enemy-ai': 'ai-behavior',
};

const SUB_MODULE_SET = new Set<string>(SUB_MODULE_IDS);

// ─── Ingest plan (the pure product of the mapping) ───────────────────────────

/** An entry that named a real problem but could not be routed to a category. */
export interface UnroutedEntry {
  areaId: string;
  moduleId: string;
  reason: string;
}

/** An entry this ingest refused to turn into a finding, with the reason. */
export interface RejectedEntry {
  areaId: string;
  reason: string;
}

/** Everything the writes need, derived purely from one run record. */
export interface IngestPlan {
  contract: SessionContract;
  create: CreateSessionPayload;
  /** Status walk, in order, before the findings land. */
  statuses: PlaytestStatus[];
  /** Findings, without their `sessionId` (assigned once the session exists). */
  findings: Omit<PlaytestFinding, 'sessionId'>[];
  /** Timeline events, without their `sessionId`. */
  events: Omit<DirectorEvent, 'sessionId'>[];
  summary: PlaytestSummary;
  durationMs: number;
  systemsTestedCount: number;
  /** Failing entries whose module has no route — a measured routing-table miss. */
  unrouted: UnroutedEntry[];
  /** Failing entries refused for want of an evidence pointer. */
  rejected: RejectedEntry[];
}

// ─── Validation ──────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Gate the session contract. Every refusal names the missing field, because
 * "a report missing all four is not a weak report; it is a rumour" — and an
 * empty session stamped `external` would read as a build that was measured and
 * found clean.
 */
export function validateRunRecord(record: unknown): Result<HarnessRunRecord, string> {
  if (!isObject(record)) {
    return err('Run record is not an object — expected the harness run state pair { plan, progress }.');
  }
  const plan = record.plan;
  const progress = record.progress;
  if (!isObject(plan)) {
    return err('Run record has no `plan` — a session with no game-plan.json has no declared coverage, and absence of a finding outside declared coverage means nothing.');
  }
  if (!nonEmpty(plan.game) || !nonEmpty(plan.projectPath)) {
    return err('Run record has no build identity (`plan.game` / `plan.projectPath`) — a finding that cannot be aged to a build cannot be closed.');
  }
  if (!Array.isArray(plan.areas) || plan.areas.length === 0) {
    return err('Run record declares no areas — nothing states what this session set out to cover.');
  }
  if (typeof plan.totalFeatures !== 'number' || plan.totalFeatures <= 0) {
    return err('Run record declares no features (`plan.totalFeatures`) — there is no denominator for anything this session could report.');
  }
  if (!Array.isArray(progress) || progress.length === 0) {
    return err('Run record has no `progress` entries — no input timeline was recorded, so nothing here is an observation.');
  }
  return ok({ plan: plan as unknown as GamePlan, progress: progress as unknown as ProgressEntry[] });
}

// ─── Mapping helpers ─────────────────────────────────────────────────────────

/** A recorded iteration that reported something other than a clean pass. */
function isFailing(entry: ProgressEntry): boolean {
  return entry.outcome !== 'success' || entry.verification === 'fail';
}

/**
 * Severity, borrowed wholesale from the record's own gate verdict — this
 * subject does not invent a parallel ladder for machine reports. A gate that
 * could not be evaluated is `low`: it is an unknown, not a defect.
 */
function severityFor(entry: ProgressEntry): FindingSeverity {
  if (entry.verification === 'fail' || entry.outcome === 'failure') return 'high';
  if (entry.outcome === 'partial') return 'medium';
  return 'low';
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Human label for an area, falling back to its id rather than to nothing. */
function areaLabel(plan: GamePlan, areaId: string): string {
  return plan.areas.find((a) => a.id === areaId)?.label || areaId;
}

/**
 * The evidence pointer: the smallest trigger somebody else can pull to see this
 * again. Without it there is no finding — only a rumour.
 */
function evidencePointer(contract: SessionContract, entry: ProgressEntry): string | null {
  if (!nonEmpty(entry.areaId)) return null;
  if (typeof entry.iteration !== 'number' || !Number.isFinite(entry.iteration)) return null;
  return `re-run harness area "${entry.areaId}" on build ${contract.buildId} (iteration ${entry.iteration}, recorded ${entry.timestamp ?? 'at an unrecorded time'})`;
}

// ─── The mapping ─────────────────────────────────────────────────────────────

export interface BuildPlanOptions {
  /** Clock, injected so the mapping is deterministic under test. */
  now: () => number;
  /** Optional session name; defaults to the build identity. */
  sessionName?: string;
  /** Project this session belongs to — carried so the write-back can scope itself. */
  projectId?: string;
}

/**
 * Turn one validated run record into everything the writer API needs. Pure: no
 * clock of its own, no ids of its own, no I/O.
 */
export function buildIngestPlan(
  record: HarnessRunRecord,
  opts: BuildPlanOptions,
): Result<IngestPlan, string> {
  const { plan, progress } = record;
  const nowMs = opts.now();
  const stamp = new Date(nowMs).toISOString();

  const modules = Array.from(
    new Set(progress.map((e) => e.moduleId).filter((m): m is SubModuleId => SUB_MODULE_SET.has(m))),
  );
  const durationMs = progress.reduce(
    (acc, e) => acc + (typeof e.durationMs === 'number' && Number.isFinite(e.durationMs) ? e.durationMs : 0),
    0,
  );

  const contract: SessionContract = {
    buildId: `${plan.game}@UE${plan.ueVersion || 'unrecorded'}#iter${plan.iteration ?? 0}`,
    buildPath: plan.projectPath,
    // A harness run states no map, seed or difficulty. Saying so is the point.
    worldIdentity: null,
    declaredCoverage: plan.areas.map((a) => a.id),
    modules,
    durationMs,
    entryCount: progress.length,
  };

  // How many recorded iterations exist per area — the denominator every
  // frequency claim below is stated against.
  const perArea = new Map<string, { total: number; failing: number }>();
  for (const entry of progress) {
    const bucket = perArea.get(entry.areaId) ?? { total: 0, failing: 0 };
    bucket.total += 1;
    if (isFailing(entry)) bucket.failing += 1;
    perArea.set(entry.areaId, bucket);
  }

  const findings: Omit<PlaytestFinding, 'sessionId'>[] = [];
  const events: Omit<DirectorEvent, 'sessionId'>[] = [];
  const unrouted: UnroutedEntry[] = [];
  const rejected: RejectedEntry[] = [];

  let seq = 0;
  const nextId = (kind: string) => `gd-ext-${nowMs}-${kind}-${seq++}`;

  events.push({
    id: nextId('contract'),
    timestamp: stamp,
    type: 'observation',
    message:
      `External run ingested — build ${contract.buildId} at ${contract.buildPath}; ` +
      `${contract.entryCount} recorded iteration(s) over ${contract.declaredCoverage.length} declared area(s). ` +
      'World identity (map / seed / difficulty) was NOT recorded by this run, and no frame was captured: ' +
      'coverage and screenshot figures below are "not measured", not zero.',
    data: {
      buildId: contract.buildId,
      buildPath: contract.buildPath,
      worldIdentity: contract.worldIdentity,
      declaredCoverage: contract.declaredCoverage,
      entryCount: contract.entryCount,
    },
  });

  for (const entry of progress) {
    const label = areaLabel(plan, entry.areaId);

    if (!isFailing(entry)) {
      events.push({
        id: nextId('pass'),
        timestamp: entry.timestamp ?? stamp,
        type: 'system-test',
        message: `Iteration ${entry.iteration} — ${label} (${entry.moduleId}) recorded outcome=success, verification=${entry.verification ?? 'not recorded'}.`,
        data: { areaId: entry.areaId, moduleId: entry.moduleId, iteration: entry.iteration },
      });
      continue;
    }

    const pointer = evidencePointer(contract, entry);
    if (!pointer) {
      rejected.push({
        areaId: entry.areaId || '(unnamed area)',
        reason: 'no evidence pointer — the entry names no area id or no iteration, so nothing here can be re-run. A finding without a repro is a rumour, so none was filed.',
      });
      events.push({
        id: nextId('rejected'),
        timestamp: entry.timestamp ?? stamp,
        type: 'error',
        message: `A failing iteration was REFUSED as a finding: no evidence pointer (area id / iteration missing). It is counted, not filed.`,
        data: { areaId: entry.areaId, moduleId: entry.moduleId },
      });
      continue;
    }

    const category = SUB_MODULE_SET.has(entry.moduleId)
      ? MODULE_TO_FINDING_CATEGORY[entry.moduleId as SubModuleId]
      : undefined;

    if (!category) {
      unrouted.push({
        areaId: entry.areaId,
        moduleId: entry.moduleId,
        reason: `module "${entry.moduleId}" has no finding-category route; it was NOT filed under a catch-all category.`,
      });
      events.push({
        id: nextId('unrouted'),
        timestamp: entry.timestamp ?? stamp,
        type: 'error',
        message:
          `UNROUTED — iteration ${entry.iteration}, ${label} (${entry.moduleId}) failed, but no finding category owns that module. ` +
          'It is held as an unrouted entry rather than swept into a default bucket. Evidence: ' + pointer,
        data: { areaId: entry.areaId, moduleId: entry.moduleId, iteration: entry.iteration, evidence: pointer },
      });
      continue;
    }

    const freq = perArea.get(entry.areaId) ?? { total: 1, failing: 1 };
    const firstError = Array.isArray(entry.errors) && entry.errors.length > 0
      ? truncate(entry.errors[0], 400)
      : null;

    // OBSERVATION ONLY. Everything below is a field the harness measured or a
    // verbatim gate error — no causal prose, and nothing the model narrated.
    const observation = [
      `Observed: harness iteration ${entry.iteration} of area "${label}" (${entry.moduleId}) recorded action=${entry.action}, outcome=${entry.outcome}, verification=${entry.verification ?? 'not recorded'}.`,
      firstError ? `Gate output (verbatim): ${firstError}` : 'No gate output was recorded with this entry.',
      `Frequency: ${freq.failing} of ${freq.total} recorded iteration(s) for this area did not pass. This is the run's own denominator, not a rate across builds.`,
      `Repro: ${pointer}`,
    ].join('\n\n');

    // INTERPRETATION, quarantined. The harness's summary and learnings are a
    // model's causal narration of its own run; they are useful and they are not
    // observations, so they never reach the router.
    const narration: string[] = [];
    if (nonEmpty(entry.summary)) narration.push(`Agent narration (interpretation, not an observation): ${truncate(entry.summary, 500)}`);
    for (const lesson of entry.learnings ?? []) {
      if (nonEmpty(lesson)) narration.push(`Agent learning (interpretation): ${truncate(lesson, 300)}`);
    }

    findings.push({
      id: nextId('finding'),
      category,
      severity: severityFor(entry),
      title: `${label} — ${entry.outcome}${entry.verification === 'fail' ? ' (required gate failed)' : ''}`,
      description: observation,
      relatedModule: entry.moduleId,
      // No frame was captured by a harness run; claiming a screenshot ref would
      // be claiming an artifact that does not exist.
      screenshotRef: null,
      gameTimestamp: null,
      suggestedFix: narration.join('\n\n'),
      // A gate verdict is evidence, not a 0-100 confidence. Nobody scored this
      // finding, so it stays unscored rather than acquiring an invented number.
      confidence: null,
      confidenceBasis: null,
      createdAt: entry.timestamp ?? stamp,
      triageStatus: 'active',
      triageNote: '',
      snoozedUntil: null,
      fixDispatchedAt: null,
      reproAttempts: null,
      reproBuildId: contract.buildId,
      reproLastAttemptedAt: null,
    });
  }

  if (unrouted.length > 0) {
    events.push({
      id: nextId('routing-miss'),
      timestamp: stamp,
      type: 'observation',
      message:
        `Routing-table miss: ${unrouted.length} failing iteration(s) could not be routed to a finding category ` +
        `(${Array.from(new Set(unrouted.map((u) => u.moduleId))).join(', ')}). ` +
        'The size of this queue measures the routing table, not the build.',
      data: { unrouted },
    });
  }

  // Coverage is NOT MEASURED: a harness run exercises gates, it does not play
  // the game, so every playtest category is null rather than a plausible bar.
  const testCoverage = {} as Record<TestCategory, number | null>;
  for (const cat of (['combat', 'exploration', 'dialogue', 'save-load', 'ui-navigation', 'ai-behavior', 'performance-stress', 'visual-quality'] as TestCategory[])) {
    testCoverage[cat] = null;
  }

  const passing = typeof plan.verifiedFeatures === 'number' ? plan.verifiedFeatures : plan.passingFeatures;
  const basis = typeof plan.verifiedFeatures === 'number' ? 'gate-verified' : 'self-reported';
  const overallScore = Math.max(0, Math.min(100, Math.round(((passing ?? 0) / plan.totalFeatures) * 100)));

  const worst = findings.find((f) => f.severity === 'high') ?? findings[0] ?? null;

  const summary: PlaytestSummary = {
    overallScore,
    totalScreenshotsAnalyzed: null,
    systemsTested: modules,
    testCoverage,
    topIssue: worst
      ? worst.title
      : unrouted.length > 0
        ? `No finding was routed: ${unrouted.length} failing iteration(s) hit a routing-table miss.`
        : 'No failing iteration was recorded in this run.',
    topPraise: `${passing ?? 0} of ${plan.totalFeatures} planned features pass on a ${basis} basis (this score IS that ratio — no other quantity is folded into it).`,
    playtimeSeconds: null,
  };

  const config: PlaytestConfig = {
    // A harness run exercises no playtest category. Declaring one would be
    // declaring coverage it never had.
    testCategories: [],
    maxPlaytimeMinutes: Math.max(1, Math.round(durationMs / 60000)),
    screenshotIntervalSeconds: 0,
    aggressiveMode: false,
    prioritySystems: modules,
    projectId: opts.projectId,
  };

  return ok({
    contract,
    create: {
      name: opts.sessionName?.trim() || `${plan.game} harness run — ${contract.buildId}`,
      buildPath: contract.buildPath,
      config,
      source: 'external',
    },
    statuses: ['launching', 'playing', 'analyzing'],
    findings,
    events,
    summary,
    durationMs,
    systemsTestedCount: modules.length,
    unrouted,
    rejected,
  });
}

// ─── The writes ──────────────────────────────────────────────────────────────

/**
 * The external-writer surface, exactly the five route actions. Injected so the
 * ingest can be driven against the DB (the route), an HTTP client (the harness
 * script), or a recording fake (tests) without changing the mapping.
 */
export interface DirectorWriter {
  createSession(payload: CreateSessionPayload): Promise<{ id: string }>;
  updateStatus(sessionId: string, status: PlaytestStatus): Promise<void>;
  addFinding(finding: PlaytestFinding): Promise<void>;
  addEvent(event: DirectorEvent): Promise<void>;
  complete(args: {
    sessionId: string;
    summary: PlaytestSummary;
    durationMs: number;
    systemsTestedCount: number;
    findingsCount: number;
  }): Promise<void>;
}

export interface IngestDeps {
  writer: DirectorWriter;
  /** Clock, injected. Defaults to the wall clock. */
  now?: () => number;
  sessionName?: string;
  projectId?: string;
}

export interface IngestOutcome {
  sessionId: string;
  contract: SessionContract;
  findingsWritten: number;
  eventsWritten: number;
  unrouted: UnroutedEntry[];
  rejected: RejectedEntry[];
  overallScore: number;
  durationMs: number;
}

/**
 * Ingest one harness run record as an `external` Game Director session.
 *
 * Refuses (never half-writes) a record that does not satisfy the session
 * contract. Everything it does write is stamped `source: 'external'` end to end
 * — `create` declares it and `complete` re-states it — so no path here can
 * produce a session that reads as simulated, or a simulated one that reads as
 * measured.
 */
export async function ingestExternalPlaytest(
  record: unknown,
  deps: IngestDeps,
): Promise<Result<IngestOutcome, string>> {
  const validated = validateRunRecord(record);
  if (!validated.ok) return err(validated.error);

  const planned = buildIngestPlan(validated.data, {
    now: deps.now ?? (() => Date.now()),
    sessionName: deps.sessionName,
    projectId: deps.projectId,
  });
  if (!planned.ok) return err(planned.error);
  const ingest = planned.data;

  if (ingest.findings.length === 0 && ingest.unrouted.length === 0 && ingest.rejected.length === 0) {
    // Nothing failed anywhere in the run. That is a legitimate session, but it
    // must still carry its timeline — it is only "clean" inside its declared
    // coverage, and the timeline is what states that coverage.
    ingest.events.push({
      id: `gd-ext-${(deps.now ?? Date.now)()}-clean`,
      timestamp: new Date((deps.now ?? Date.now)()).toISOString(),
      type: 'observation',
      message:
        'No failing iteration was recorded. Absence of a finding is evidence only inside the coverage this run declared; outside it, absence is nothing at all.',
    });
  }

  const created = await deps.writer.createSession(ingest.create);
  const sessionId = created.id;

  for (const status of ingest.statuses) {
    await deps.writer.updateStatus(sessionId, status);
  }
  for (const event of ingest.events) {
    await deps.writer.addEvent({ ...event, sessionId });
  }
  for (const finding of ingest.findings) {
    await deps.writer.addFinding({ ...finding, sessionId });
  }
  await deps.writer.complete({
    sessionId,
    summary: ingest.summary,
    durationMs: ingest.durationMs,
    systemsTestedCount: ingest.systemsTestedCount,
    findingsCount: ingest.findings.length,
  });

  return ok({
    sessionId,
    contract: ingest.contract,
    findingsWritten: ingest.findings.length,
    eventsWritten: ingest.events.length,
    unrouted: ingest.unrouted,
    rejected: ingest.rejected,
    overallScore: ingest.summary.overallScore,
    durationMs: ingest.durationMs,
  });
}
