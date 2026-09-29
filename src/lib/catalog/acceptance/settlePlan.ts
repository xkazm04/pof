/**
 * Catalog re-settle — the pure half of `/api/pipeline-artifacts/settle`.
 *
 * After any campaign the operator re-runs the idempotent filesystem truth passes. Their order
 * matters in one place only: bind-icons rewrites gallery siblings that verify-packaging then
 * packages, so bind-icons runs first. (verify-static and verify-packaging do not depend on each
 * other: static DELEGATES packaging rows, and packaging runs the step's static checks fresh via
 * `staticVerdictFor`.) The three summaries already share the `{ catalogId, entityId, step,
 * from, to }` row, so `planSettle` folds them into ordered pass lines with lifts, drops and the
 * cause — a silent pass → deferred downgrade becomes a named line BEFORE anything is written.
 *
 * The preview must write NOTHING, yet the passes only chain truthfully when a later pass sees
 * an earlier pass's writes. So the route runs each pass in apply mode against a STAGE:
 * `createArtifactStage` holds staged verdicts/data in memory and overlays them on the stored
 * rows, and `stagedFs` keeps packaging's writes (materialized art, manifest.json) in a Map —
 * `verifyPackagingAll(apply:false)` over the real fs deps would still rebuild packages on disk.
 *
 * Pure: no fs, no db. Injected bases only.
 */
import type { PackagingFsDeps } from '../packaging/packageArtifacts';

export const SETTLE_ORDER = ['bind-icons', 'verify-static', 'verify-packaging'] as const;
export type SettlePassId = (typeof SETTLE_ORDER)[number];

/** The shared row shape of the three pass summaries (bind's `detail` doubles as its reason). */
export interface SettleRow {
  catalogId: string;
  entityId: string;
  step: string;
  from: string;
  to: string;
  reason?: string;
  detail?: string;
  /** Carried by the pass summaries; the plan derives moves from from/to and drops it. */
  changed?: boolean;
}

export interface SettlePassPlan {
  pass: SettlePassId;
  /** Rows the pass graded (moved or not). */
  examined: number;
  lifts: number;
  drops: number;
  /** `from → to` deltas, most frequent first. */
  moves: { label: string; count: number }[];
  /** Why the pass cannot lift (or what the drops share) — null when nothing needs saying. */
  cause: string | null;
  /** What would change the cause, when there is a known remedy. */
  remedy?: string;
  rows: SettleRow[];
}

export interface SettlePlan {
  passes: SettlePassPlan[];
  totals: { lifts: number; drops: number };
}

export interface SettleInputs {
  bindIcons: { library: number; results: SettleRow[] };
  static: { ueRoot: string | null; results: SettleRow[] };
  packaging: { results: SettleRow[]; exempt?: { catalogId: string; reason: string }[] };
}

/** Verdict rank: a move to a higher rank lifts, to a lower one drops. */
const RANK: Record<string, number> = { pass: 3, deferred: 2, pending: 1, fail: 0 };
const rank = (s: string) => RANK[s] ?? 1;

function tally(labels: string[]): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of labels) m.set(l, (m.get(l) ?? 0) + 1);
  return [...m].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function passPlan(pass: SettlePassId, rows: SettleRow[], fixed: { cause: string; remedy?: string } | null): SettlePassPlan {
  const moved = rows.filter((r) => r.from !== r.to);
  const dropped = moved.filter((r) => rank(r.to) < rank(r.from));
  const lifts = moved.filter((r) => rank(r.to) > rank(r.from)).length;
  // No fixed cause → the drops' most common reason (bind rows carry it in `detail`).
  const dropCause = tally(dropped.map((r) => r.reason ?? r.detail ?? '').filter(Boolean))[0]?.label ?? null;
  return {
    pass,
    examined: rows.length,
    lifts,
    drops: dropped.length,
    moves: tally(moved.map((r) => `${r.from} → ${r.to}`)),
    cause: fixed?.cause ?? dropCause,
    ...(fixed?.remedy ? { remedy: fixed.remedy } : {}),
    rows: rows.map(({ catalogId, entityId, step, from, to, reason, detail }) => ({
      catalogId, entityId, step, from, to, ...(reason ? { reason } : {}), ...(detail ? { detail } : {}),
    })),
  };
}

