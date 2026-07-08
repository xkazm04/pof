import { Check, AlertTriangle, Sparkles } from 'lucide-react';
import { STATUS_SUCCESS, MODULE_COLORS, STATUS_IMPROVED, ACCENT_ORANGE } from '@/lib/chart-colors';
import { STATE_TYPE_COLORS } from '../shared/state-machine-shared';
import { ANIM_ACCENT, NODE_W, NODE_H } from './constants';
import type { StateNodeView } from './types';

interface StateMachineNodesProps {
  stateNodes: StateNodeView[];
  simMode: boolean;
  simPath: string[];
  validNextStates: Set<string>;
  simUnreachable: Set<string>;
  simDeadEnds: Set<string>;
  isRunning: boolean;
  handleClick: (state: StateNodeView) => void;
}

export function StateMachineNodes({
  stateNodes,
  simMode,
  simPath,
  validNextStates,
  simUnreachable,
  simDeadEnds,
  isRunning,
  handleClick,
}: StateMachineNodesProps) {
  // Node color based on state type
  const getNodeColor = (state: StateNodeView) => {
    if (state.completed) return STATUS_SUCCESS;
    if (state.isActive) return ANIM_ACCENT;
    return STATE_TYPE_COLORS[state.stateType];
  };

  return (
    <>
      {stateNodes.map((state) => {
        const color = getNodeColor(state);
        const isInSimPath = simPath.includes(state.id);
        const isValidNext = validNextStates.has(state.id);
        const isUnreachable = simUnreachable.has(state.id) && simPath.length > 0;
        const isDeadEnd = simDeadEnds.has(state.id) && simPath.length > 0;

        let borderColor = `${color}40`;
        let bgColor = `${color}0A`;
        let shadow = 'none';
        let extraClass = 'cursor-pointer motion-safe:hover:scale-105';

        if (state.completed) {
          borderColor = `${STATUS_SUCCESS}60`;
          bgColor = `${STATUS_SUCCESS}15`;
          shadow = `0 0 15px ${STATUS_SUCCESS}30, inset 0 0 10px ${STATUS_SUCCESS}10`;
        } else if (state.isActive) {
          borderColor = `${ANIM_ACCENT}80`;
          bgColor = `${ANIM_ACCENT}20`;
          shadow = `0 0 20px ${ANIM_ACCENT}40, inset 0 0 15px ${ANIM_ACCENT}20`;
          extraClass += ' ring-2 ring-violet-500/50 ring-offset-2 ring-offset-[var(--schematic-surface)]';
        } else if (simMode) {
          if (isInSimPath) {
            borderColor = `${ACCENT_ORANGE}80`;
            bgColor = `${ACCENT_ORANGE}20`;
            shadow = `0 0 20px ${ACCENT_ORANGE}40, inset 0 0 15px ${ACCENT_ORANGE}20`;
          } else if (isValidNext) {
            borderColor = `${color}60`;
            bgColor = `${color}1A`;
            extraClass += ' ring-1 ring-offset-0 ring-orange-400/50';
            shadow = `0 0 10px ${color}30, inset 0 0 10px ${color}10`;
          } else if (isUnreachable) {
            borderColor = `${MODULE_COLORS.evaluator}30`;
            bgColor = `${MODULE_COLORS.evaluator}08`;
            extraClass += ' opacity-40';
          } else {
            borderColor = `${color}20`;
            bgColor = `${color}08`;
            extraClass += ' opacity-50';
          }
        }

        return (
          <button
            key={state.id}
            onClick={() => handleClick(state)}
            disabled={!simMode && isRunning && !state.isActive}
            title={
              simMode
                ? isDeadEnd ? `${state.label} (dead end — no outgoing transitions)` : state.label
                : state.hasMontage ? `${state.label} (montage assigned)` : state.label
            }
            className={`absolute rounded-xl border transition-all duration-300 group ${extraClass}`}
            style={{
              left: `${state.x}%`,
              top: `${state.y}%`,
              transform: 'translate(-50%, -50%)',
              width: NODE_W,
              height: NODE_H,
              zIndex: 1,
              borderColor,
              backgroundColor: bgColor,
              boxShadow: shadow,
              ...(state.isNew ? { filter: 'url(#glow-new)' } : {}),
            }}
          >
            {/* Type color strip on the left edge */}
            <div
              className="absolute left-0 top-1 bottom-1 w-[4px] rounded-full"
              style={{ backgroundColor: color }}
            />

            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg pointer-events-none" />
            <div className="flex items-center justify-start gap-2 h-full px-3 pl-4 relative z-10 w-full overflow-hidden">
              {state.completed ? (
                <div className="p-1 rounded bg-green-500/20 border border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.4)] flex-shrink-0">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
              ) : state.isActive ? (
                <span className="w-2.5 h-2.5 rounded-full animate-pulse motion-reduce:animate-none shadow-[0_0_8px_rgba(167,139,250,0.8)] flex-shrink-0" style={{ backgroundColor: ANIM_ACCENT }} />
              ) : simMode && isInSimPath ? (
                <span className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)] flex-shrink-0" style={{ backgroundColor: ACCENT_ORANGE }} />
              ) : simMode && isDeadEnd ? (
                <AlertTriangle className="w-3.5 h-3.5 shadow-sm flex-shrink-0" style={{ color: MODULE_COLORS.evaluator }} />
              ) : state.hasMontage ? (
                <Sparkles className="w-3.5 h-3.5 drop-shadow-[0_0_4px_rgba(56,182,255,0.6)] flex-shrink-0" style={{ color: MODULE_COLORS.content }} />
              ) : (
                <span className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: `${color}60`, border: `1px solid ${color}40` }} />
              )}

              <div className="flex flex-col items-start truncate leading-none pt-[2px] w-full min-w-0">
                <span
                  className="text-[11px] font-bold tracking-wide font-mono truncate w-full"
                  style={{
                    color: state.completed ? STATUS_SUCCESS : state.isActive ? ANIM_ACCENT : isInSimPath ? ACCENT_ORANGE : 'var(--text)',
                    textShadow: state.isActive || state.completed || isInSimPath ? `0 0 10px ${color}80` : 'none'
                  }}
                >
                  {state.label}
                </span>
                {state.hasMontage && (
                  <span className="text-[11px] uppercase tracking-widest font-mono opacity-80 mt-1 block" style={{ color: STATUS_IMPROVED }}>Montage</span>
                )}
              </div>
            </div>

            {/* New state highlight — pulses, but holds a static border under reduced motion */}
            {state.isNew && (
              <div
                className="absolute inset-0 rounded-xl border-2 animate-pulse motion-reduce:animate-none pointer-events-none"
                style={{ borderColor: `${STATUS_SUCCESS}60` }}
              />
            )}
          </button>
        );
      })}
    </>
  );
}
