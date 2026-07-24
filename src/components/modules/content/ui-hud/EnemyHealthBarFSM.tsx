'use client';

import { useState } from 'react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';

// ── C++ values from EnemyHealthBarWidget.h ──────────────────────────────────

type FadeState = 'Hidden' | 'FadingIn' | 'Visible' | 'FadingOut';

interface StateNode {
  id: FadeState;
  label: string;
  detail: string;
  /** Short formula shown under the node label in the diagram. */
  subLabel: string;
  color: string;
  x: number;
  y: number;
}

interface Transition {
  from: FadeState;
  to: FadeState;
  label: string;
  trigger: string;
  color: string;
}

const STATES: StateNode[] = [
  { id: 'Hidden',   label: 'Hidden',    detail: 'FadeAlpha = 0, invisible',                     subLabel: 'α = 0',              color: STATUS_ERROR,   x: 60,  y: 40 },
  { id: 'FadingIn', label: 'FadingIn',  detail: 'FadeInDuration = 0.2s, alpha 0→1',             subLabel: '0.2s → α = 1',       color: STATUS_WARNING, x: 280, y: 40 },
  { id: 'Visible',  label: 'Visible',   detail: 'Fully visible, TimeSinceLastDamage counting',  subLabel: 'α = 1, idle timer',  color: STATUS_SUCCESS, x: 280, y: 160 },
  { id: 'FadingOut', label: 'FadingOut', detail: 'FadeOutDuration = 0.5s, alpha 1→0',            subLabel: '0.5s → α = 0',       color: ACCENT_VIOLET,  x: 60,  y: 160 },
];

const TRANSITIONS: Transition[] = [
  { from: 'Hidden',    to: 'FadingIn',  label: '0.2s',  trigger: 'OnHealthChanged (damage)',     color: STATUS_WARNING },
  { from: 'FadingIn',  to: 'Visible',   label: '',      trigger: 'FadeAlpha >= 1.0',             color: STATUS_SUCCESS },
  { from: 'Visible',   to: 'FadingOut',  label: '3.0s',  trigger: 'TimeSinceLastDamage > FadeOutDelay', color: ACCENT_VIOLET },
  { from: 'FadingOut', to: 'Hidden',    label: '0.5s',  trigger: 'FadeAlpha <= 0.0',             color: STATUS_ERROR },
  // Re-entry: damage while fading out resets to fading in
  { from: 'FadingOut', to: 'FadingIn',  label: 'reset',  trigger: 'OnHealthChanged (re-damage)',  color: STATUS_WARNING },
  { from: 'Visible',   to: 'FadingIn',  label: 'reset',  trigger: 'OnHealthChanged (re-damage)',  color: STATUS_WARNING },
  // Death shortcut
  { from: 'FadingIn',  to: 'Hidden',   label: 'death',  trigger: 'HideForDeath()',               color: STATUS_ERROR },
  { from: 'Visible',   to: 'Hidden',   label: 'death',  trigger: 'HideForDeath()',               color: STATUS_ERROR },
  { from: 'FadingOut', to: 'Hidden',   label: 'death',  trigger: 'HideForDeath()',               color: STATUS_ERROR },
];

const CONFIG_PARAMS = [
  { name: 'BarInterpSpeed',   value: '10.0',  unit: 'interp/s', desc: 'Bar fill interpolation speed' },
  { name: 'FadeOutDelay',     value: '3.0',   unit: 's',        desc: 'Idle seconds before fade-out begins' },
  { name: 'FadeInDuration',   value: '0.2',   unit: 's',        desc: 'Duration of fade-in animation' },
  { name: 'FadeOutDuration',  value: '0.5',   unit: 's',        desc: 'Duration of fade-out animation' },
  { name: 'BarColor',         value: '(0.8, 0.1, 0.1)', unit: 'RGBA', desc: 'Red fill color for enemy bar' },
];

// ── SVG arrow path builder ──────────────────────────────────────────────────

const NODE_W = 100;
const NODE_H = 44;

const STATE_MAP = new Map(STATES.map(s => [s.id, s]));

// Primary transitions (the main loop: Hidden→FadingIn→Visible→FadingOut→Hidden)
const PRIMARY_IDS = new Set(['Hidden→FadingIn', 'FadingIn→Visible', 'Visible→FadingOut', 'FadingOut→Hidden']);

