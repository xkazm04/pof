/**
 * L2 static-verify pass — the missing wiring that runs the catalog pipelines'
 * `staticChecks` against the REAL UE project (`Source/*.h`, `Content/Python/`) and
 * re-grades the persisted artifacts. The mechanism (`cppSymbolExists` / `seedRowPresent`
 * in `ueStaticCheckers.ts`) existed + was unit-tested but had NO production consumer; the
 * 4-tier ladder's L2 (static-against-real-UE) tier ran nowhere. This is its drain-style
 * runner: collect every artifact whose step declares `staticChecks`, run them against the
 * resolved UE root, and write the aggregated L2 verdict back — no bridge needed (pure
 * filesystem, unlike the L3/L4 drain). Operator-triggered via /api/pipeline-artifacts/verify-static.
 */
import type { AcceptanceResult } from './types';
import type { UeChecker } from './ueStaticCheckers';
import { resolveUeRoot, runChecker, withHeaderCorpus } from './ueStaticCheckers';
import { isPackagingLabel } from './packagingStep';
import { foldContentHold, holdsBackAtDataTier } from './combineVerdicts';
import { getCatalogPipeline } from '../pipeline-registry';
// Side-effect: register all pipelines. Without it a cold server grades NOTHING — getCatalogPipeline
// returns null for every step and the sweep reports an empty success (verify-static: verified 0).
import '@/lib/catalog/pipelines/registry.generated';
import { seededEntities } from '../seed';
import { realArtifactIO, createTouched, sweepRow, sweepIODeps, contentVerdictVia, type SweepFilter } from './regrade';
import type { GameId } from '@/lib/games/types';
import { DEFAULT_GAME, gameOfEntity, getGame } from '@/lib/games/registry';
import { ueRootForGame, unboundReason } from '@/lib/games/ueBinding';
import { gameRootFor, noGameRootReason } from '@/lib/games/gameRoot';
import { readGodotEvidence } from '@/lib/games/godot/readEvidence';
import { GODOT_L2_KINDS, type GodotEvidenceKind, type GodotEvidenceVerdict } from '@/lib/games/godot/evidenceTypes';

export type StaticVerifyFilter = SweepFilter;

export interface StaticVerifyRow {
  catalogId: string;
  entityId: string;
  step: string;
  from: string;
  to: string;
  detail?: string;
  reason?: string;
  changed: boolean;
}

export interface StaticVerifySummary {
  ueRoot: string | null;
  verified: number;
  passed: number;
  /** A content hold (`foldContentHold`) outranked the static verdict — author-owed work. */
  pending: number;
  deferred: number;
  failed: number;
  skipped: number;
  /** Packaging steps left to the packaging sweep, which folds their static checks into ITS
   *  verdict. Counted apart from `skipped` so the hand-off reads as a decision, not a gap. */
  delegated: number;
  changed: number;
  results: StaticVerifyRow[];
}

/** Combine a step's per-check L2 results into one verdict. Pure. Returns null when the
 *  step declares no static checks (caller skips it). All present → pass; any missing →
 *  deferred (the honest "authored but not yet realized in UE"); any fail → fail. */
export function aggregateStatic(results: AcceptanceResult[], label: string): AcceptanceResult | null {
  if (!results.length) return null;
  const fails = results.filter((r) => r.status === 'fail');
  const defers = results.filter((r) => r.status === 'deferred');
  if (fails.length) {
    return { label, tier: 'L2', status: 'fail', detail: `${fails.length}/${results.length} UE static checks failed`, reason: fails.map((f) => f.reason ?? f.detail).filter(Boolean).join('; ') };
  }
  if (defers.length) {
    return {
      label, tier: 'L2', status: 'deferred',
      detail: `${results.length - defers.length}/${results.length} UE static checks present`,
      reason: defers.map((d) => d.reason ?? d.detail).filter(Boolean).join('; '),
    };
  }
  return { label, tier: 'L2', status: 'pass', detail: `${results.length}/${results.length} UE static checks present` };
}

