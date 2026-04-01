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
  { id: 'Hidden',   label: 'Hidden',    detail: 'FadeAlpha = 0, invisible',                     color: STATUS_ERROR,   x: 60,  y: 40 },
  { id: 'FadingIn', label: 'FadingIn',  detail: 'FadeInDuration = 0.2s, alpha 0→1',             color: STATUS_WARNING, x: 280, y: 40 },
  { id: 'Visible',  label: 'Visible',   detail: 'Fully visible, TimeSinceLastDamage counting',  color: STATUS_SUCCESS, x: 280, y: 160 },
  { id: 'FadingOut', label: 'FadingOut', detail: 'FadeOutDuration = 0.5s, alpha 1→0',            color: ACCENT_VIOLET,  x: 60,  y: 160 },
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

function stateCenter(s: StateNode): { cx: number; cy: number } {
  return { cx: s.x + NODE_W / 2, cy: s.y + NODE_H / 2 };
}

// ── Component ───────────────────────────────────────────────────────────────

export function EnemyHealthBarFSM() {
  const [activeState, setActiveState] = useState<FadeState | null>(null);

  const stateMap = new Map(STATES.map(s => [s.id, s]));

  // Get transitions relevant to selected state
  const activeTransitions = activeState
    ? TRANSITIONS.filter(t => t.from === activeState || t.to === activeState)
    : TRANSITIONS;

  // Primary transitions (the main loop: Hidden→FadingIn→Visible→FadingOut→Hidden)
  const primaryIds = new Set(['Hidden→FadingIn', 'FadingIn→Visible', 'Visible→FadingOut', 'FadingOut→Hidden']);

  return (
    <div className="space-y-4 p-1" data-testid="enemy-healthbar-fsm">
      {/* State Diagram */}
      <SurfaceCard level={1} className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_CYAN }} />
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            UEnemyHealthBarWidget — EFadeState Machine
          </span>
        </div>
        <p className="text-[11px] text-text-muted mb-3">
          4-state fade FSM from <code className="font-mono text-text">EnemyHealthBarWidget.h</code>.
          Click a state to highlight its transitions.
        </p>

        <div className="max-w-md mx-auto">
          <svg
            viewBox="0 0 400 230"
            className="w-full overflow-visible"
            data-testid="fsm-diagram-svg"
          >
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
              const fromNode = stateMap.get(t.from)!;
              const toNode = stateMap.get(t.to)!;
              const fc = stateCenter(fromNode);
              const tc = stateCenter(toNode);

              const key = `${t.from}→${t.to}`;
              const isPrimary = primaryIds.has(key);
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
                      className="text-[11px] font-mono font-bold"
                      fill={t.color}
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* State nodes */}
            {STATES.map(s => {
              const isActive = !activeState || activeState === s.id;
              return (
                <g
                  key={s.id}
                  opacity={isActive ? 1 : 0.3}
                  className="cursor-pointer"
                  onClick={() => setActiveState(prev => prev === s.id ? null : s.id)}
                  data-testid={`fsm-state-${s.id.toLowerCase()}`}
                >
                  <rect
                    x={s.x}
                    y={s.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    fill={`${s.color}${OPACITY_20}`}
                    stroke={s.color}
                    strokeWidth={activeState === s.id ? 2.5 : 1.5}
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
                    {s.id === 'Hidden' ? 'α = 0' : s.id === 'FadingIn' ? '0.2s → α = 1' : s.id === 'Visible' ? 'α = 1, idle timer' : '0.5s → α = 0'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Transition legend for selected state */}
        {activeState && (
          <div className="mt-3 space-y-1" data-testid="fsm-transition-list">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Transitions for <span style={{ color: stateMap.get(activeState)!.color }}>{activeState}</span>
            </p>
            {activeTransitions.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded border"
                style={{ borderColor: `${t.color}30`, backgroundColor: `${t.color}${OPACITY_10}` }}
                data-testid={`fsm-transition-${i}`}
              >
                <span style={{ color: t.color }} className="font-bold shrink-0">{t.from} → {t.to}</span>
                <span className="text-text-muted truncate">{t.trigger}</span>
                {t.label && <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-[11px]" style={{ color: t.color, backgroundColor: `${t.color}${OPACITY_10}` }}>{t.label}</span>}
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* Config parameters */}
      <SurfaceCard level={1} className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_CYAN }} />
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            Tuning Parameters
          </span>
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