const SVG_TITLE_ID = 'fsm-diagram-title';
const SVG_DESC_ID = 'fsm-diagram-desc';

function stateCenter(s: StateNode): { cx: number; cy: number } {
  return { cx: s.x + NODE_W / 2, cy: s.y + NODE_H / 2 };
}

// ── Component ───────────────────────────────────────────────────────────────

export function EnemyHealthBarFSM() {
  const [activeState, setActiveState] = useState<FadeState | null>(null);
  const [focusedState, setFocusedState] = useState<FadeState | null>(null);

  // Get transitions relevant to selected state
  const activeTransitions = activeState
    ? TRANSITIONS.filter(t => t.from === activeState || t.to === activeState)
    : TRANSITIONS;

  const toggleState = (id: FadeState) =>
    setActiveState(prev => (prev === id ? null : id));

  return (
    <div className="space-y-4 p-1" data-testid="enemy-healthbar-fsm">
      {/* State Diagram */}
      <SurfaceCard level={1} className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_CYAN }} />
          <h4 className="text-xs font-bold text-text uppercase tracking-wider">
            UEnemyHealthBarWidget — EFadeState Machine
          </h4>
        </div>
        <p className="text-xs text-text-muted mb-3">
          4-state fade FSM from <code className="font-mono text-text">EnemyHealthBarWidget.h</code>.
          Select a state — click, or Tab to it and press Enter — to filter the transition list below.
        </p>

        <div className="max-w-md mx-auto">
          <svg
            viewBox="0 0 400 230"
            className="w-full overflow-visible"
            aria-labelledby={`${SVG_TITLE_ID} ${SVG_DESC_ID}`}
            data-testid="fsm-diagram-svg"
          >
            <title id={SVG_TITLE_ID}>Enemy health bar fade state machine</title>
            <desc id={SVG_DESC_ID}>
              Four states — Hidden, FadingIn, Visible and FadingOut — connected by {TRANSITIONS.length} transitions.
              Each state is selectable to filter the transition list that follows this diagram.
            </desc>
            <defs>
              {TRANSITIONS.map((t, i) => (
                <marker
                  key={`arrow-${i}`}
                  id={`arrow-${i}`}
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill={t.color} opacity={0.7} />
                </marker>
              ))}
            </defs>

            {/* Transition arrows */}
            {TRANSITIONS.map((t, i) => {
              const fromNode = STATE_MAP.get(t.from)!;
              const toNode = STATE_MAP.get(t.to)!;
              const fc = stateCenter(fromNode);
              const tc = stateCenter(toNode);

              const key = `${t.from}→${t.to}`;
              const isPrimary = PRIMARY_IDS.has(key);
              const isActive = !activeState || t.from === activeState || t.to === activeState;
              const opacity = isActive ? (isPrimary ? 0.9 : 0.65) : 0.15;

              // Offset for parallel edges
              const dx = tc.cx - fc.cx;
              const dy = tc.cy - fc.cy;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const nx = -dy / len;
              const ny = dx / len;

              // Different offsets based on transition type
              let offset = 0;
              if (t.label === 'reset') offset = isPrimary ? 0 : 18;
              if (t.label === 'death') offset = -18;
              if (key === 'FadingOut→FadingIn') offset = 22;
              if (key === 'Visible→FadingIn') offset = -20;

              const mx = (fc.cx + tc.cx) / 2 + nx * offset;
              const my = (fc.cy + tc.cy) / 2 + ny * offset;

              // Shorten start/end to not overlap nodes
              const sx = fc.cx + (dx / len) * 30;
              const sy = fc.cy + (dy / len) * 22;
              const ex = tc.cx - (dx / len) * 30;
              const ey = tc.cy - (dy / len) * 22;

              return (
                <g key={i} opacity={opacity}>
                  <path
                    d={`M${sx},${sy} Q${mx},${my} ${ex},${ey}`}
                    fill="none"
                    stroke={t.color}
                    strokeWidth={isPrimary ? 2 : 1.5}
                    strokeDasharray={t.label === 'death' ? '4 3' : undefined}
                    markerEnd={`url(#arrow-${i})`}
                  />
                  {t.label && (
                    <text
                      x={mx + (t.label === 'death' ? -4 : 4)}
                      y={my + (offset > 0 ? -6 : offset < 0 ? 10 : -6)}
                      textAnchor="middle"
                      className="text-xs font-mono font-bold"
                      fill={t.color}
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* State nodes — selectable by pointer and by keyboard */}
            {STATES.map(s => {
              const isSelected = activeState === s.id;
              const isActive = !activeState || isSelected;
              return (
                <g
                  key={s.id}
                  opacity={isActive ? 1 : 0.3}
                  className="cursor-pointer focus:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${s.label} state — ${s.detail}`}
                  onClick={() => toggleState(s.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleState(s.id);
                    }
                  }}
                  onFocus={() => setFocusedState(s.id)}
                  onBlur={() => setFocusedState(null)}
                  data-testid={`fsm-state-${s.id.toLowerCase()}`}
                >
                  {/* Focus halo — SVG cannot use the box-shadow .focus-ring token */}
                  {focusedState === s.id && (
                    <rect
                      x={s.x - 4}
                      y={s.y - 4}
                      width={NODE_W + 8}
                      height={NODE_H + 8}
                      rx={9}
                      fill="none"
                      stroke="var(--focus-accent, currentColor)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      pointerEvents="none"
                    />
                  )}
                  <rect
                    x={s.x}
                    y={s.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    fill={`${s.color}${OPACITY_20}`}
                    stroke={s.color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={s.x + NODE_W / 2}
                    y={s.y + 18}
                    textAnchor="middle"
                    className="text-[11px] font-bold font-mono"
                    fill={s.color}
                  >
                    {s.label}
                  </text>
                  <text
                    x={s.x + NODE_W / 2}
                    y={s.y + 33}
                    textAnchor="middle"
                    className="text-[11px] font-mono"
                    fill="var(--text-muted)"
                  >
                    {s.subLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Transition legend — all transitions, or just those touching the selected state */}
        <div className="mt-3 space-y-1" aria-live="polite" data-testid="fsm-transition-list">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
              {activeState ? (
                <>Transitions for <span style={{ color: STATE_MAP.get(activeState)!.color }}>{activeState}</span></>
              ) : (
                <>All transitions</>
              )}
              <span className="ml-1.5 font-mono normal-case">({activeTransitions.length})</span>
            </p>
            {activeState && (
              <button
                type="button"
                onClick={() => setActiveState(null)}
                className="focus-ring ml-auto text-xs px-2 py-0.5 rounded border border-border/60 text-text-muted hover:text-text hover:border-border-bright transition-colors"
                data-testid="fsm-clear-selection"
              >
                Show all
              </button>
            )}
          </div>
          {activeTransitions.map((t, i) => (
            <div
              key={`${t.from}-${t.to}-${t.label}`}
              className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded border"
              style={{ borderColor: `${t.color}30`, backgroundColor: `${t.color}${OPACITY_10}` }}
              data-testid={`fsm-transition-${i}`}
            >
              <span style={{ color: t.color }} className="font-bold shrink-0">{t.from} → {t.to}</span>
              <span className="text-text-muted truncate">{t.trigger}</span>
              {t.label && <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-xs" style={{ color: t.color, backgroundColor: `${t.color}${OPACITY_10}` }}>{t.label}</span>}
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* Config parameters */}
      <SurfaceCard level={1} className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_CYAN }} />
          <h4 className="text-xs font-bold text-text uppercase tracking-wider">
            Tuning Parameters
          </h4>
        </div>
        <div className="space-y-1" data-testid="fsm-config-params">
          {CONFIG_PARAMS.map(p => (
            <div
              key={p.name}
              className="flex items-center gap-2 text-xs font-mono px-2 py-1.5 rounded border border-border/30"
              data-testid={`fsm-param-${p.name.toLowerCase()}`}
            >
              <span className="text-text font-bold w-[130px] shrink-0">{p.name}</span>
              <span style={{ color: ACCENT_CYAN }} className="w-[100px] shrink-0">{p.value} <span className="text-text-muted">{p.unit}</span></span>
              <span className="text-text-muted truncate">{p.desc}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
