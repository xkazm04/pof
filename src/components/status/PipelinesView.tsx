'use client';

/**
 * Pipelines tab — the pipeline-centric health map (one swimlane per catalog, one cell
 * per step; the cell names its engine and its background is its rung on the ONE
 * production-readiness ladder, `@/lib/status/readiness`). Extracted from the original
 * StatusDashboard body so the dashboard shell can host it alongside the Item Focus tab.
 *
 * Click-through: a lane's label (and any of its cells) opens Item Focus on that
 * catalog — the entity-centric complement — via `onFocusCatalog`.
 */
import { useEffect, useMemo, useState } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import { tryApiFetch } from '@/lib/api-utils';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { buildSwimlane, sortLanes, getStepFact, type Swimlane, type StepCell } from '@/lib/status/statusModel';
import {
  readinessOf,
  LADDER,
  RAMP,
  READINESS_NAME,
  READINESS_MEANING,
  BLOCKED_TOKEN,
  STATE_GLYPH,
  type ReadinessLevel,
  type ReadinessState,
} from '@/lib/status/readiness';
import { capabilityClassOf } from '@/lib/status/capabilityModel';
import { craftForCell, cellDistanceToRoof, type CellCraft, type CraftVerdictView } from '@/lib/craft/craftCell';
import { StatusCell } from './StatusCell';
import { EvidenceModal } from './EvidenceModal';

/** True when a step belongs to the given capability class (via its audited deliverable). */
function cellInClass(catalogId: string, cell: StepCell, klass: string | null): boolean {
  if (!klass) return true;
  const fact = getStepFact(catalogId, cell.label);
  if (!fact) return false;
  return capabilityClassOf(fact.deliverable, catalogId) === klass;
}

/** `readiness` picks out a rung (only cells that REACHED it); `state` picks out the two
 *  off-ladder states (waiting / blocked); `engine` is unchanged. */
type Highlight = { kind: 'readiness' | 'state' | 'engine'; value: string } | null;

function cellMatches(cell: StepCell, hl: Highlight): boolean {
  if (!hl) return true;
  if (hl.kind === 'engine') return cell.engine === hl.value;
  const r = readinessOf(cell);
  if (hl.kind === 'state') return r.state === hl.value;
  return r.state === 'reached' && r.level === hl.value;
}

/** Swatch for a chip / legend entry, matching exactly how the cell paints that rung:
 *  solid for a reached rung, hatched for `waiting`, solid red for `blocked`. */
function swatchStyle(token: string, fill: number, hatched = false): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: 2,
    border: `1px solid color-mix(in srgb, ${token} 70%, transparent)`,
    background: hatched
      ? `repeating-linear-gradient(45deg, color-mix(in srgb, ${token} ${fill}%, transparent) 0 3px, transparent 3px 6px)`
      : fill === 0
        ? 'transparent'
        : `color-mix(in srgb, ${token} ${fill}%, transparent)`,
  };
}

/** Highlight chip. `count` is the number of cells the chip picks out, so the number on
 *  the chip is exactly what clicking it un-dims (never an unrelated total). A chip that
 *  would highlight nothing is disabled — clicking it would ghost the whole map with no
 *  explanation — unless it is the active one, which must stay clickable to toggle off. */
function Chip({
  label,
  count,
  swatch,
  active,
  disabled = false,
  title,
  onClick,
}: {
  label: string;
  count?: number;
  /** Pre-built swatch style (see `swatchStyle`) so a chip paints exactly like the cells
   *  it selects — a hatched chip picks out hatched cells. */
  swatch?: React.CSSProperties;
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="focus-ring"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--lab-s1)',
        padding: 'var(--lab-s1) var(--lab-s2)',
        fontSize: 'var(--lab-fs-xs)',
        fontFamily: 'var(--lab-font-mono)',
        color: 'var(--lab-text)',
        background: active ? 'color-mix(in srgb, var(--lab-ink) 22%, transparent)' : 'transparent',
        border: `1px solid ${active ? 'var(--lab-ink)' : 'var(--lab-line)'}`,
        borderRadius: 'var(--lab-r-sm)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {swatch && <span aria-hidden="true" style={swatch} />}
      {label}
      {count !== undefined && <span style={{ color: 'var(--text-subtle)' }}>({count})</span>}
    </button>
  );
}