/** The L2 verdict for a step whose entity belongs to a game with no engine project bound: deferred
 *  with the game's reason — never `fail`, and never graded against PoF's UE root. A godot game's reason
 *  names its missing game root (`noGameRootReason`: the env var and the declared `engine.root`). */
export function unboundStaticVerdict(game: GameId, label: string): AcceptanceResult {
  const reason = getGame(game).engine.kind === 'godot' ? noGameRootReason(game) : unboundReason(game);
  return { label, tier: 'L2', status: 'deferred', detail: 'engine project unbound', reason };
}

/**
 * Run a step's checks against the root of the ENTITY's game. PoF reads `pofRoot` (resolved once per
 * sweep, exactly as before); another game reads its own binding and, when that is unbound, defers
 * without running a single checker. A GODOT game never runs the UE checkers: its L2 verdict is the
 * game-written `lint` + `unit-tests` evidence (`godotL2Verdict`), read from `gameRootFor(id)`; a null
 * game root defers with `noGameRootReason`. Pure over its inputs.
 */
export function staticVerdictForGame(
  checks: UeChecker[], label: string, game: GameId, pofRoot: string | null, rootForGame: (id: GameId) => string | null,
  godot: GodotL2Deps = defaultGodotL2,
): AcceptanceResult | null {
  if (game === DEFAULT_GAME) return aggregateStatic(checks.map((c) => runChecker(c, pofRoot)), label);
  if (getGame(game).engine.kind === 'godot') {
    if (!checks.length) return null;
    const gameRoot = godot.rootFor(game);
    if (gameRoot === null) return unboundStaticVerdict(game, label);
    return godotL2Verdict(label, (kind) => godot.read(gameRoot, kind, game));
  }
  const root = rootForGame(game);
  if (root === null) return checks.length ? unboundStaticVerdict(game, label) : null;
  return aggregateStatic(checks.map((c) => runChecker(c, root)), label);
}

// ── Godot L2: the game-written evidence (pof.godot-evidence/1) stands in for the UE checkers ──

/** How the godot branch finds the game root and reads one evidence kind. Injected by tests. */
export interface GodotL2Deps {
  rootFor: (id: GameId) => string | null;
  read: (root: string, kind: GodotEvidenceKind, game: GameId) => GodotEvidenceVerdict;
}

export const defaultGodotL2: GodotL2Deps = {
  rootFor: (id) => gameRootFor(id),
  read: (root, kind, game) => readGodotEvidence(root, kind, { gameId: game }),
};

/** L2 for a godot game: `lint` and `unit-tests` both pass → pass; any fail → fail; otherwise deferred,
 *  the reason naming each kind that is not yet a pass. Pure over `read`. */
export function godotL2Verdict(label: string, read: (kind: GodotEvidenceKind) => GodotEvidenceVerdict): AcceptanceResult {
  const got = GODOT_L2_KINDS.map((kind) => ({ kind, v: read(kind) }));
  const fails = got.filter((g) => g.v.status === 'fail');
  const why = (gs: typeof got) => gs.map((g) => `${g.kind}: ${g.v.reason ?? g.v.detail}`).join('; ');
  if (fails.length) {
    return { label, tier: 'L2', status: 'fail', detail: `${fails.length}/${got.length} Godot evidence kinds failed`, reason: why(fails) };
  }
  const waiting = got.filter((g) => g.v.status !== 'pass');
  if (waiting.length) {
    return { label, tier: 'L2', status: 'deferred', detail: `${got.length - waiting.length}/${got.length} Godot evidence kinds pass`, reason: why(waiting) };
  }
  return { label, tier: 'L2', status: 'pass', detail: got.map((g) => g.v.detail).join(' · ') };
}

/** Lives in combineVerdicts (both sweeps fold through it); re-exported for existing importers. */
export { holdsBackAtDataTier };