/** Fold the three pass summaries into the ordered settle plan. Pure. */
export function planSettle(inputs: SettleInputs): SettlePlan {
  const exempt = inputs.packaging.exempt ?? [];
  const passes = [
    passPlan('bind-icons', inputs.bindIcons.results, inputs.bindIcons.library === 0
      ? { cause: 'icon library empty', remedy: 'generate art into generated/icons/ — the pass binds only files already on disk' }
      : null),
    passPlan('verify-static', inputs.static.results, inputs.static.ueRoot === null
      ? { cause: 'UE root not resolved', remedy: 'set POF_UE_ROOT to the UE project checkout — without it every static check reads "not present"' }
      : null),
    passPlan('verify-packaging', inputs.packaging.results, inputs.packaging.results.length === 0 && exempt.length > 0
      ? { cause: `exempt by declaration: ${exempt.map((e) => e.reason).join('; ')}` }
      : null),
  ];
  return {
    passes,
    totals: {
      lifts: passes.reduce((n, p) => n + p.lifts, 0),
      drops: passes.reduce((n, p) => n + p.drops, 0),
    },
  };
}

/**
 * Apply only what was previewed (the purge-fixtures `expectRows` precedent): a settle that
 * would drop verdicts runs only when `confirmDrops` equals the FRESH drop count. Returns the
 * 409 message, or null when the apply may proceed. Pure.
 */
export function confirmDropsRefusal(confirmDrops: unknown, freshDrops: number): string | null {
  const confirmed = typeof confirmDrops === 'number' ? confirmDrops : null;
  if (confirmed === null) {
    if (freshDrops === 0) return null;
    return `This settle would drop ${freshDrops} verdict${freshDrops === 1 ? '' : 's'} — POST confirmDrops: ${freshDrops} after reading the preview. Nothing was written.`;
  }
  if (confirmed !== freshDrops) {
    return `Drops changed since you looked — you confirmed ${confirmed}, the fresh preview now shows ${freshDrops}. Nothing was written; re-read the preview and confirm again.`;
  }
  return null;
}

/** Packaging fs deps whose writes and dirs live in memory; reads consult memory, then disk. */
export function stagedFs(base: PackagingFsDeps): PackagingFsDeps {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  const norm = (p: string) => p.replace(/\\/g, '/');
  return {
    ...base,
    exists: (p) => files.has(norm(p)) || dirs.has(norm(p)) || base.exists(p),
    readFile: (p) => files.get(norm(p)) ?? base.readFile(p),
    writeFile: (p, c) => { files.set(norm(p), typeof c === 'string' ? Buffer.from(c) : c); },
    mkdir: (p) => { dirs.add(norm(p)); },
  };
}

export interface StagedRow {
  status: string;
  data?: Record<string, unknown>;
  tier?: string;
  reason?: string;
}

export interface ArtifactStage {
  save: (catalogId: string, entityId: string, step: string, row: StagedRow) => void;
  get: (catalogId: string, entityId: string, step: string) => StagedRow | undefined;
  /** The stored rows with every staged write laid over them (input never mutated). */
  overlay: <T extends { catalogId: string; entityId: string; step: string; status: string; data?: Record<string, unknown> }>(rows: T[]) => T[];
}

/** An in-memory artifact layer: what the preview's passes "wrote", visible to the next pass. */
export function createArtifactStage(): ArtifactStage {
  const staged = new Map<string, StagedRow>();
  const key = (c: string, e: string, s: string) => `${c}\u0000${e}\u0000${s}`;
  return {
    save: (c, e, s, row) => {
      const prev = staged.get(key(c, e, s));
      staged.set(key(c, e, s), { ...prev, ...row, ...(row.data ?? prev?.data ? { data: row.data ?? prev?.data } : {}) });
    },
    get: (c, e, s) => staged.get(key(c, e, s)),
    overlay: (rows) => rows.map((a) => {
      const st = staged.get(key(a.catalogId, a.entityId, a.step));
      return st ? { ...a, status: st.status, ...(st.data ? { data: st.data } : {}) } : a;
    }),
  };
}