/** The whole scale in one line. Worth the space only because there is now ONE of them —
 *  the old grade-fill × tier-stripe pairing had 40 combinations and no legend could hold
 *  it. Static (never filtered), so it always states the full ladder even when a chip has
 *  dimmed the map to nothing. */
function Legend() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--lab-s3)',
        padding: 'var(--lab-s2) var(--lab-s3)',
        marginBottom: 'var(--lab-s3)',
        fontSize: 'var(--lab-fs-xs)',
        fontFamily: 'var(--lab-font-mono)',
        color: 'var(--lab-muted)',
        border: '1px solid var(--lab-line)',
        borderRadius: 'var(--lab-r-sm)',
      }}
    >
      <span style={{ color: 'var(--lab-text)', fontWeight: 700 }}>ladder</span>
      {LADDER.map((level: ReadinessLevel) => (
        <span key={level} title={READINESS_MEANING[level]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span aria-hidden="true" style={swatchStyle(RAMP[level].token, RAMP[level].fill)} />
          <span style={{ color: 'var(--lab-text)' }}>{level}</span> {READINESS_NAME[level]}
        </span>
      ))}
      <span aria-hidden="true" style={{ width: 1, height: 14, background: 'var(--lab-line)' }} />
      <span title="A gate that would prove the step is declared but has never been run. Not a rung — hatched at the rung it is aiming for." style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span aria-hidden="true" style={swatchStyle(RAMP.R4.token, RAMP.R4.fill, true)} />
        <span style={{ color: 'var(--lab-text)' }}>{STATE_GLYPH.waiting}</span> WAITING
      </span>
      <span title="A checker or a judge condemned the output." style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span aria-hidden="true" style={swatchStyle(BLOCKED_TOKEN, 30)} />
        <span style={{ color: 'var(--lab-text)' }}>{STATE_GLYPH.blocked}</span> BLOCKED
      </span>
      <span aria-hidden="true" style={{ width: 1, height: 14, background: 'var(--lab-line)' }} />
      <span title="The PARALLEL craft axis on each cell's second line: how the output measures against real AAA practice (A0 UNGAUGED, A1 HOBBY, A2 INDIE, A3 AA, A4 AAA-PARITY). ^ = at the medium's recorded roof (an achievement — e.g. 3D meshes cap at A2 by market assumption). ~ = content changed since it was gauged. Orthogonal to the R-ladder and provably display-only.">
        <span style={{ color: 'var(--lab-text)' }}>A0–A4</span> craft · ^ at roof · ~ stale
      </span>
    </div>
  );
}