export interface StaticVerifyDeps {
  resolveUeRoot: () => string | null;
  /** The artifacts to grade (persisted steps). */
  listArtifacts: (filter: StaticVerifyFilter) => { catalogId: string; entityId: string; step: string; status: string }[];
  /** The step's `staticChecks(entity)` for this artifact, or null when the step has none. */
  getStaticChecks: (catalogId: string, entityId: string, step: string) => UeChecker[] | null;
  /** Write the re-graded L2 verdict back to the artifact (preserving its data/assets). */
  upsertStatus: (catalogId: string, entityId: string, step: string, res: AcceptanceResult) => void;
  /** Steps whose status the packaging sweep owns. Optional so a hand-built dep set needs no
   *  change; absent → nothing is delegated. */
  isPackaging?: (catalogId: string, step: string) => boolean;
  /** The step's own content checker, re-run on the stored data (raw — no judge overlay).
   *  Optional so a hand-built dep set needs no change; absent → the static verdict stands. */
  getContentVerdict?: (catalogId: string, entityId: string, step: string) => AcceptanceResult | null;
  /** Re-derive one entity's lifecycle cache, once per entity an APPLY run wrote. Optional; absent
   *  → no sync (a stage, a hand-built dep set). */
  syncLifecycle?: (catalogId: string, entityId: string) => void;
  /** The game an artifact's entity belongs to (`gameOfEntity`), which picks the UE root its checks
   *  read. Optional; absent → every row is PoF's and reads `resolveUeRoot()` (today's behaviour). */
  entityGame?: (catalogId: string, entityId: string) => GameId;
  /** A non-PoF game's engine root (null = unbound → deferred). Optional; absent → `ueRootForGame`. */
  ueRootForGame?: (id: GameId) => string | null;
  /** A godot game's root + evidence reader. Optional; absent → `defaultGodotL2` (gameRootFor + readGodotEvidence). */
  godot?: GodotL2Deps;
}

/**
 * Run the L2 static checks for every persisted artifact whose step declares them, against
 * the resolved UE root, and write the verdict back. `opts.apply === false` makes it a
 * dry-run preview (no writes). Pure orchestration over the injected deps (no fs/db here),
 * so it's unit-tested without a UE project or SQLite.
 */
export function verifyStaticAll(
  filter: StaticVerifyFilter,
  deps: StaticVerifyDeps,
  opts?: { apply?: boolean },
): StaticVerifySummary {
  // One header-corpus read per sweep, dropped when it ends (see `withHeaderCorpus`).
  return withHeaderCorpus(() => verifyStaticSweep(filter, deps, opts));
}

function verifyStaticSweep(
  filter: StaticVerifyFilter,
  deps: StaticVerifyDeps,
  opts?: { apply?: boolean },
): StaticVerifySummary {
  const ueRoot = deps.resolveUeRoot();
  const apply = opts?.apply !== false;
  const results: StaticVerifyRow[] = [];
  let verified = 0, passed = 0, pending = 0, deferred = 0, failed = 0, skipped = 0, delegated = 0, changed = 0;
  const touched = createTouched();
  // One binding lookup per non-PoF game per sweep (a ue5 root is an fs probe).
  const gameRoots = new Map<GameId, string | null>();
  const rootForGame = (id: GameId): string | null => {
    if (!gameRoots.has(id)) gameRoots.set(id, (deps.ueRootForGame ?? ueRootForGame)(id));
    return gameRoots.get(id) ?? null;
  };
  // Same once-per-sweep rule for a godot game's root (an fs probe) and for each evidence read (a file
  // read + a `git rev-parse`): every row of one game shares one reading of its tree.
  const godotDeps = deps.godot ?? defaultGodotL2;
  const godotRoots = new Map<GameId, string | null>();
  const godotReads = new Map<string, GodotEvidenceVerdict>();
  const godot: GodotL2Deps = {
    read: (root, kind, game) => {
      const key = `${game}|${kind}|${root}`;
      if (!godotReads.has(key)) godotReads.set(key, godotDeps.read(root, kind, game));
      return godotReads.get(key) as GodotEvidenceVerdict;
    },
    rootFor: (id) => {
      if (!godotRoots.has(id)) godotRoots.set(id, godotDeps.rootFor(id));
      return godotRoots.get(id) ?? null;
    },
  };

  for (const a of deps.listArtifacts(filter)) {
    // A packaging step answers to BOTH its static checks and its package's disk truth; if each
    // sweep wrote the status alone, whichever ran last would launder the other's missing half
    // (bestiary-melee-grunt: static pass over six unrealized /Game declarations).
    if (deps.isPackaging?.(a.catalogId, a.step)) { delegated++; continue; }
    const checks = deps.getStaticChecks(a.catalogId, a.entityId, a.step);
    if (!checks || !checks.length) { skipped++; continue; }
    const game = deps.entityGame?.(a.catalogId, a.entityId) ?? DEFAULT_GAME;
    const staticVerdict = staticVerdictForGame(checks, a.step, game, ueRoot, rootForGame, godot);
    if (!staticVerdict) { skipped++; continue; }
    // A symbol existing in UE says nothing about the content: static may never lift a row its
    // own checker holds back at the data tiers — pending/fail (the d1 Stat Blocks' declared
    // `moveSpeed` gap) or deferred at L0-L2 (off-arc-fp's unresolved vfx link). A deferral at
    // L3/L4 belongs to a runtime gate the drain resolves, so it leaves the static verdict standing.
    // A content hold outranks a static deferral: author-owed work never reads as env-waiting.
    const verdict = foldContentHold(staticVerdict, deps.getContentVerdict?.(a.catalogId, a.entityId, a.step) ?? null);

    verified++;
    if (verdict.status === 'pass') passed++;
    else if (verdict.status === 'pending') pending++;
    else if (verdict.status === 'deferred') deferred++;
    else if (verdict.status === 'fail') failed++;

    const row = sweepRow(a, verdict);
    if (row.changed && apply) { deps.upsertStatus(a.catalogId, a.entityId, a.step, verdict); changed++; touched.add(a.catalogId, a.entityId); }
    results.push(row);
  }
  touched.flush(deps.syncLifecycle);

  return { ueRoot, verified, passed, pending, deferred, failed, skipped, delegated, changed, results };
}

