'use client';

/**
 * Pipelines tab — the pipeline-centric health map (one swimlane per catalog, one cell
 * per step; the cell names its engine, the background is the strict grade, the left
 * stripe is the acceptance tier). Extracted verbatim from the original StatusDashboard
 * body so the dashboard shell can host it alongside the Item Focus tab.
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
import { capabilityClassOf } from '@/lib/status/capabilityModel';
import { StatusCell, TIER_VAR } from './StatusCell';
import { EvidenceModal } from './EvidenceModal';

const TIERS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

/** True when a step belongs to the given capability class (via its audited deliverable). */
function cellInClass(catalogId: string, cell: StepCell, klass: string | null): boolean {
  if (!klass) return true;
  const fact = getStepFact(catalogId, cell.label);
  if (!fact) return false;
  return capabilityClassOf(fact.deliverable, catalogId) === klass;
}

type Highlight = { kind: 'tier' | 'engine'; value: string } | null;

function cellMatches(cell: StepCell, hl: Highlight): boolean {
  if (!hl) return true;
  if (hl.kind === 'tier') return cell.tier === hl.value;
  return cell.engine === hl.value;
}

/** Highlight chip. `count` is the number of cells the chip picks out, so the number on
 *  the chip is exactly what clicking it un-dims (never an unrelated total). A chip that
 *  would highlight nothing is disabled — clicking it would ghost the whole map with no
 *  explanation — unless it is the active one, which must stay clickable to toggle off. */
function Chip({
  label,
  count,
  color,
  active,
  disabled = false,
  title,
  onClick,
}: {
  label: string;
  count?: number;
  color?: string;
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
      {color && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: color }} />}
      {label}
      {count !== undefined && <span style={{ color: 'var(--text-subtle)' }}>({count})</span>}
    </button>
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
        const verdictRes = await tryApiFetch<JudgeVerdict[]>('/api/judge-verdicts');
        const allVerdicts = verdictRes.ok ? verdictRes.data : [];
        if (alive) setVerdictsDegraded(!verdictRes.ok);
        const byCatalog = new Map<string, JudgeVerdict[]>();
        for (const v of allVerdicts) {
          const list = byCatalog.get(v.catalogId) ?? [];
          list.push(v);
          byCatalog.set(v.catalogId, list);
        }
        const results = await Promise.all(
          pipelines.map(async (p) => {
            const artifacts: PipelineArtifact[] = await fetchArtifacts(p.catalogId);
            const metas = p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine }));
            return buildSwimlane(p.catalogId, p.catalogId, metas, artifacts, byCatalog.get(p.catalogId) ?? []);
          }),
        );
        if (alive) setLanes(sortLanes(results));
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
    setReload((n) => n + 1);
  };

  const toggle = (kind: 'tier' | 'engine', value: string) =>
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
  const { tierCounts, engines, totalCells } = useMemo(() => {
    const tiers = new Map<string, number>();
    const perEngine = new Map<string, { count: number; wired: number }>();
    let total = 0;
    for (const lane of visibleLanes ?? []) {
      for (const c of lane.cells) {
        total += 1;
        if (c.tier) tiers.set(c.tier, (tiers.get(c.tier) ?? 0) + 1);
        const e = perEngine.get(c.engine) ?? { count: 0, wired: 0 };
        e.count += 1;
        if (c.grade !== 'unwired') e.wired += 1;
        perEngine.set(c.engine, e);
      }
    }
    return {
      tierCounts: tiers,
      engines: [...perEngine.entries()]
        .filter(([, v]) => v.wired > 0)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, v]) => ({ name, count: v.count })),
      totalCells: total,
    };
  }, [visibleLanes]);

  /** Exactly how many rendered cells the active highlight keeps at full opacity. */
  const matchCount = useMemo(() => {
    if (!highlight || !visibleLanes) return 0;
    let n = 0;
    for (const lane of visibleLanes) for (const c of lane.cells) if (cellMatches(c, highlight)) n += 1;
    return n;
  }, [visibleLanes, highlight]);

  return (
    <>
      {/* role="group", not "toolbar": a toolbar promises arrow-key roving focus, which these
          chips do not implement — every chip is its own tab stop. */}
      <div role="group" aria-label="Highlight steps by acceptance tier" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s2)' }}>
        <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)', alignSelf: 'center', width: 56 }}>tier</span>
        {TIERS.map((t) => {
          const active = highlight?.kind === 'tier' && highlight.value === t;
          const count = tierCounts.get(t) ?? 0;
          return (
            <Chip
              key={t}
              label={t}
              count={count}
              color={TIER_VAR[t]}
              active={active}
              disabled={count === 0 && !active}
              title={count === 0 ? `No ${t} steps on this map` : `Highlight the ${count} ${t} step${count === 1 ? '' : 's'}`}
              onClick={() => toggle('tier', t)}
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
            Highlighting {highlight.kind === 'tier' ? 'tier' : 'engine'} <strong>{highlight.value}</strong> —{' '}
            {matchCount} of {totalCells} steps
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
              title={`Focus an entity — ${lane.catalogId} — verified ${lane.verifiedPct}% · credible ${lane.credibleGePct}% · wired ${lane.wiredPct}%`}
              style={{ width: 200, flexShrink: 0, textAlign: 'left', fontSize: 'calc(var(--lab-fs-xs) + 3px)', fontWeight: 700, fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', background: 'transparent', border: 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {lane.label}
            </button>
            {/* role="img" + aria-label so the bare number reads as "42% gate-verified" rather
                than an unlabelled percentage (the title alone is not reliably announced). */}
            <span
              role="img"
              aria-label={`${lane.verifiedPct}% of ${lane.label} steps gate-verified`}
              title="gate-verified steps"
              style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: lane.verifiedPct > 0 ? 'var(--lab-ok)' : 'var(--lab-muted)' }}
            >
              {lane.verifiedPct}%
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
                  <StatusCell cell={cell} dimmed={!cellMatches(cell, highlight)} />
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
