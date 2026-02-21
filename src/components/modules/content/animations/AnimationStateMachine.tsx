'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Film, Check, RefreshCw, Scan, AlertCircle, Sparkles, FileCode2,
  Play, RotateCcw, AlertTriangle, MousePointerClick,
} from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { getModuleName } from '@/lib/prompt-context';
import type { AnimBPScanResult, AnimTransition } from '@/app/api/filesystem/scan-animbp/route';
import {
  ACCENT_VIOLET, ACCENT_ORANGE, STATUS_SUCCESS, MODULE_COLORS,
  OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';

const ANIM_ACCENT = ACCENT_VIOLET;

// ── State type classification ──

type StateType = 'locomotion' | 'combat' | 'reaction' | 'montage' | 'other';

const STATE_TYPE_COLORS: Record<StateType, string> = {
  locomotion: MODULE_COLORS.core,
  combat: MODULE_COLORS.evaluator,
  reaction: ACCENT_ORANGE,
  montage: MODULE_COLORS.content,
  other: ANIM_ACCENT,
};

const LOCOMOTION_KEYWORDS = ['idle', 'walk', 'run', 'sprint', 'jump', 'jumpstart', 'jumploop', 'fall', 'falling', 'land', 'landing', 'locomotion', 'swimming', 'climbing'];
const COMBAT_KEYWORDS = ['attack', 'attacking', 'combo', 'block', 'blocking', 'dodge', 'dodging', 'cast', 'casting'];
const REACTION_KEYWORDS = ['hit', 'hitreact', 'stun', 'stunned', 'death', 'dead', 'knockback', 'flinch'];

function classifyState(name: string, hasMontage: boolean): StateType {
  const lower = name.toLowerCase();
  if (REACTION_KEYWORDS.some((k) => lower.includes(k))) return 'reaction';
  if (COMBAT_KEYWORDS.some((k) => lower.includes(k))) return 'combat';
  if (LOCOMOTION_KEYWORDS.some((k) => lower.includes(k))) return 'locomotion';
  if (hasMontage) return 'montage';
  return 'other';
}

// ── Hardcoded fallback states ──

interface StateNode {
  id: string;
  label: string;
  prompt: string;
  x: number;
  y: number;
  stateType: StateType;
}

const FALLBACK_STATES: StateNode[] = [
  { id: 'anim-idle', label: 'Idle', prompt: 'Implement the Idle state in the Animation Blueprint. Set up the idle animation with subtle breathing/sway, transition conditions to Walk (movement speed > 0), and an idle break montage system for variety.', x: 14, y: 50, stateType: 'locomotion' },
  { id: 'anim-walk', label: 'Walk', prompt: 'Implement the Walk state in the Animation Blueprint. Create a walk blend space driven by direction and speed, with transitions to Idle (speed ~ 0), Run (speed > walk threshold), and Jump (jump input).', x: 34, y: 50, stateType: 'locomotion' },
  { id: 'anim-run', label: 'Run', prompt: 'Implement the Run state in the Animation Blueprint. Create a run blend space with lean animations, transitions to Walk (speed < run threshold), Jump (jump input), and stamina-based sprint variation.', x: 54, y: 50, stateType: 'locomotion' },
  { id: 'anim-jump', label: 'Jump', prompt: 'Implement the Jump state in the Animation Blueprint. Create jump start animation with root motion, transition to Fall when vertical velocity becomes negative, and support for double-jump if enabled.', x: 50, y: 14, stateType: 'locomotion' },
  { id: 'anim-fall', label: 'Fall', prompt: 'Implement the Fall state in the Animation Blueprint. Create a falling loop animation with air control blend, transition to Land on ground contact, and a long-fall variant for extended airtime.', x: 78, y: 14, stateType: 'locomotion' },
  { id: 'anim-land', label: 'Land', prompt: 'Implement the Land state in the Animation Blueprint. Create soft and hard landing animations based on fall duration/velocity, with recovery transition back to Idle and optional roll for high falls.', x: 78, y: 50, stateType: 'locomotion' },
];

interface TransitionEdge {
  from: string;
  to: string;
  rule: string | null;
}

const FALLBACK_TRANSITIONS: TransitionEdge[] = [
  { from: 'anim-idle', to: 'anim-walk', rule: 'Speed > 0' },
  { from: 'anim-walk', to: 'anim-idle', rule: 'Speed ~ 0' },
  { from: 'anim-walk', to: 'anim-run', rule: 'Speed > Threshold' },
  { from: 'anim-run', to: 'anim-walk', rule: 'Speed < Threshold' },
  { from: 'anim-walk', to: 'anim-jump', rule: 'IsInAir' },
  { from: 'anim-run', to: 'anim-jump', rule: 'IsInAir' },
  { from: 'anim-jump', to: 'anim-fall', rule: 'VelZ < 0' },
  { from: 'anim-fall', to: 'anim-land', rule: '!IsInAir' },
  { from: 'anim-land', to: 'anim-idle', rule: 'AnimTime < 0.2' },
];

// ── Layout helpers ──

function layoutStates(states: { name: string; hasMontage: boolean }[]): StateNode[] {
  const count = states.length;
  if (count === 0) return [];

  if (count <= 8) {
    const cx = 50, cy = 50;
    const rx = 34, ry = 32;
    return states.map((s, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      return {
        id: `scanned-${s.name}`,
        label: s.name,
        prompt: `Implement or improve the "${s.name}" state in the Animation Blueprint. Ensure it has proper animation assets, transition conditions, and blending configured.`,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
        stateType: classifyState(s.name, s.hasMontage),
      };
    });
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const xPad = 14, yPad = 14;
  const xSpan = 72, ySpan = 72;

  return states.map((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: `scanned-${s.name}`,
      label: s.name,
      prompt: `Implement or improve the "${s.name}" state in the Animation Blueprint. Ensure it has proper animation assets, transition conditions, and blending configured.`,
      x: xPad + (cols > 1 ? (col / (cols - 1)) * xSpan : xSpan / 2),
      y: yPad + (rows > 1 ? (row / (rows - 1)) * ySpan : ySpan / 2),
      stateType: classifyState(s.name, s.hasMontage),
    };
  });
}

// ── Simulation helpers ──

function findReachableStates(transitions: TransitionEdge[], startId: string): Set<string> {
  const reachable = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const t of transitions) {
      if (t.from === current && !reachable.has(t.to)) {
        queue.push(t.to);
      }
    }
  }
  return reachable;
}