// ── default (server) deps — wire the real registry / seed / UE root / artifacts db ──
/** The step's declared `staticChecks` for one seeded entity, or null when it has none. */
export function staticChecksFor(catalogId: string, entityId: string, step: string): UeChecker[] | null {
  const pipeline = getCatalogPipeline(catalogId);
  const spec = pipeline?.steps.find((s) => s.label === step);
  if (!spec?.staticChecks) return null;
  const entity = seededEntities(catalogId).find((e) => e.id === entityId);
  if (!entity) return null;
  return spec.staticChecks({ id: entity.id, name: entity.name, lifecycle: entity.lifecycle, data: entity.data });
}

/** The game a seeded/persisted entity belongs to, derived from its canon profile. An entity the
 *  server cannot resolve has no checks either (`staticChecksFor` → null), so `pof` is moot there. */
export function entityGameFor(catalogId: string, entityId: string): GameId {
  const entity = seededEntities(catalogId).find((e) => e.id === entityId);
  return entity ? gameOfEntity(entity) : DEFAULT_GAME;
}

/** The step's own content checker re-run RAW on the STORED data (`contentVerdictVia` over the
 *  real store), or null when no row / no checker — what the lab's package panel folds in. */
export function contentVerdictFor(catalogId: string, entityId: string, step: string): AcceptanceResult | null {
  return contentVerdictVia(realArtifactIO)(catalogId, entityId, step);
}

export const defaultStaticVerifyDeps: StaticVerifyDeps = {
  resolveUeRoot,
  getStaticChecks: staticChecksFor,
  isPackaging: isPackagingLabel,
  entityGame: entityGameFor,
  ...sweepIODeps(realArtifactIO),
};

/** One step's aggregated L2 static verdict against the UE root of the entity's GAME, or null when
 *  the step declares no checks — what the packaging sweep folds into a packaging step's grade. */
export function staticVerdictFor(catalogId: string, entityId: string, step: string): AcceptanceResult | null {
  const checks = staticChecksFor(catalogId, entityId, step);
  if (!checks?.length) return null;
  const game = entityGameFor(catalogId, entityId);
  return staticVerdictForGame(checks, step, game, game === DEFAULT_GAME ? resolveUeRoot() : null, ueRootForGame);
}
