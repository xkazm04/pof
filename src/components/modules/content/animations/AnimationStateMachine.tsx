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

const ANIM_ACCENT = '#a78bfa';

// ── State type classification ──

type StateType = 'locomotion' | 'combat' | 'reaction' | 'montage' | 'other';

const STATE_TYPE_COLORS: Record<StateType, string> = {
  locomotion: '#3b82f6', // blue
  combat: '#ef4444',     // red
  reaction: '#f97316',   // orange
  montage: '#f59e0b',    // amber
  other: ANIM_ACCENT,    // violet
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
const NODE_W = 90;
const NODE_H = 44;

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
    if (state.completed) return '#22c55e';
    if (state.isActive) return ANIM_ACCENT;
    return STATE_TYPE_COLORS[state.stateType];
  };

  return (
    <div className="w-full max-w-xl mx-auto select-none space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4" style={{ color: ANIM_ACCENT }} />
          <div>
            <h3 className="text-xs font-semibold text-text">
              {simMode ? 'Simulation Mode' : hasScannedData ? 'Project State Machine' : 'Locomotion State Machine'}
            </h3>
            <p className="text-2xs text-text-muted">
              {simMode
                ? simPath.length === 0
                  ? 'Click a state to begin tracing'
                  : `${simPath.length} states in path — click valid transitions to continue`
                : `${completedCount}/${displayStates.length} states${hasScannedData ? ' (scanned from project)' : ' — click a state to implement it'}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Simulate button */}
          <button
            onClick={toggleSimMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium transition-all"
            style={{
              backgroundColor: simMode ? '#f9731610' : `${ANIM_ACCENT}08`,
              color: simMode ? '#f97316' : ANIM_ACCENT,
              border: `1px solid ${simMode ? '#f9731630' : `${ANIM_ACCENT}20`}`,
            }}
          >
            {simMode ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {simMode ? 'Exit Sim' : 'Simulate'}
          </button>

          {/* Scan button */}
          {projectPath && projectName && !simMode && (
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: hasScannedData ? '#22c55e10' : `${ANIM_ACCENT}10`,
                color: hasScannedData ? '#22c55e' : ANIM_ACCENT,
                border: `1px solid ${hasScannedData ? '#22c55e25' : `${ANIM_ACCENT}25`}`,
              }}
            >
              {isScanning ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Scan className="w-3 h-3" />
              )}
              {isScanning ? 'Scanning...' : hasScannedData ? 'Rescan' : 'Scan Project'}
            </button>
          )}
        </div>
      </div>

      {/* Simulation reset bar */}
      {simMode && simPath.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{ borderColor: '#f9731630', backgroundColor: '#f9731606' }}>
          <div className="flex items-center gap-2 min-w-0">
            <MousePointerClick className="w-3 h-3 flex-shrink-0" style={{ color: '#f97316' }} />
            <span className="text-2xs text-text-muted truncate">
              Path: {simPath.map((id) => stateMap[id]?.label ?? id).join(' → ')}
            </span>
          </div>
          <button
            onClick={resetSimPath}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors"
            style={{ color: '#f97316' }}
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
        className="relative rounded-xl border border-border bg-[#0a0a1e]"
        style={{ height: displayStates.length > 8 ? 300 : 220 }}
      >
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
              <path d="M 0 0 L 8 3 L 0 6 z" fill="#22c55e40" />
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

            let strokeColor = bothDone ? '#22c55e20' : `${ANIM_ACCENT}18`;
            let strokeWidth = 1;
            let markerEnd = bothDone ? 'url(#sm-arrow-done)' : 'url(#sm-arrow)';

            if (isSimEdge) {
              strokeColor = '#f97316';
              strokeWidth = 2;
              markerEnd = 'url(#sm-arrow-sim)';
            } else if (isModified) {
              strokeColor = '#eab308';
              strokeWidth = 1.5;
              markerEnd = 'url(#sm-arrow-modified)';
            }

            if (isHovered && !isSimEdge) {
              strokeColor = ANIM_ACCENT;
              strokeWidth = 1.5;
            }

            return (
              <g key={edgeKey}>
                {/* Invisible wider line for hover target */}
                <line
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="transparent"
                  strokeWidth={10}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredTransition(edgeKey)}
                  onMouseLeave={() => setHoveredTransition(null)}
                />
                <line
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  markerEnd={markerEnd}
                  className="pointer-events-none"
                >
                  {isModified && (
                    <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="5" />
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

          let borderColor = `${color}30`;
          let bgColor = `${color}06`;
          let extraClass = 'cursor-pointer';

          if (state.completed) {
            borderColor = '#22c55e40';
            bgColor = '#22c55e08';
          } else if (state.isActive) {
            borderColor = `${ANIM_ACCENT}50`;
            bgColor = `${ANIM_ACCENT}10`;
          } else if (simMode) {
            if (isInSimPath) {
              borderColor = '#f9731660';
              bgColor = '#f9731610';
            } else if (isValidNext) {
              borderColor = `${color}50`;
              bgColor = `${color}12`;
              extraClass = 'cursor-pointer ring-1 ring-offset-0';
            } else if (isUnreachable) {
              borderColor = '#ef444440';
              bgColor = '#ef444408';
              extraClass = 'opacity-50';
            } else {
              borderColor = `${color}15`;
              bgColor = `${color}04`;
              extraClass = 'opacity-60';
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
              className={`absolute rounded-lg border transition-all duration-base group ${extraClass}`}
              style={{
                left: `${state.x}%`,
                top: `${state.y}%`,
                transform: 'translate(-50%, -50%)',
                width: NODE_W,
                height: NODE_H,
                zIndex: 1,
                borderColor,
                backgroundColor: bgColor,
                ...(state.isNew ? { filter: 'url(#glow-new)' } : {}),
              }}
            >
              {/* Type color strip on the left edge */}
              <div
                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                style={{ backgroundColor: color }}
              />

              <div className="flex items-center justify-center gap-1.5 h-full px-2 pl-3">
                {state.completed ? (
                  <Check className="w-3 h-3 text-[#22c55e] flex-shrink-0" />
                ) : state.isActive ? (
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                    style={{ backgroundColor: ANIM_ACCENT }}
                  />
                ) : simMode && isInSimPath ? (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#f97316' }} />
                ) : simMode && isDeadEnd ? (
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: '#ef4444' }} />
                ) : state.hasMontage ? (
                  <Sparkles className="w-2.5 h-2.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `${color}40`, border: `1px solid ${color}30` }}
                  />
                )}
                <span
                  className="text-xs font-semibold leading-none truncate"
                  style={{
                    color: state.completed
                      ? '#22c55e'
                      : state.isActive
                        ? ANIM_ACCENT
                        : isInSimPath
                          ? '#f97316'
                          : color,
                  }}
                >
                  {state.label}
                </span>
              </div>

              {/* New state pulse animation */}
              {state.isNew && (
                <div
                  className="absolute inset-0 rounded-lg border-2 animate-pulse pointer-events-none"
                  style={{ borderColor: '#22c55e60' }}
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
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f97316' }} />
                path
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-2 h-2" style={{ color: '#ef4444' }} />
                dead end
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full opacity-50" style={{ backgroundColor: '#ef4444' }} />
                unreachable
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />
                locomotion
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                combat
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#f97316' }} />
                reaction
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-2 h-2" style={{ color: '#f59e0b' }} />
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
            <div className="text-xs font-bold" style={{ color: simUnreachable.size > 0 ? '#ef4444' : '#22c55e' }}>
              {simUnreachable.size}
            </div>
            <div className="text-2xs text-text-muted">unreachable</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-deep px-3 py-2 text-center">
            <div className="text-xs font-bold" style={{ color: simDeadEnds.size > 0 ? '#f97316' : '#22c55e' }}>
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
                  backgroundColor: '#f59e0b0a',
                  color: '#f59e0b',
                  border: '1px solid #f59e0b20',
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
