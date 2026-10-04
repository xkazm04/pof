'use client';
/**
 * The Orrery's chrome: the topbar (brand, dataset, search, lens, layer toggles, help) and the four
 * things that float over the wheel (breadcrumbs, honesty badges, the legend, the view tools), plus
 * the polite live region that narrates the selection.
 *
 * Ported from the winning prototype of the `storymap` contest (variant A/3 "Orrery"), which the
 * owner chose for its compactness and the smoothness of its navigation. Every element carries the
 * `data-role` hook named in `.contest/staging/storymap/roles.json`; the theme layer
 * (`themes/orrery.css` + `themes/blueprint.css`) owns all of the styling, so this file holds no
 * colour literal, no font size and no geometry other than the one overlay frame documented below.
 *
 * ── Two components, because the winner's DOM has two homes ──────────────────────────────────────
 * In the winner, `#top` is a sibling of `#main`, while `#crumbs`, `#badges`, `#legend` and `#tools`
 * are children of `#stagewrap` — they are positioned against the stage. The port therefore ships:
 *
 *   `OrreryChrome`       the topbar, and by default the overlay set as well.
 *   `OrreryStageChrome`  the overlay set on its own, for `OrreryView` to mount INSIDE
 *                        `[data-role=orrery-stage]` (`mount="stage"`), which is where the winner
 *                        and the theme scaffold both put it.
 *
 * Until that composition exists, `OrreryChrome` renders the overlays with `mount="root"`: one
 * absolutely-positioned frame that covers exactly the stage's rectangle (below the topbar, left of
 * the panel, both taken from theme tokens so the breakpoints keep working). That frame is the only
 * geometry in this file, it is composition rather than theme, and it disappears the moment the
 * overlays are mounted in their real parent.
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { NodeIx, OrreryModel, OrreryNode } from '@/lib/story/orrery';

export interface OrreryChromeProps {
  model: OrreryModel;
  focus: NodeIx;
  datasets: { key: string; label: string }[];
  activeDataset: string;
  onDataset: (k: string) => void;
  /** A cohort name, `COHORT_DIVERGENCE`, or null for off. */
  lens: string | null;
  onLens: (l: string | null) => void;
  show: { impact: boolean; paths: boolean; influence: boolean; flags: boolean };
  onToggle: (k: 'impact' | 'paths' | 'influence' | 'flags') => void;
  onFocus: (i: NodeIx) => void;
  onSelect: (i: NodeIx) => void;
  /** The selected node, for the trailing breadcrumb and the live region. -1 for none. */
  selected?: NodeIx;
  /** The lane the flat dial is scoped to, when the document declares one. */
  lane?: string | null;
  onLane?: (l: string | null) => void;
  help?: boolean;
  onHelp?: (open: boolean) => void;
  /** The camera lives in the stage, so zoom and fit are wired by whoever owns both. */
  onZoom?: (factor: number) => void;
  onFit?: () => void;
  /** `false` when `OrreryStageChrome` is mounted inside the stage instead. */
  overlays?: boolean;
}

/** The lens value that means "show where the cohorts disagree" rather than one cohort. */
export const COHORT_DIVERGENCE = '__diverge';

const ZOOM_STEP = 1.6;

/* ------------------------------------------------------------------ the topbar */

