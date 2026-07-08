import { Check, AlertTriangle, Sparkles } from 'lucide-react';
import { ACCENT_ORANGE, STATUS_SUCCESS, MODULE_COLORS } from '@/lib/chart-colors';
import { SchematicPanel } from '@/components/ui/SchematicPanel';
import { ANIM_ACCENT } from './constants';
import { StateMachineEdges } from './StateMachineEdges';
import { StateMachineNodes } from './StateMachineNodes';
import type { StateNode, StateNodeView, TransitionEdge } from './types';

interface StateMachineDiagramProps {
  displayStates: StateNode[];
  displayTransitions: TransitionEdge[];
  stateMap: Record<string, StateNodeView>;
  simEdges: Set<string>;
  modifiedTransitions: Set<string>;
  hoveredTransition: string | null;
  setHoveredTransition: (key: string | null) => void;
  edgeKeySet: Set<string>;
  transitionRuleMap: Map<string, string>;
  prefersReducedMotion: boolean | null;
  stateNodes: StateNodeView[];
  simMode: boolean;
  simPath: string[];
  validNextStates: Set<string>;
  simUnreachable: Set<string>;
  simDeadEnds: Set<string>;
  isRunning: boolean;
  handleClick: (state: StateNodeView) => void;
}

export function StateMachineDiagram({
  displayStates,
  displayTransitions,
  stateMap,
  simEdges,
  modifiedTransitions,
  hoveredTransition,
  setHoveredTransition,
  edgeKeySet,
  transitionRuleMap,
  prefersReducedMotion,
  stateNodes,
  simMode,
  simPath,
  validNextStates,
  simUnreachable,
  simDeadEnds,
  isRunning,
  handleClick,
}: StateMachineDiagramProps) {
  return (
    <SchematicPanel
      tone="well"
      accent={ANIM_ACCENT}
      grid={false}
      radial
      className="z-10"
      style={{ height: displayStates.length > 8 ? 450 : 350 }}
    >
      {/* SVG transitions layer */}
      <StateMachineEdges
        displayTransitions={displayTransitions}
        stateMap={stateMap}
        simEdges={simEdges}
        modifiedTransitions={modifiedTransitions}
        hoveredTransition={hoveredTransition}
        setHoveredTransition={setHoveredTransition}
        edgeKeySet={edgeKeySet}
        transitionRuleMap={transitionRuleMap}
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* State nodes */}
      <StateMachineNodes
        stateNodes={stateNodes}
        simMode={simMode}
        simPath={simPath}
        validNextStates={validNextStates}
        simUnreachable={simUnreachable}
        simDeadEnds={simDeadEnds}
        isRunning={isRunning}
        handleClick={handleClick}
      />

      {/* Entry indicator */}
      {displayStates.length > 0 && (
        <div
          className="absolute flex items-center gap-0.5"
          style={{
            left: `${displayStates[0].x - 8}%`,
            top: `${displayStates[0].y}%`,
            transform: 'translate(-100%, -50%)',
            zIndex: 2,
          }}
        >
          <span className="text-2xs text-text-muted uppercase tracking-wider font-medium">Entry</span>
          <svg width="16" height="8" viewBox="0 0 16 8">
            <line x1="0" y1="4" x2="12" y2="4" stroke={`${ANIM_ACCENT}50`} strokeWidth="1" />
            <path d="M 10 1 L 14 4 L 10 7" stroke={`${ANIM_ACCENT}50`} strokeWidth="1" fill="none" />
          </svg>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex items-center gap-2.5 text-2xs text-text-muted" style={{ zIndex: 2 }}>
        {simMode ? (
          <>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_ORANGE }} />
              path
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-2 h-2" style={{ color: MODULE_COLORS.evaluator }} />
              dead end
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full opacity-50" style={{ backgroundColor: MODULE_COLORS.evaluator }} />
              unreachable
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: MODULE_COLORS.core }} />
              locomotion
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: MODULE_COLORS.evaluator }} />
              combat
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: ACCENT_ORANGE }} />
              reaction
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-2 h-2" style={{ color: MODULE_COLORS.content }} />
              montage
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-2 h-2" style={{ color: STATUS_SUCCESS }} />
              done
            </span>
          </>
        )}
      </div>
    </SchematicPanel>
  );
}
