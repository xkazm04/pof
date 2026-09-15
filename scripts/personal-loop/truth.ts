/**
 * Shared truth loader for the /personal-loop scripts.
 *
 * Builds the SAME lanes /status?tab=pipelines paints: `buildSwimlane` per registered
 * pipeline, `sortLanes` for the top-to-bottom order, `readinessOf` for the R rung and
 * `craftForCell` for the A axis. Row mapping reuses the DB modules' own pure mappers so a
 * load-bearing column (`updated_at`, `content_hash`) can never be dropped here and grade a
 * verdict differently than the map does. Reads SQLite read-only; no dev server needed.
 */
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { buildSwimlane, sortLanes, getStepFact, isSyntheticEntity, type Swimlane, type StepCell, type StepFact } from '@/lib/status/statusModel';
import { readinessOf, type Readiness } from '@/lib/status/readiness';
import { craftForCell, type CellCraft } from '@/lib/craft/craftCell';
import { rowToArtifact, type PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { rowToVerdict, type JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { rowToCraftVerdict, type CraftVerdict } from '@/lib/craft/craft-verdicts-db';

const DB_PATH = process.env.POF_DB_PATH ?? join(homedir(), '.pof', 'pof.db');

export interface Truth {
  artifacts: PipelineArtifact[];
  verdicts: JudgeVerdict[];
  craft: CraftVerdict[];
}

function selectAll(db: Database.Database, table: string): Record<string, unknown>[] {
  try {
    return db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  } catch {
    // A table that does not exist yet is an unjudged / ungauged map — a valid state.
    return [];
  }
}

export function readTruth(): Truth {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    return {
      artifacts: selectAll(db, 'pipeline_artifacts').map(rowToArtifact),
      verdicts: selectAll(db, 'judge_verdicts').map(rowToVerdict),
      craft: selectAll(db, 'craft_verdicts').map(rowToCraftVerdict),
    };
  } finally {
    db.close();
  }
}

const groupBy = <T>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
};

/** The /status lanes, in /status order. */
export function loadLanes(truth: Truth = readTruth()): Swimlane[] {
  const arts = groupBy(truth.artifacts, (a) => a.catalogId);
  const vers = groupBy(truth.verdicts, (v) => v.catalogId);
  const lanes = allCatalogPipelines().map((p) =>
    buildSwimlane(
      p.catalogId,
      p.catalogId,
      p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine })),
      arts.get(p.catalogId) ?? [],
      vers.get(p.catalogId) ?? [],
    ),
  );
  return sortLanes(lanes);
}

export interface EntityReading {
  entityId: string;
  status: PipelineArtifact['status'];
  tier?: string;
  reason?: string;
  judge?: { verdict: JudgeVerdict['verdict']; score: number; rubricVersion?: number; findings: string };
  aLevel?: string;
}

export interface CellReading {
  catalogId: string;
  step: string;
  /** Scope of the reading: the whole cell, or one pilot entity. */
  scope: 'cell' | { entityId: string };
  engine: string;
  grade: StepCell['grade'];
  r: Readiness;
  a?: { level: CellCraft['craft']['level']; state: CellCraft['craft']['state']; because: string; ceiling: string; lens: string; deliverable: string };
  fact?: Pick<StepFact, 'deliverable' | 'generatorWired' | 'judge' | 'checkerMeaningful' | 'trueEngine' | 'note'>;
  counts: StepCell['counts'];
  judged?: StepCell['judged'];
  entities: EntityReading[];
}

/**
 * Read one cell exactly as the map would — or, with `entityId`, the same derivation run over
 * only that entity's artifact + verdicts (the pilot's own rung). Returns undefined when the
 * catalog/step is not registered.
 */
export function readCell(catalogId: string, step: string, entityId?: string, truth: Truth = readTruth()): CellReading | undefined {
  const pipeline = allCatalogPipelines().find((p) => p.catalogId === catalogId);
  const meta = pipeline?.steps.find((s) => s.label === step);
  if (!pipeline || !meta) return undefined;

  const inCell = <T extends { catalogId: string; step: string; entityId: string }>(x: T) =>
    x.catalogId === catalogId && x.step === step && !isSyntheticEntity(x.entityId) && (!entityId || x.entityId === entityId);
  const artifacts = truth.artifacts.filter(inCell);
  const verdicts = truth.verdicts.filter(inCell);
  const craft = truth.craft.filter(inCell);

  const lane = buildSwimlane(catalogId, catalogId, [{ label: meta.label, archetype: meta.archetype, engine: meta.engine }], artifacts, verdicts);
  const cell = lane.cells[0];
  const updated = new Map(artifacts.filter((a) => a.updatedAt).map((a) => [a.entityId, a.updatedAt!]));
  const cc = craftForCell(catalogId, step, craft, updated);
  const fact = getStepFact(catalogId, step);

  const latestJudge = groupBy(verdicts, (v) => v.entityId);
  const craftByEntity = new Map(craft.map((c) => [c.entityId, c.aLevel]));
  return {
    catalogId,
    step,
    scope: entityId ? { entityId } : 'cell',
    engine: cell.engine,
    grade: cell.grade,
    r: readinessOf(cell),
    ...(cc
      ? { a: { level: cc.craft.level, state: cc.craft.state, because: cc.craft.because, ceiling: cc.ceiling, lens: cc.lens, deliverable: cc.deliverable } }
      : {}),
    ...(fact
      ? { fact: { deliverable: fact.deliverable, generatorWired: fact.generatorWired, judge: fact.judge, checkerMeaningful: fact.checkerMeaningful, trueEngine: fact.trueEngine, note: fact.note } }
      : {}),
    counts: cell.counts,
    ...(cell.judged ? { judged: cell.judged } : {}),
    entities: artifacts
      .map((a): EntityReading => {
        const v = (latestJudge.get(a.entityId) ?? []).sort((x, y) => (y.judgedAt ?? '').localeCompare(x.judgedAt ?? ''))[0];
        return {
          entityId: a.entityId,
          status: a.status,
          ...(a.tier ? { tier: a.tier } : {}),
          ...(a.reason ? { reason: a.reason } : {}),
          ...(v ? { judge: { verdict: v.verdict, score: v.score, findings: v.findings, ...(v.rubricVersion != null ? { rubricVersion: v.rubricVersion } : {}) } } : {}),
          ...(craftByEntity.has(a.entityId) ? { aLevel: craftByEntity.get(a.entityId) } : {}),
        };
      })
      .sort((x, y) => x.entityId.localeCompare(y.entityId)),
  };
}

/** Obsidian vault root for the loop's memory. */
export function personalDir(): string {
  const vault = process.env.POF_PERSONAL_VAULT ?? 'C:/Users/kazda/Documents/Obsidian/pof';
  return join(vault, 'Personal');
}