export function OrreryChrome(props: OrreryChromeProps) {
  const { model, datasets, activeDataset, onDataset, lens, onLens, show, onToggle, help, onHelp } = props;
  const dsId = useId();
  const lensId = useId();
  const cohorts = model.cohorts;
  const provisional = model.prov.provisional;

  return (
    <>
      <header data-role="orrery-topbar">
        <div data-role="orrery-brandrow">
          <svg width="26" height="26" viewBox="-13 -13 26 26" aria-hidden="true">
            <circle r="11.5" fill="none" stroke="var(--or-brass)" strokeWidth="1.2" />
            <circle
              r="7.5"
              fill="none"
              stroke="var(--or-line-hot)"
              strokeWidth="3"
              strokeDasharray="5 2.2 9 2.2"
            />
            <circle r="3.2" fill="var(--or-amber)" />
            <path d="M0 0L7 -9" stroke="var(--or-amber)" strokeWidth="1.2" />
          </svg>
          <b data-role="orrery-brand">ORRERY</b>
          <small data-role="orrery-brand-sub">the story as an instrument</small>
        </div>

        <div data-role="orrery-ctl">
          <label htmlFor={dsId}>Story</label>
          <select
            data-role="orrery-select"
            id={dsId}
            aria-label="Dataset"
            value={activeDataset}
            onChange={(e) => onDataset(e.target.value)}
          >
            {datasets.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <SearchBox model={model} onSelect={props.onSelect} />

        <div data-role="orrery-ctl">
          <label htmlFor={lensId}>Lens</label>
          <select
            data-role="orrery-select"
            id={lensId}
            aria-label="Reach lens"
            value={lens ?? ''}
            disabled={cohorts.length === 0}
            title={
              cohorts.length
                ? 'Tint every sector by how many runs reach it'
                : 'This dataset carries no reach evidence'
            }
            onChange={(e) => onLens(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Reach lens: off</option>
            {cohorts.map((c) => (
              <option key={c} value={c}>
                Reach: {c}
                {provisional ? ' (provisional)' : ''}
              </option>
            ))}
            {cohorts.length > 1 ? <option value={COHORT_DIVERGENCE}>Where cohorts diverge</option> : null}
          </select>
        </div>

        <div data-role="orrery-spacer" />

        <Toggle
          on={show.impact}
          onClick={() => onToggle('impact')}
          title="Impact rim: bar length = how much a decision's options differ"
        >
          Impact
        </Toggle>
        <Toggle on={show.paths} onClick={() => onToggle('paths')} title="Traversal edges, bundled through the interior">
          Paths
        </Toggle>
        <Toggle
          on={show.influence}
          onClick={() => onToggle('influence')}
          tone="influence"
          title="Influence arcs (dotted, bright): what a node writes that another reads"
        >
          Influence
        </Toggle>
        <Toggle on={show.flags} onClick={() => onToggle('flags')} title="Mark nodes the audit flagged">
          Flags
        </Toggle>
        {/* The winner's `?` carries no aria-pressed, and the style contract's `headerBtn` row is
            measured on exactly that unpressed button. */}
        <button
          type="button"
          data-role="orrery-headerbtn"
          title="How to read the wheel"
          onClick={() => onHelp?.(!help)}
        >
          ?
        </button>
      </header>

      {props.overlays === false ? null : <OrreryStageChrome {...props} mount="root" />}
      <LiveRegion model={model} i={props.selected != null && props.selected >= 0 ? props.selected : props.focus} />
    </>
  );
}

function Toggle({
  on,
  onClick,
  title,
  tone,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  tone?: 'influence';
  children: string;
}) {
  return (
    <button
      type="button"
      data-role="orrery-headerbtn"
      data-tone={tone}
      aria-pressed={on}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ search */

interface Hit {
  i: NodeIx;
  score: number;
}

/** The winner's scoring: exact id, id prefix, title prefix, title substring, id substring. */
function rank(q: string, title: string, id: string): number {
  if (id === q) return 0;
  if (id.startsWith(q)) return 1;
  if (title.startsWith(q)) return 2;
  if (title.includes(q)) return 3;
  if (id.includes(q)) return 4;
  return -1;
}

const SEARCH_SCAN = 400;
const SEARCH_SHOW = 14;

function SearchBox({ model, onSelect }: { model: OrreryModel; onSelect: (i: NodeIx) => void }) {
  const listId = useId();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const activeRow = useRef<HTMLButtonElement | null>(null);

  const index = useMemo(() => {
    const n = model.R.length - 1;
    const t = new Array<string>(n);
    const id = new Array<string>(n);
    for (let i = 0; i < n; i++) {
      t[i] = model.R[i].title.toLowerCase();
      id[i] = model.R[i].id.toLowerCase();
    }
    return { t, id, n };
  }, [model]);

  const { hits, total } = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { hits: [] as Hit[], total: 0 };
    const out: Hit[] = [];
    for (let i = 0; i < index.n && out.length < SEARCH_SCAN; i++) {
      const score = rank(s, index.t[i], index.id[i]);
      if (score >= 0) out.push({ i, score });
    }
    out.sort((a, b) => a.score - b.score || model.R[a.i].depth - model.R[b.i].depth || a.i - b.i);
    return { hits: out.slice(0, SEARCH_SHOW), total: out.length };
  }, [q, index, model]);

  const open = q.trim().length > 0;

  // Click away closes the popover, and `/` from anywhere outside a field opens it, exactly as the
  // winner does. Neither is timer-driven, so neither needs the suspendable effect.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setQ('');
    };
    const slash = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.key !== '/' || (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', slash);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', slash);
    };
  }, []);

  useEffect(() => {
    activeRow.current?.scrollIntoView?.({ block: 'nearest' });
  }, [cursor, q]);

  const jump = (i: NodeIx) => {
    setQ('');
    onSelect(i);
  };

  return (
    <div data-role="orrery-searchbox" ref={box}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="6" cy="6" r="4.3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.2 9.2L13 13" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <input
        data-role="orrery-search"
        ref={input}
        type="search"
        placeholder="Find a node by title or id  ( / )"
        aria-label="Search nodes by title or id"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setCursor(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (hits.length === 0) return;
            setCursor((c) => (c + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const hit = hits[cursor];
            if (hit) jump(hit.i);
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            setQ('');
            input.current?.blur();
          }
        }}
      />
      <div data-role="orrery-results" role="listbox" aria-label="Search results" id={listId} data-open={open ? '1' : '0'}>
        {!open ? null : hits.length === 0 ? (
          <div data-role="orrery-note">No node matches &ldquo;{q}&rdquo;</div>
        ) : (
          <>
            {hits.map((h, k) => {
              const n = model.R[h.i];
              const par = n.par >= 0 ? model.R[n.par] : null;
              return (
                <button
                  type="button"
                  key={h.i}
                  data-role="orrery-result"
                  role="option"
                  aria-selected={k === cursor}
                  ref={k === cursor ? activeRow : undefined}
                  onClick={() => jump(h.i)}
                >
                  {n.title}
                  <small>
                    {n.id} &middot; {n.kind}
                    {par && !par.virtual ? ` · in ${par.title}` : ''}
                  </small>
                </button>
              );
            })}
            {total > hits.length ? (
              <div data-role="orrery-note">
                {total >= SEARCH_SCAN ? `${SEARCH_SCAN}+` : total} matches &mdash; refine to narrow
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the live region */

const plural = (n: number, word: string) => `${n} ${n > 1 && !word.endsWith('s') ? `${word}s` : word}`;

/** The winner's `describe()`: one sentence a screen reader can follow without the canvas. */
function describe(model: OrreryModel, i: NodeIx): string {
  const R = model.R;
  const n: OrreryNode | undefined = R[i];
  if (!n) return '';
  const parts: string[] = [`${n.title}, ${n.cls && n.cls !== 'beat' ? n.cls : n.kind}`];
  const par = n.par >= 0 ? R[n.par] : null;
  if (par && !par.virtual) {
    const at = par.kids.indexOf(i) + 1;
    parts.push(at ? `${at} of ${par.kids.length} in ${par.title}` : `in ${par.title}`);
  }
  if (n.kids.length) {
    const by = new Map<string, number>();
    for (const k of n.kids) {
      const key = R[k].cls && R[k].cls !== 'beat' ? R[k].cls : R[k].kind;
      by.set(key, (by.get(key) ?? 0) + 1);
    }
    parts.push(`contains ${[...by.entries()].map(([k, v]) => plural(v, k)).join(', ')}`);
  }
  if (n.ch) parts.push(`${n.ch.cls.replace('-', ' ')} choice`);
  const outs = model.out[i].slice(0, 4).map((e) => R[e.to].title);
  const ins = model.inn[i].slice(0, 3).map((e) => R[e.from].title);
  if (outs.length) parts.push(`connects to ${outs.join(', ')}`);
  if (ins.length) parts.push(`reached from ${ins.join(', ')}`);
  if (n.reach) parts.push(`reach measured${model.prov.unverified ? ', unverified' : ''}${model.prov.provisional ? ', provisional' : ''}`);
  else if (n.reachMean) parts.push('no reach row of its own; derived from measured descendants');
  else if (model.cohorts.length) parts.push('no reach row, unmeasured, which is not zero');
  if (n.flags) parts.push(`audit: ${[...new Set(n.flags)].join(', ')}`);
  return parts.join('. ');
}

function LiveRegion({ model, i }: { model: OrreryModel; i: NodeIx }) {
  return (
    <div data-role="orrery-sr" aria-live="polite" aria-atomic="true">
      {describe(model, i)}
    </div>
  );
}

/* ------------------------------------------------------------------ the stage overlays */

export interface OrreryStageChromeProps extends OrreryChromeProps {
  /** `stage` = already inside `[data-role=orrery-stage]`. `root` = position over it. */
  mount?: 'stage' | 'root';
}

export function OrreryStageChrome(props: OrreryStageChromeProps) {
  const { mount = 'stage' } = props;
  const inner = (
    <>
      <Breadcrumbs {...props} />
      <Badges {...props} />
      <Legend {...props} />
      <Tools {...props} />
    </>
  );
  if (mount === 'stage') return inner;
  // The stage's own rectangle, from the theme's tokens, so the winner's breakpoints still move it.
  return (
    <div
      data-role="orrery-overlay"
      style={{
        position: 'absolute',
        top: 'var(--or-topbar-h)',
        right: 'var(--or-panel-w)',
        bottom: 0,
        left: 0,
        zIndex: 4,
        pointerEvents: 'none',
      }}
    >
      {inner}
    </div>
  );
}

function Breadcrumbs({ model, focus, selected, lane, onLane, onFocus, onSelect, datasets, activeDataset }: OrreryStageChromeProps) {
  const R = model.R;
  const sel = selected ?? -1;
  const root = model.root;
  // The virtual dataset root is the DOCUMENT, so it reads as the document's own name — the winner
  // uses the dataset label up to its ` ·` size suffix, not the graph id.
  const dsLabel = (datasets.find((d) => d.key === activeDataset)?.label ?? '').split(' ·')[0];
  const label = (n: OrreryNode) =>
    n.virtual ? dsLabel || model.raw.project || model.raw.graphId || n.title : n.title;

  const path: NodeIx[] = [];
  for (let p = focus; p >= 0; p = R[p].par) path.unshift(p);

  const crumbs: { key: string; text: string; onClick?: () => void }[] = [];
  if (model.flat && lane) {
    crumbs.push({ key: 'root', text: label(R[root]), onClick: () => onLane?.(null) });
    crumbs.push({ key: 'lane', text: lane, onClick: sel >= 0 ? () => onSelect(-1) : undefined });
  } else {
    path.forEach((i, q) => {
      const last = q === path.length - 1 && (sel < 0 || sel === focus);
      crumbs.push({ key: `n${i}`, text: label(R[i]), onClick: last ? undefined : () => onFocus(i) });
    });
  }
  if (sel >= 0 && sel !== focus && R[sel]) crumbs.push({ key: `s${sel}`, text: R[sel].title });

  return (
    <nav data-role="orrery-crumbs" aria-label="Where you are in the story">
      {crumbs.map((c, q) => (
        <Fragment key={c.key}>
          {q > 0 ? <i>&rsaquo;</i> : null}
          {c.onClick ? (
            <button type="button" data-role="orrery-crumb" title={c.text} onClick={c.onClick}>
              {c.text}
            </button>
          ) : (
            <span data-role="orrery-crumb-cur" title={c.text}>
              {c.text}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

function Badges({ model, lens }: OrreryStageChromeProps) {
  const { prov, cohorts } = model;
  const hasAxis = model.raw.profile?.axis != null;
  return (
    <div data-role="orrery-badges">
      {cohorts.length > 0 && prov.unverified ? (
        <span
          data-role="orrery-chip"
          data-tone="warn"
          title="evidence.runs graphHash is null: reach rows are not pinned to a graph version"
        >
          reach unverified &middot; graphHash null
        </span>
      ) : null}
      {cohorts.length > 0 && !prov.unverified ? (
        <span data-role="orrery-chip" data-tone="ok" title="Every run pins a graphHash">
          reach pinned to a graph version
        </span>
      ) : null}
      {prov.provisional ? (
        <span
          data-role="orrery-chip"
          data-tone="warn"
          title="Transcribed from a design document that calls these figures provisional"
        >
          provisional &middot; transcribed from a design doc
        </span>
      ) : null}
      {prov.generated ? (
        <span data-role="orrery-chip" data-tone="warn" title="The prose is generated filler for scale testing">
          text = generated filler
        </span>
      ) : null}
      {!hasAxis ? (
        <span data-role="orrery-chip" title="No axis declared: angle follows topological order">
          no time axis &middot; topological order
        </span>
      ) : null}
      {cohorts.length === 0 ? <span data-role="orrery-chip">no reach evidence in this file</span> : null}
      {lens ? (
        <span data-role="orrery-chip" data-tone="ok">
          lens: {lens === COHORT_DIVERGENCE ? 'cohort divergence' : lens}
        </span>
      ) : null}
    </div>
  );
}

/** Node-kind swatches read the theme tokens, so both themes repaint them with the wheel. */
const KIND_SWATCH: { token: string; label: string }[] = [
  { token: '--or-line-hot', label: 'event' },
  { token: '--or-amber', label: 'choice' },
  { token: '--or-violet', label: 'gate' },
  { token: '--or-rose', label: 'ending (in the hub)' },
  { token: '--or-ok', label: 'entry' },
  { token: '--or-line2', label: 'container' },
];

function Legend({ model, lens }: OrreryStageChromeProps) {
  // Closed, as the winner ships it: the legend sits over the wheel and the owner chose this variant
  // for its compactness. The style contract's `legend` row (77px) is the closed summary, and its
  // `legendHead` row can only be reached with it open — see the report: those two rows of the
  // merged contract were captured in different states and cannot both be satisfied at load.
  const [open, setOpen] = useState(false);
  return (
    <details
      data-role="orrery-legend"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      style={{ pointerEvents: 'auto' }}
    >
      <summary>Legend</summary>
      <div data-role="orrery-legend-body">
        <h4 data-role="orrery-legend-head">Nodes</h4>
        {KIND_SWATCH.map((s) => (
          <Fragment key={s.label}>
            <span data-role="orrery-legend-swatch" style={{ background: `var(${s.token})` }} />
            <span>{s.label}</span>
          </Fragment>
        ))}
        <h4 data-role="orrery-legend-head">Impact</h4>
        <span data-role="orrery-legend-swatch" style={{ background: 'var(--or-amber)' }} />
        <span>spike = how far a decision&rsquo;s options differ</span>
        <span data-role="orrery-legend-swatch" style={{ background: 'none', border: '1.5px dashed var(--or-mut)' }} />
        <span>hollow tick = options change nothing (false) or are unwired</span>
        <span data-role="orrery-legend-swatch" style={{ background: 'none', borderTop: '2px dotted var(--or-infl)' }} />
        <span>dotted arc = &ldquo;influences&rdquo;: a write another node&rsquo;s guard reads</span>
        <span data-role="orrery-legend-swatch" style={{ background: 'var(--or-rose)' }} />
        <span>rose mark = the audit found something here</span>
        {model.cohorts.length > 0 ? (
          <>
            <h4 data-role="orrery-legend-head">
              Reach lens{model.prov.provisional ? ' · provisional' : ''}
            </h4>
            {lens ? (
              <>
                <span data-role="orrery-legend-swatch" style={{ background: 'var(--or-teal)' }} />
                <span>{lens === COHORT_DIVERGENCE ? 'cohorts agree → disagree' : '0% → 100% of runs'}</span>
                <span data-role="orrery-legend-swatch" style={{ background: 'var(--or-bar-track)' }} />
                <span>dark, outlined = measured, and 0%</span>
                <span data-role="orrery-legend-swatch" style={{ background: 'var(--or-bar-track-none)' }} />
                <span>
                  hatched = no reach row: never measured, <b>not</b> zero
                </span>
              </>
            ) : (
              <span data-role="orrery-legend-full">
                Pick a cohort in the header. Percent of runs reaching a node,{' '}
                <b>{model.prov.unverified ? 'unverified' : 'pinned to a graph version'}</b>
                {model.prov.unverified ? ' (graphHash null)' : ''}
                {model.prov.provisional ? ', and provisional (transcribed from a design doc)' : ''}.
              </span>
            )}
          </>
        ) : null}
        {model.prov.generated ? (
          <span data-role="orrery-legend-full">Text is generated filler, not writing.</span>
        ) : null}
      </div>
    </details>
  );
}

function Tools({ model, focus, selected, onFocus, onSelect, onZoom, onFit }: OrreryStageChromeProps) {
  const sel = selected ?? -1;
  const root = model.root;
  const par = model.R[focus]?.par ?? -1;
  const canUp = sel >= 0 ? true : focus !== root && par >= 0;
  const up = () => {
    if (sel >= 0 && sel !== focus) onSelect(-1);
    else if (par >= 0) onFocus(par);
  };
  return (
    <div data-role="orrery-tools" style={{ pointerEvents: 'auto' }}>
      <button
        type="button"
        data-role="orrery-tool"
        aria-label="Up one level"
        title="Up one level (Esc)"
        disabled={!canUp}
        style={{ opacity: canUp ? 1 : 0.45 }}
        onClick={up}
      >
        &uarr;<span>Up</span>
      </button>
      <button
        type="button"
        data-role="orrery-tool"
        aria-label="Zoom out"
        title="Zoom out (-)"
        disabled={!onZoom}
        style={{ opacity: onZoom ? 1 : 0.45 }}
        onClick={() => onZoom?.(1 / ZOOM_STEP)}
      >
        &minus;
      </button>
      <button
        type="button"
        data-role="orrery-tool"
        aria-label="Zoom in"
        title="Zoom in (+)"
        disabled={!onZoom}
        style={{ opacity: onZoom ? 1 : 0.45 }}
        onClick={() => onZoom?.(ZOOM_STEP)}
      >
        +
      </button>
      <button
        type="button"
        data-role="orrery-tool"
        aria-label="Fit to view"
        title="Fit (0)"
        disabled={!onFit}
        style={{ opacity: onFit ? 1 : 0.45 }}
        onClick={() => onFit?.()}
      >
        &#9678;<span>Fit</span>
      </button>
    </div>
  );
}