function findDeadEnds(transitions: TransitionEdge[], stateIds: string[]): Set<string> {
  const deadEnds = new Set<string>();
  for (const id of stateIds) {
    const outgoing = transitions.filter((t) => t.from === id);
    if (outgoing.length === 0) deadEnds.add(id);
  }
  return deadEnds;
}

// ── Component ──

interface AnimationStateMachineProps {
  onSelectState: (stateId: string, prompt: string) => void;
  isRunning: boolean;
  activeStateId: string | null;
}

const EMPTY_PROGRESS: Record<string, boolean> = {};
const NODE_W = 110;
const NODE_H = 46;

export function AnimationStateMachine({ onSelectState, isRunning, activeStateId }: AnimationStateMachineProps) {
  const progress = useModuleStore((s) => s.checklistProgress['animations'] ?? EMPTY_PROGRESS);
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);

  const [scanResult, setScanResult] = useState<AnimBPScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Simulation mode
  const [simMode, setSimMode] = useState(false);
  const [simPath, setSimPath] = useState<string[]>([]);
  const [simUnreachable, setSimUnreachable] = useState<Set<string>>(new Set());
  const [simDeadEnds, setSimDeadEnds] = useState<Set<string>>(new Set());

  // Diff tracking
  const prevScanRef = useRef<AnimBPScanResult | null>(null);
  const [newStateIds, setNewStateIds] = useState<Set<string>>(new Set());
  const [modifiedTransitions, setModifiedTransitions] = useState<Set<string>>(new Set());
  const diffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hovered transition for showing rule label
  const [hoveredTransition, setHoveredTransition] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!projectPath || !projectName || isScanning) return;
    setIsScanning(true);
    setScanError(null);

    try {
      const moduleName = getModuleName(projectName);
      const res = await fetch('/api/filesystem/scan-animbp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, moduleName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scan failed' }));
        setScanError(err.error ?? `Scan failed (${res.status})`);
        return;
      }
      const data: AnimBPScanResult = await res.json();

      // Compute diff against previous scan
      if (prevScanRef.current && prevScanRef.current.states.length > 0) {
        const oldNames = new Set(prevScanRef.current.states.map((s) => s.name));
        const newIds = new Set<string>();
        for (const s of data.states) {
          if (!oldNames.has(s.name)) newIds.add(`scanned-${s.name}`);
        }
        setNewStateIds(newIds);

        const oldTransKeys = new Set(prevScanRef.current.transitions.map((t) => `${t.from}->${t.to}`));
        const modifiedKeys = new Set<string>();
        for (const t of data.transitions) {
          const key = `scanned-${t.from}->scanned-${t.to}`;
          if (!oldTransKeys.has(`${t.from}->${t.to}`)) modifiedKeys.add(key);
        }
        setModifiedTransitions(modifiedKeys);

        // Clear diff animations after 5 seconds
        if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
        diffTimerRef.current = setTimeout(() => {
          setNewStateIds(new Set());
          setModifiedTransitions(new Set());
        }, 5000);
      }

      prevScanRef.current = data;
      setScanResult(data);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan');
    } finally {
      setIsScanning(false);
    }
  }, [projectPath, projectName, isScanning]);

  // Cleanup diff timer
  useEffect(() => {
    return () => {
      if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
    };
  }, []);

  const hasScannedData = scanResult && scanResult.states.length > 0;

  const { states: displayStates, transitions: displayTransitions } = useMemo(() => {
    if (hasScannedData) {
      const scannedStates = layoutStates(scanResult.states);
      const scannedTransitions: TransitionEdge[] = scanResult.transitions.map((t: AnimTransition) => ({
        from: `scanned-${t.from}`,
        to: `scanned-${t.to}`,
        rule: t.rule,
      }));
      return { states: scannedStates, transitions: scannedTransitions };
    }
    return { states: FALLBACK_STATES, transitions: FALLBACK_TRANSITIONS };
  }, [hasScannedData, scanResult]);

  const montageSet = useMemo(() => {
    if (!scanResult) return new Set<string>();
    return new Set(
      scanResult.states.filter((s) => s.hasMontage).map((s) => `scanned-${s.name}`)
    );
  }, [scanResult]);

  // Build transition rule map for label display
  const transitionRuleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of displayTransitions) {
      if (t.rule) m.set(`${t.from}->${t.to}`, t.rule);
    }
    return m;
  }, [displayTransitions]);

  const stateNodes = useMemo(() => {
    return displayStates.map((state) => {
      const completed = !!progress[state.id];
      const isActive = activeStateId === state.id;
      const hasMontage = montageSet.has(state.id);
      const isNew = newStateIds.has(state.id);
      return { ...state, completed, isActive, hasMontage, isNew };
    });
  }, [displayStates, progress, activeStateId, montageSet, newStateIds]);

  const stateMap = useMemo(
    () => Object.fromEntries(stateNodes.map((n) => [n.id, n])),
    [stateNodes],
  );

  // Simulation mode handlers
  const handleSimClick = useCallback((stateId: string) => {
    if (!simMode) return;

    setSimPath((prev) => {
      if (prev.length === 0) {
        // First click — set start state and compute reachable + dead ends
        const reachable = findReachableStates(displayTransitions, stateId);
        const allIds = displayStates.map((s) => s.id);
        const unreachable = new Set(allIds.filter((id) => !reachable.has(id)));
        setSimUnreachable(unreachable);
        setSimDeadEnds(findDeadEnds(displayTransitions, allIds));
        return [stateId];
      }

      const lastState = prev[prev.length - 1];
      // Check if this transition is valid
      const validTransition = displayTransitions.some((t) => t.from === lastState && t.to === stateId);
      if (validTransition) {
        return [...prev, stateId];
      }
      // If clicking the same state, do nothing
      return prev;
    });
  }, [simMode, displayTransitions, displayStates]);

  const simEdges = useMemo(() => {
    const edges = new Set<string>();
    for (let i = 0; i < simPath.length - 1; i++) {
      edges.add(`${simPath[i]}->${simPath[i + 1]}`);
    }
    return edges;
  }, [simPath]);

  const validNextStates = useMemo(() => {
    if (!simMode || simPath.length === 0) return new Set<string>();
    const last = simPath[simPath.length - 1];
    return new Set(displayTransitions.filter((t) => t.from === last).map((t) => t.to));
  }, [simMode, simPath, displayTransitions]);

  const handleClick = useCallback(
    (state: StateNode) => {
      if (simMode) {
        handleSimClick(state.id);
        return;
      }
      if (isRunning) return;
      onSelectState(state.id, state.prompt);
    },
    [simMode, handleSimClick, onSelectState, isRunning],
  );

  const toggleSimMode = useCallback(() => {
    setSimMode((prev) => {
      if (prev) {
        // Exiting sim mode — clear state
        setSimPath([]);
        setSimUnreachable(new Set());
        setSimDeadEnds(new Set());
      }
      return !prev;
    });
  }, []);

  const resetSimPath = useCallback(() => {
    setSimPath([]);
    setSimUnreachable(new Set());
    setSimDeadEnds(new Set());
  }, []);

  const completedCount = stateNodes.filter((n) => n.completed).length;

  // Node color based on state type
  const getNodeColor = (state: typeof stateNodes[0]) => {
    if (state.completed) return STATUS_SUCCESS;
    if (state.isActive) return ANIM_ACCENT;
    return STATE_TYPE_COLORS[state.stateType];
  };

  return (
    <div className="w-full max-w-4xl mx-auto select-none p-6 bg-[#03030a] rounded-2xl border border-violet-900/30 relative overflow-hidden shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] flex flex-col gap-6">
      {/* Schematic Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(${ANIM_ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${ANIM_ACCENT} 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-600/10 blur-[100px] rounded-full pointer-events-none" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between relative z-10 border-b border-violet-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl grid place-items-center bg-violet-950/50 border border-violet-800/50 shadow-[0_0_15px_rgba(167,139,250,0.15)] relative overflow-hidden">
            <Film className="w-5 h-5 text-violet-400 relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-violet-500/20 to-transparent" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-violet-100 font-mono tracking-widest uppercase flex items-center gap-3" style={{ textShadow: '0 0 8px rgba(167,139,250,0.4)' }}>
              STATE_MACHINE.graph <span className="text-[9px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.2)]">RUNTIME</span>
            </h3>
            <p className="text-[10px] text-violet-400/80 font-mono uppercase tracking-widest mt-0.5">
              {simMode
                ? simPath.length === 0
                  ? 'Click a state to begin tracing'
                  : `${simPath.length} states in path — click valid transitions to continue`
                : `${completedCount}/${displayStates.length} states${hasScannedData ? ' // SCANNED FROM PROJECT' : ' // CLICK TO IMPLEMENT'}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Simulate button */}
          <button
            onClick={toggleSimMode}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg"
            style={{
              backgroundColor: simMode ? `${ACCENT_ORANGE}20` : `${ANIM_ACCENT}20`,
              color: simMode ? ACCENT_ORANGE : ANIM_ACCENT,
              border: `1px solid ${simMode ? ACCENT_ORANGE : ANIM_ACCENT}`,
              boxShadow: simMode ? `0 0 15px ${ACCENT_ORANGE}40, inset 0 0 10px ${ACCENT_ORANGE}20` : `0 0 10px ${ANIM_ACCENT}30, inset 0 0 10px ${ANIM_ACCENT}15`,
            }}
          >
            {simMode ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {simMode ? 'Exit Sim' : 'Simulate'}
          </button>

          {/* Scan button */}
          {projectPath && projectName && !simMode && (
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg"
              style={{
                backgroundColor: hasScannedData ? `${STATUS_SUCCESS}20` : `${ANIM_ACCENT}20`,
                color: hasScannedData ? STATUS_SUCCESS : ANIM_ACCENT,
                border: `1px solid ${hasScannedData ? STATUS_SUCCESS : ANIM_ACCENT}`,
                boxShadow: hasScannedData ? `0 0 15px ${STATUS_SUCCESS}40, inset 0 0 10px ${STATUS_SUCCESS}20` : `0 0 10px ${ANIM_ACCENT}30, inset 0 0 10px ${ANIM_ACCENT}15`,
              }}
            >
              {isScanning ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Scan className="w-3.5 h-3.5" />
              )}
              {isScanning ? 'Scanning...' : hasScannedData ? 'Rescan' : 'Scan Project'}
            </button>
          )}
        </div>
      </div>

      {/* Simulation reset bar */}
      {simMode && simPath.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{ borderColor: `${ACCENT_ORANGE}${OPACITY_30}`, backgroundColor: `${ACCENT_ORANGE}06` }}>
          <div className="flex items-center gap-2 min-w-0">
            <MousePointerClick className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT_ORANGE }} />
            <span className="text-2xs text-text-muted truncate">
              Path: {simPath.map((id) => stateMap[id]?.label ?? id).join(' → ')}
            </span>
          </div>
          <button
            onClick={resetSimPath}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors"
            style={{ color: ACCENT_ORANGE }}
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>
        </div>
      )}

      {/* Scan error */}
      {scanError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-status-red-subtle border border-status-red-medium text-2xs text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {scanError}
        </div>
      )}

      {/* Scan metadata */}
      {scanResult && !simMode && (
        <div className="flex flex-wrap items-center gap-3 text-2xs text-text-muted">
          {scanResult.animInstanceClass && (
            <span className="flex items-center gap-1">
              <FileCode2 className="w-2.5 h-2.5" />
              {scanResult.animInstanceClass}
            </span>
          )}
          {scanResult.headerPath && (
            <span className="flex items-center gap-1 font-mono text-text-muted">
              {scanResult.headerPath}
            </span>
          )}
          {scanResult.montageRefs.length > 0 && (
            <span className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {scanResult.montageRefs.length} montage ref{scanResult.montageRefs.length !== 1 ? 's' : ''}
            </span>
          )}
          {scanResult.animVariables.length > 0 && (
            <span>
              {scanResult.animVariables.length} anim var{scanResult.animVariables.length !== 1 ? 's' : ''}
            </span>
          )}
          {scanResult.states.length === 0 && !scanError && (
            <span className="text-[#f59e0b]">
              No states found — AnimBP states may be defined in Blueprint only
            </span>
          )}
        </div>
      )}

      {/* State machine diagram */}
      <div
        className="relative rounded-xl border-2 border-surface-deep bg-[#050510]/80 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] overflow-hidden z-10"
        style={{ height: displayStates.length > 8 ? 450 : 350 }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20 z-0" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(167,139,250,0.15) 0%, transparent 70%)' }} />
        {/* SVG transitions layer */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          <defs>
            <marker
              id="sm-arrow"
              viewBox="0 0 8 6"
              refX="8"
              refY="3"
              markerWidth="6"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 3 L 0 6 z" fill={`${ANIM_ACCENT}40`} />
            </marker>
            <marker
              id="sm-arrow-done"
              viewBox="0 0 8 6"
              refX="8"
              refY="3"
              markerWidth="6"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 3 L 0 6 z" fill={`${STATUS_SUCCESS}40`} />
            </marker>
            <marker
              id="sm-arrow-sim"
              viewBox="0 0 8 6"
              refX="8"
              refY="3"
              markerWidth="6"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 3 L 0 6 z" fill="#f97316" />
            </marker>
            <marker
              id="sm-arrow-modified"
              viewBox="0 0 8 6"
              refX="8"
              refY="3"
              markerWidth="6"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 3 L 0 6 z" fill="#eab308" />
            </marker>
            {/* Glow filter for new states */}
            <filter id="glow-new" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {displayTransitions.map(({ from, to, rule }) => {
            const fromNode = stateMap[from];
            const toNode = stateMap[to];
            if (!fromNode || !toNode) return null;

            const edgeKey = `${from}->${to}`;
            const bothDone = fromNode.completed && toNode.completed;
            const isSimEdge = simEdges.has(edgeKey);
            const isModified = modifiedTransitions.has(edgeKey);
            const isHovered = hoveredTransition === edgeKey;

            const reverseExists = displayTransitions.some((t) => t.from === to && t.to === from);
            const isForward = from < to;
            const perpOffset = reverseExists ? (isForward ? -1.5 : 1.5) : 0;

            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;
            const nx = dx / dist;
            const ny = dy / dist;
            const px = -ny;
            const py = nx;
            const edgeOffset = 8;

            const x1 = fromNode.x + nx * edgeOffset + px * perpOffset;
            const y1 = fromNode.y + ny * edgeOffset + py * perpOffset;
            const x2 = toNode.x - nx * edgeOffset + px * perpOffset;
            const y2 = toNode.y - ny * edgeOffset + py * perpOffset;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const ruleText = rule ?? transitionRuleMap.get(edgeKey) ?? null;

            let strokeColor = bothDone ? `${STATUS_SUCCESS}50` : `${ANIM_ACCENT}30`;
            let strokeWidth = bothDone ? 2 : 1.5;
            let markerEnd = bothDone ? 'url(#sm-arrow-done)' : 'url(#sm-arrow)';

            if (isSimEdge) {
              strokeColor = ACCENT_ORANGE;
              strokeWidth = 2.5;
              markerEnd = 'url(#sm-arrow-sim)';
            } else if (isModified) {
              strokeColor = '#eab308';
              strokeWidth = 2;
              markerEnd = 'url(#sm-arrow-modified)';
            }

            if (isHovered && !isSimEdge) {
              strokeColor = ANIM_ACCENT;
              strokeWidth = 2.5;
            }

            return (
              <g key={edgeKey} className="group/edge">
                {/* Invisible wider line for hover target */}
                <line
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="transparent"
                  strokeWidth={15}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredTransition(edgeKey)}
                  onMouseLeave={() => setHoveredTransition(null)}
                />

                {/* Glow underlay */}
                {(bothDone || isSimEdge || isHovered) && (
                  <line
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth * 3}
                    opacity="0.3"
                    className="pointer-events-none"
                    style={{ filter: 'blur(3px)' }}
                  />
                )}

                <line
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  markerEnd={markerEnd}
                  className="pointer-events-none transition-all duration-300"
                  strokeDasharray={(bothDone || isSimEdge) ? "6, 6" : "none"}
                >
                  {isModified && (
                    <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="5" />
                  )}
                  {(bothDone || isSimEdge) && (
                    <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.8s" repeatCount="indefinite" />
                  )}
                </line>
                {/* Transition rule label on hover */}
                {ruleText && isHovered && (
                  <g>
                    <rect
                      x={`${midX - 4}%`}
                      y={`${midY - 3}%`}
                      width="8%"
                      height="6%"
                      rx="3"
                      fill="#1a1a2e"
                      stroke={ANIM_ACCENT}
                      strokeWidth="0.5"
                      opacity="0.95"
                    />
                    <text
                      x={`${midX}%`}
                      y={`${midY}%`}
                      fill={ANIM_ACCENT}
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {ruleText}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* State nodes */}
        {stateNodes.map((state) => {
          const color = getNodeColor(state);
          const isInSimPath = simPath.includes(state.id);
          const isValidNext = validNextStates.has(state.id);
          const isUnreachable = simUnreachable.has(state.id) && simPath.length > 0;
          const isDeadEnd = simDeadEnds.has(state.id) && simPath.length > 0;

          let borderColor = `${color}40`;
          let bgColor = `${color}0A`;
          let shadow = 'none';
          let extraClass = 'cursor-pointer hover:scale-105';

          if (state.completed) {
            borderColor = `${STATUS_SUCCESS}60`;
            bgColor = `${STATUS_SUCCESS}15`;
            shadow = `0 0 15px ${STATUS_SUCCESS}30, inset 0 0 10px ${STATUS_SUCCESS}10`;
          } else if (state.isActive) {
            borderColor = `${ANIM_ACCENT}80`;
            bgColor = `${ANIM_ACCENT}20`;
            shadow = `0 0 20px ${ANIM_ACCENT}40, inset 0 0 15px ${ANIM_ACCENT}20`;
            extraClass += ' ring-2 ring-violet-500/50 ring-offset-2 ring-offset-[#03030a]';
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
                  <span className="w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.8)] flex-shrink-0" style={{ backgroundColor: ANIM_ACCENT }} />
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
                      color: state.completed ? STATUS_SUCCESS : state.isActive ? ANIM_ACCENT : isInSimPath ? ACCENT_ORANGE : '#e2e8f0',
                      textShadow: state.isActive || state.completed || isInSimPath ? `0 0 10px ${color}80` : 'none'
                    }}
                  >
                    {state.label}
                  </span>
                  {state.hasMontage && (
                    <span className="text-[8px] text-[#38b6ff] uppercase tracking-widest font-mono opacity-80 mt-1 block">Montage</span>
                  )}
                </div>
              </div>

              {/* New state pulse animation */}
              {state.isNew && (
                <div
                  className="absolute inset-0 rounded-xl border-2 animate-pulse pointer-events-none"
                  style={{ borderColor: `${STATUS_SUCCESS}60` }}
                />
              )}
            </button>
          );
        })}

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
                <Check className="w-2 h-2 text-[#22c55e]" />
                done
              </span>
            </>
          )}
        </div>
      </div>

      {/* Simulation summary */}
      {simMode && simPath.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-surface-deep px-3 py-2 text-center">
            <div className="text-xs font-bold text-text">{simPath.length}</div>
            <div className="text-2xs text-text-muted">states visited</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-deep px-3 py-2 text-center">
            <div className="text-xs font-bold" style={{ color: simUnreachable.size > 0 ? MODULE_COLORS.evaluator : STATUS_SUCCESS }}>
              {simUnreachable.size}
            </div>
            <div className="text-2xs text-text-muted">unreachable</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-deep px-3 py-2 text-center">
            <div className="text-xs font-bold" style={{ color: simDeadEnds.size > 0 ? ACCENT_ORANGE : STATUS_SUCCESS }}>
              {simDeadEnds.size}
            </div>
            <div className="text-2xs text-text-muted">dead ends</div>
          </div>
        </div>
      )}

      {/* Montage & variable detail (scanned mode, non-sim) */}
      {scanResult && scanResult.montageRefs.length > 0 && !simMode && (
        <div className="rounded-lg border border-border bg-surface-deep px-3 py-2.5">
          <h4 className="text-2xs font-semibold text-text-muted-hover mb-1.5">Montage References</h4>
          <div className="flex flex-wrap gap-1.5">
            {scanResult.montageRefs.map((ref) => (
              <span
                key={ref}
                className="text-2xs px-2 py-0.5 rounded-full font-mono"
                style={{
                  backgroundColor: `${MODULE_COLORS.content}0a`,
                  color: MODULE_COLORS.content,
                  border: `1px solid ${MODULE_COLORS.content}${OPACITY_20}`,
                }}
              >
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}

      {scanResult && scanResult.animVariables.length > 0 && !simMode && (
        <div className="rounded-lg border border-border bg-surface-deep px-3 py-2.5">
          <h4 className="text-2xs font-semibold text-text-muted-hover mb-1.5">Animation Variables</h4>
          <div className="flex flex-wrap gap-1.5">
            {scanResult.animVariables.map((v) => (
              <span
                key={v}
                className="text-2xs px-2 py-0.5 rounded-full font-mono"
                style={{
                  backgroundColor: `${ANIM_ACCENT}08`,
                  color: ANIM_ACCENT,
                  border: `1px solid ${ANIM_ACCENT}18`,
                }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