/** Shared retry affordance for the two degraded-load surfaces below. */
function RetryButton({ onClick, label = 'Retry' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      className="focus-ring"
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: 'var(--lab-s1) var(--lab-s2)',
        fontSize: 'var(--lab-fs-xs)',
        fontFamily: 'var(--lab-font-mono)',
        fontWeight: 700,
        color: 'var(--lab-ink)',
        background: 'transparent',
        border: '1px solid var(--lab-ink)',
        borderRadius: 'var(--lab-r-sm)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export function PipelinesView({
  onFocusCatalog,
  filterClass = null,
  onClearFilter,
}: {
  onFocusCatalog: (catalogId: string) => void;
  /** Optional capability-class filter (from the Capability tab): only steps whose
   *  deliverable maps to this class render, and lanes with zero matching steps hide. */
  filterClass?: string | null;
  onClearFilter?: () => void;
}) {
  const [lanes, setLanes] = useState<Swimlane[] | null>(null);
  /** Non-null when the map could not be loaded at all — the view must SAY so rather than
   *  sit on "Loading…" forever (an honesty dashboard cannot fail silently). */
  const [error, setError] = useState<string | null>(null);
  /** True when the map rendered but judge verdicts did not load: grades below then reflect
   *  gate/checker status only, so a judged pass/fail is missing. Say it, don't hide it. */
  const [verdictsDegraded, setVerdictsDegraded] = useState(false);
  /** The parallel A-axis (craft) readings, keyed `catalogId step`. Null while loading OR
   *  when the craft fetch failed — an absent chip means "not loaded", never a painted A0
   *  (painting UNGAUGED over a fetch failure would fabricate an audit result). */
  const [craftByKey, setCraftByKey] = useState<Map<string, CellCraft> | null>(null);
  const [craftDegraded, setCraftDegraded] = useState(false);
  const [reload, setReload] = useState(0);
  const [highlight, setHighlight] = useState<Highlight>(null);
  // Clicking a cell opens the evidence modal (the stored output the gate evaluated),
  // NOT Item Focus — so a verdict can be audited against its actual proof.
  const [evidence, setEvidence] = useState<{ catalogId: string; step: string; cell: StepCell } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pipelines = allCatalogPipelines();
        const [verdictRes, craftRes] = await Promise.all([
          tryApiFetch<JudgeVerdict[]>('/api/judge-verdicts'),
          tryApiFetch<CraftVerdictView[]>('/api/craft-verdicts'),
        ]);
        const allVerdicts = verdictRes.ok ? verdictRes.data : [];
        if (alive) setVerdictsDegraded(!verdictRes.ok);
        if (alive) setCraftDegraded(!craftRes.ok);
        const byCatalog = new Map<string, JudgeVerdict[]>();
        for (const v of allVerdicts) {
          const list = byCatalog.get(v.catalogId) ?? [];
          list.push(v);
          byCatalog.set(v.catalogId, list);
        }
        const craftByCatalog = new Map<string, CraftVerdictView[]>();
        for (const v of craftRes.ok ? craftRes.data : []) {
          const list = craftByCatalog.get(v.catalogId) ?? [];
          list.push(v);
          craftByCatalog.set(v.catalogId, list);
        }
        const craft = craftRes.ok ? new Map<string, CellCraft>() : null;
        const results = await Promise.all(
          pipelines.map(async (p) => {
            const artifacts: PipelineArtifact[] = await fetchArtifacts(p.catalogId);
            const metas = p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine }));
            if (craft) {
              // Per-step entity → current artifact updatedAt: the staleness anchor a
              // craft gauge is projected against (a verdict older than a re-produce
              // must read as stale, never current).
              const updatedByStep = new Map<string, Map<string, string>>();
              for (const a of artifacts) {
                if (!a.updatedAt) continue;
                const m = updatedByStep.get(a.step) ?? new Map<string, string>();
                m.set(a.entityId, a.updatedAt);
                updatedByStep.set(a.step, m);
              }
              for (const s of p.steps) {
                const c = craftForCell(
                  p.catalogId,
                  s.label,
                  craftByCatalog.get(p.catalogId) ?? [],
                  updatedByStep.get(s.label) ?? new Map(),
                );
                if (c) craft.set(`${p.catalogId} ${s.label}`, c);
              }
            }
            return buildSwimlane(p.catalogId, p.catalogId, metas, artifacts, byCatalog.get(p.catalogId) ?? []);
          }),
        );
        if (alive) {
          setLanes(sortLanes(results));
          setCraftByKey(craft);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { alive = false; };
  }, [reload]);

  const retry = () => {
    setError(null);
    setLanes(null);
    setVerdictsDegraded(false);
    setCraftByKey(null);
    setCraftDegraded(false);
    setReload((n) => n + 1);
  };

  const toggle = (kind: 'readiness' | 'state' | 'engine', value: string) =>
    setHighlight((h) => (h && h.kind === kind && h.value === value ? null : { kind, value }));

  /** Lanes with cells restricted to the active capability-class filter (empty lanes hidden). */
  const visibleLanes = useMemo(() => {
    if (!lanes) return null;
    if (!filterClass) return lanes;
    return lanes
      .map((lane) => ({ ...lane, cells: lane.cells.filter((c) => cellInClass(lane.catalogId, c, filterClass)) }))
      .filter((lane) => lane.cells.length > 0);
  }, [lanes, filterClass]);

  /** Chip counts are taken over the lanes ACTUALLY RENDERED (so a capability filter can't
   *  leave a chip advertising steps that are off-screen) and count every cell the chip
   *  would un-dim. Engines are listed only when at least one cell is wired — an engine
   *  that never produced anything is a bottleneck, not a lens. */
  const { rungCounts, stateCounts, engines, totalCells } = useMemo(() => {
    const rungs = new Map<string, number>();
    const states = new Map<string, number>();
    const perEngine = new Map<string, { count: number; wired: number }>();
    let total = 0;
    for (const lane of visibleLanes ?? []) {
      for (const c of lane.cells) {
        total += 1;
        const r = readinessOf(c);
        if (r.state === 'reached') rungs.set(r.level, (rungs.get(r.level) ?? 0) + 1);
        else states.set(r.state, (states.get(r.state) ?? 0) + 1);
        const e = perEngine.get(c.engine) ?? { count: 0, wired: 0 };
        e.count += 1;
        if (c.grade !== 'unwired') e.wired += 1;
        perEngine.set(c.engine, e);
      }
    }
    return {
      rungCounts: rungs,
      stateCounts: states,
      engines: [...perEngine.entries()]
        .filter(([, v]) => v.wired > 0)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, v]) => ({ name, count: v.count })),
      totalCells: total,
    };
  }, [visibleLanes]);

  /**
   * The campaign headline: rungs still to climb on the A-axis, per lens, over the lanes
   * actually rendered. An UNGAUGED cell counts its full ceiling distance and a STALE one
   * counts as ungauged (see `cellDistanceToRoof`) — the number can only shrink through
   * real gauges, never through absence.
   */
  const craftRoof = useMemo(() => {
    if (!craftByKey || !visibleLanes) return null;
    const perLens = new Map<string, { toRoof: number; gauged: number; cells: number }>();
    let total = 0;
    let audited = 0;
    for (const lane of visibleLanes) {
      for (const c of lane.cells) {
        const cc = craftByKey.get(`${lane.catalogId} ${c.label}`);
        if (!cc) continue;
        audited += 1;
        const d = cellDistanceToRoof(cc);
        total += d;
        const e = perLens.get(cc.lens) ?? { toRoof: 0, gauged: 0, cells: 0 };
        e.toRoof += d;
        e.cells += 1;
        if (cc.craft.level !== 'A0' && cc.craft.state !== 'stale') e.gauged += 1;
        perLens.set(cc.lens, e);
      }
    }
    return {
      total,
      audited,
      lenses: [...perLens.entries()].sort((a, b) => b[1].toRoof - a[1].toRoof),
    };
  }, [craftByKey, visibleLanes]);

  /** Exactly how many rendered cells the active highlight keeps at full opacity. */
  const matchCount = useMemo(() => {
    if (!highlight || !visibleLanes) return 0;
    let n = 0;
    for (const lane of visibleLanes) for (const c of lane.cells) if (cellMatches(c, highlight)) n += 1;
    return n;
  }, [visibleLanes, highlight]);

  return (
    <>
      <Legend />
      {/* role="group", not "toolbar": a toolbar promises arrow-key roving focus, which these
          chips do not implement — every chip is its own tab stop. */}
      {/* ONE ladder: rungs ascending, then the two states that are deliberately not rungs.
          Each chip's swatch paints exactly like the cells it selects. */}
      <div role="group" aria-label="Highlight steps by production readiness" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s2)' }}>
        <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)', alignSelf: 'center', width: 56 }}>readiness</span>
        {LADDER.map((level: ReadinessLevel) => {
          const active = highlight?.kind === 'readiness' && highlight.value === level;
          const count = rungCounts.get(level) ?? 0;
          const name = READINESS_NAME[level];
          return (
            <Chip
              key={level}
              label={`${level} ${name}`}
              count={count}
              swatch={swatchStyle(RAMP[level].token, RAMP[level].fill)}
              active={active}
              disabled={count === 0 && !active}
              title={count === 0 ? `No steps at ${level} ${name}. ${READINESS_MEANING[level]}` : `${READINESS_MEANING[level]} Highlight the ${count} step${count === 1 ? '' : 's'} at ${level}.`}
              onClick={() => toggle('readiness', level)}
            />
          );
        })}
        {(['waiting', 'blocked'] as const).map((state: ReadinessState) => {
          const active = highlight?.kind === 'state' && highlight.value === state;
          const count = stateCounts.get(state) ?? 0;
          const waiting = state === 'waiting';
          return (
            <Chip
              key={state}
              label={`${STATE_GLYPH[state]} ${state.toUpperCase()}`}
              count={count}
              swatch={swatchStyle(waiting ? RAMP.R4.token : BLOCKED_TOKEN, waiting ? RAMP.R4.fill : 30, waiting)}
              active={active}
              disabled={count === 0 && !active}
              title={
                waiting
                  ? 'A gate that would prove these steps is declared but has never been run — not a rung, and never progress.'
                  : 'A checker or a judge condemned these outputs.'
              }
              onClick={() => toggle('state', state)}
            />
          );
        })}
      </div>
      <div role="group" aria-label="Highlight steps by engine" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s5)' }}>
        <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)', alignSelf: 'center', width: 56 }}>engine</span>
        {engines.map((e) => (
          <Chip
            key={e.name}
            label={e.name}
            count={e.count}
            active={highlight?.kind === 'engine' && highlight.value === e.name}
            title={`Highlight the ${e.count} step${e.count === 1 ? '' : 's'} powered by ${e.name}`}
            onClick={() => toggle('engine', e.name)}
          />
        ))}
        {engines.length === 0 && (
          <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--text-subtle)', alignSelf: 'center' }}>
            {lanes ? 'no engine has produced a step yet' : 'awaiting data…'}
          </span>
        )}
      </div>
      {/* The A-axis rollup: distance to the recorded roof per lens, plain text (no
          highlight toggles — this is a headline, not a filter). Absent entirely while
          craft gauges are loading or failed to load. */}
      {craftRoof && (
        <div
          role="group"
          aria-label="Craft distance to roof per lens"
          data-testid="craft-roof-rollup"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s3)', marginTop: 'calc(-1 * var(--lab-s4))', marginBottom: 'var(--lab-s5)', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)' }}
        >
          <span style={{ width: 56 }}>craft</span>
          <span title="Total A-axis rungs still to climb across every audited step rendered below. Ungauged and stale steps count their full ceiling distance — this number only shrinks through real gauges.">
            <strong style={{ color: 'var(--lab-text)' }}>{craftRoof.total}</strong> rungs to roof · {craftRoof.audited} audited steps
          </span>
          {craftRoof.lenses.map(([lens, e]) => (
            <span key={lens} title={`${lens}: ${e.toRoof} rungs to the recorded roof across ${e.cells} steps (${e.gauged} gauged under the current lens)`}>
              {lens} <strong style={{ color: 'var(--lab-text)' }}>{e.toRoof}</strong>
              <span style={{ color: 'var(--text-subtle)' }}> ({e.gauged}/{e.cells} gauged)</span>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--lab-s3)',
            padding: 'var(--lab-s2) var(--lab-s3)',
            marginBottom: 'var(--lab-s3)',
            fontSize: 'var(--lab-fs-xs)',
            color: 'var(--lab-text)',
            background: 'color-mix(in srgb, var(--lab-bad) 10%, transparent)',
            border: '1px solid var(--lab-bad)',
            borderRadius: 'var(--lab-r-sm)',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <strong style={{ fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-bad)' }}>LOAD FAILED</strong>{' '}
            — the map below is missing, not empty: {error}
          </span>
          <RetryButton onClick={retry} />
        </div>
      )}

      {craftDegraded && !error && (
        <div
          role="status"
          style={{
            padding: 'var(--lab-s2) var(--lab-s3)',
            marginBottom: 'var(--lab-s3)',
            fontSize: 'var(--lab-fs-xs)',
            color: 'var(--lab-text)',
            border: '1px solid var(--lab-line)',
            borderLeft: '3px solid var(--lab-warn)',
            borderRadius: 'var(--lab-r-sm)',
          }}
        >
          <strong style={{ fontFamily: 'var(--lab-font-mono)' }}>PARTIAL</strong> — craft gauges did not load, so the
          A-axis (chips and roof rollup) is hidden below: absent, not A0.
        </div>
      )}

      {verdictsDegraded && !error && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--lab-s3)',
            padding: 'var(--lab-s2) var(--lab-s3)',
            marginBottom: 'var(--lab-s3)',
            fontSize: 'var(--lab-fs-xs)',
            color: 'var(--lab-text)',
            // shorthand first — a later `border` would wipe the warn stripe.
            border: '1px solid var(--lab-line)',
            borderLeft: '3px solid var(--lab-warn)',
            borderRadius: 'var(--lab-r-sm)',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <strong style={{ fontFamily: 'var(--lab-font-mono)' }}>PARTIAL</strong> — judge verdicts did not load, so cells
            show gate/checker status only: a judged pass or fail is not reflected below.
          </span>
          <RetryButton onClick={retry} label="Reload map" />
        </div>
      )}

      {filterClass && (
        <div style={{ marginBottom: 'var(--lab-s3)' }}>
          <button
            type="button"
            className="focus-ring"
            onClick={() => onClearFilter?.()}
            aria-label={`Clear ${filterClass} filter`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--lab-s1)',
              padding: 'var(--lab-s1) var(--lab-s2)',
              fontSize: 'var(--lab-fs-xs)',
              fontFamily: 'var(--lab-font-mono)',
              color: 'var(--lab-text)',
              background: 'color-mix(in srgb, var(--lab-ink) 16%, transparent)',
              border: '1px solid var(--lab-ink)',
              borderRadius: 'var(--lab-r-sm)',
              cursor: 'pointer',
            }}
          >
            capability: {filterClass}
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}

      {/* Live region so the load/empty/highlight transitions are announced, not just drawn —
          the highlight is otherwise a pure opacity change no screen reader can perceive. */}
      <div role="status" aria-live="polite" style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-muted)' }}>
        {!lanes && !error && 'Loading pipeline truth…'}
        {lanes && lanes.length === 0 && 'No catalog pipelines are registered yet — nothing to map.'}
        {lanes && lanes.length > 0 && filterClass && visibleLanes?.length === 0 && (
          <>
            No steps match the <strong>{filterClass}</strong> capability class. Clear the filter above to see the whole map.
          </>
        )}
        {highlight && totalCells > 0 && (
          <>
            Highlighting {highlight.kind === 'readiness' ? 'readiness' : highlight.kind === 'state' ? 'state' : 'engine'}{' '}
            <strong>{highlight.value}</strong> — {matchCount} of {totalCells} steps
            {matchCount === 0 ? '; nothing matches, so the whole map is dimmed' : '; the rest are dimmed'}. Click the{' '}
            {highlight.value} chip again to clear.
          </>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        {visibleLanes?.map((lane) => (
          <div key={lane.catalogId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s2)', minWidth: 'max-content' }}>
            <button
              type="button"
              onClick={() => onFocusCatalog(lane.catalogId)}
              className="focus-ring"
              title={`Focus an entity — ${lane.catalogId} — production-ready (R4+) ${lane.readyPct}% · credible (R3+) ${lane.crediblePct}% · started (R1+) ${lane.startedPct}%${lane.blockedCount ? ` · ${lane.blockedCount} blocked` : ''}`}
              style={{ width: 200, flexShrink: 0, textAlign: 'left', fontSize: 'calc(var(--lab-fs-xs) + 3px)', fontWeight: 700, fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', background: 'transparent', border: 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {lane.label}
            </button>
            {/* role="img" + aria-label so the bare number reads as "42% gate-verified" rather
                than an unlabelled percentage (the title alone is not reliably announced). */}
            <span
              role="img"
              aria-label={`${lane.readyPct}% of ${lane.label} steps are production-ready (R4 or above)`}
              title="production-ready steps (R4+)"
              style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: lane.readyPct > 0 ? 'var(--lab-ok)' : 'var(--lab-muted)' }}
            >
              {lane.readyPct}%
            </span>
            <div style={{ display: 'flex', gap: 'var(--lab-s1)' }}>
              {lane.cells.map((cell) => (
                <button
                  key={cell.label}
                  type="button"
                  onClick={() => setEvidence({ catalogId: lane.catalogId, step: cell.label, cell })}
                  className="focus-ring"
                  title="Show the stored output this evaluation was based on"
                  style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <StatusCell
                    cell={cell}
                    dimmed={!cellMatches(cell, highlight)}
                    craft={craftByKey?.get(`${lane.catalogId} ${cell.label}`)}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {evidence && (
        <EvidenceModal key={`${evidence.catalogId}::${evidence.step}`} catalogId={evidence.catalogId} step={evidence.step} cell={evidence.cell} onClose={() => setEvidence(null)} />
      )}
    </>
  );
}
