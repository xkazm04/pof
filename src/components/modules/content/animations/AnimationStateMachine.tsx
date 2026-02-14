'use client';

import { useState, useCallback, useMemo } from 'react';
import { Film, Check, RefreshCw, Scan, AlertCircle, Sparkles, FileCode2 } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { getModuleName } from '@/lib/prompt-context';
import type { AnimBPScanResult } from '@/app/api/filesystem/scan-animbp/route';

const ANIM_ACCENT = '#a78bfa';

// ── Hardcoded fallback states ──

interface StateNode {
  id: string;
  label: string;
  prompt: string;
  x: number;
  y: number;
}

const FALLBACK_STATES: StateNode[] = [
  { id: 'anim-idle', label: 'Idle', prompt: 'Implement the Idle state in the Animation Blueprint. Set up the idle animation with subtle breathing/sway, transition conditions to Walk (movement speed > 0), and an idle break montage system for variety.', x: 14, y: 50 },
  { id: 'anim-walk', label: 'Walk', prompt: 'Implement the Walk state in the Animation Blueprint. Create a walk blend space driven by direction and speed, with transitions to Idle (speed ≈ 0), Run (speed > walk threshold), and Jump (jump input).', x: 34, y: 50 },
  { id: 'anim-run', label: 'Run', prompt: 'Implement the Run state in the Animation Blueprint. Create a run blend space with lean animations, transitions to Walk (speed < run threshold), Jump (jump input), and stamina-based sprint variation.', x: 54, y: 50 },
  { id: 'anim-jump', label: 'Jump', prompt: 'Implement the Jump state in the Animation Blueprint. Create jump start animation with root motion, transition to Fall when vertical velocity becomes negative, and support for double-jump if enabled.', x: 50, y: 14 },
  { id: 'anim-fall', label: 'Fall', prompt: 'Implement the Fall state in the Animation Blueprint. Create a falling loop animation with air control blend, transition to Land on ground contact, and a long-fall variant for extended airtime.', x: 78, y: 14 },
  { id: 'anim-land', label: 'Land', prompt: 'Implement the Land state in the Animation Blueprint. Create soft and hard landing animations based on fall duration/velocity, with recovery transition back to Idle and optional roll for high falls.', x: 78, y: 50 },
];

const FALLBACK_TRANSITIONS: { from: string; to: string }[] = [
  { from: 'anim-idle', to: 'anim-walk' },
  { from: 'anim-walk', to: 'anim-idle' },
  { from: 'anim-walk', to: 'anim-run' },
  { from: 'anim-run', to: 'anim-walk' },
  { from: 'anim-walk', to: 'anim-jump' },
  { from: 'anim-run', to: 'anim-jump' },
  { from: 'anim-jump', to: 'anim-fall' },
  { from: 'anim-fall', to: 'anim-land' },
  { from: 'anim-land', to: 'anim-idle' },
];

// ── Layout helpers ──

/**
 * Distribute scanned states in a circular/grid layout.
 * If <= 8 states, use a circle. Otherwise use a grid.
 */
function layoutStates(states: { name: string; hasMontage: boolean }[]): StateNode[] {
  const count = states.length;
  if (count === 0) return [];

  if (count <= 8) {
    // Circular layout
    const cx = 50, cy = 50;
    const rx = 34, ry = 32;
    return states.map((s, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2; // Start from top
      return {
        id: `scanned-${s.name}`,
        label: s.name,
        prompt: `Implement or improve the "${s.name}" state in the Animation Blueprint. Ensure it has proper animation assets, transition conditions, and blending configured.`,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      };
    });
  }

  // Grid layout for many states
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
    };
  });
}

// ── Component ──

interface AnimationStateMachineProps {
  onSelectState: (stateId: string, prompt: string) => void;
  isRunning: boolean;
  activeStateId: string | null;
}

const EMPTY_PROGRESS: Record<string, boolean> = {};
const NODE_W = 80;
const NODE_H = 40;

export function AnimationStateMachine({ onSelectState, isRunning, activeStateId }: AnimationStateMachineProps) {
  const progress = useModuleStore((s) => s.checklistProgress['animations'] ?? EMPTY_PROGRESS);
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);

  const [scanResult, setScanResult] = useState<AnimBPScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

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
      setScanResult(data);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan');
    } finally {
      setIsScanning(false);
    }
  }, [projectPath, projectName, isScanning]);

  // Determine if we show scanned data or fallback
  const hasScannedData = scanResult && scanResult.states.length > 0;

  const { states: displayStates, transitions: displayTransitions } = useMemo(() => {
    if (hasScannedData) {
      const scannedStates = layoutStates(scanResult.states);
      const scannedTransitions = scanResult.transitions.map((t) => ({
        from: `scanned-${t.from}`,
        to: `scanned-${t.to}`,
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

  const stateNodes = useMemo(() => {
    return displayStates.map((state) => {
      const completed = !!progress[state.id];
      const isActive = activeStateId === state.id;
      const hasMontage = montageSet.has(state.id);
      return { ...state, completed, isActive, hasMontage };
    });
  }, [displayStates, progress, activeStateId, montageSet]);

  const stateMap = useMemo(
    () => Object.fromEntries(stateNodes.map((n) => [n.id, n])),
    [stateNodes],
  );

  const handleClick = useCallback(
    (state: StateNode) => {
      if (isRunning) return;
      onSelectState(state.id, state.prompt);
    },
    [onSelectState, isRunning],
  );

  const completedCount = stateNodes.filter((n) => n.completed).length;

  return (
    <div className="w-full max-w-xl mx-auto select-none space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4" style={{ color: ANIM_ACCENT }} />
          <div>
            <h3 className="text-xs font-semibold text-text">
              {hasScannedData ? 'Project State Machine' : 'Locomotion State Machine'}
            </h3>
            <p className="text-2xs text-text-muted">
              {completedCount}/{displayStates.length} states
              {hasScannedData ? ' (scanned from project)' : ' — click a state to implement it'}
            </p>
          </div>
        </div>

        {/* Scan button */}
        {projectPath && projectName && (
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

      {/* Scan error */}
      {scanError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 text-2xs text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {scanError}
        </div>
      )}

      {/* Scan metadata */}
      {scanResult && (
        <div className="flex flex-wrap items-center gap-3 text-2xs text-text-muted">
          {scanResult.animInstanceClass && (
            <span className="flex items-center gap-1">
              <FileCode2 className="w-2.5 h-2.5" />
              {scanResult.animInstanceClass}
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
        style={{ height: displayStates.length > 8 ? 280 : 200 }}
      >
        {/* SVG transitions layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
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
          </defs>
          {displayTransitions.map(({ from, to }) => {
            const fromNode = stateMap[from];
            const toNode = stateMap[to];
            if (!fromNode || !toNode) return null;

            const bothDone = fromNode.completed && toNode.completed;

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

            return (
              <line
                key={`${from}-${to}`}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke={bothDone ? '#22c55e20' : `${ANIM_ACCENT}18`}
                strokeWidth={1}
                markerEnd={bothDone ? 'url(#sm-arrow-done)' : 'url(#sm-arrow)'}
              />
            );
          })}
        </svg>

        {/* State nodes */}
        {stateNodes.map((state) => (
          <button
            key={state.id}
            onClick={() => handleClick(state)}
            disabled={isRunning && !state.isActive}
            title={state.hasMontage ? `${state.label} (montage assigned)` : state.label}
            className={`
              absolute rounded-lg border transition-all duration-200 group
              ${state.completed
                ? 'border-[#22c55e30] bg-[#22c55e0a]'
                : state.isActive
                  ? 'border-[#a78bfa50] bg-[#a78bfa10]'
                  : 'border-border bg-surface-deep hover:border-[#a78bfa30] hover:bg-[#a78bfa08] cursor-pointer'
              }
            `}
            style={{
              left: `${state.x}%`,
              top: `${state.y}%`,
              transform: 'translate(-50%, -50%)',
              width: NODE_W,
              height: NODE_H,
              zIndex: 1,
            }}
          >
            <div className="flex items-center justify-center gap-1.5 h-full px-2">
              {state.completed ? (
                <Check className="w-3 h-3 text-[#22c55e] flex-shrink-0" />
              ) : state.isActive ? (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ backgroundColor: ANIM_ACCENT }}
                />
              ) : state.hasMontage ? (
                <Sparkles
                  className="w-2.5 h-2.5 flex-shrink-0"
                  style={{ color: '#f59e0b' }}
                />
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: `${ANIM_ACCENT}40`,
                    border: `1px solid ${ANIM_ACCENT}30`,
                  }}
                />
              )}
              <span
                className={`text-xs font-semibold leading-none truncate ${
                  state.completed
                    ? 'text-[#22c55e]'
                    : state.isActive
                      ? 'text-[#a78bfa]'
                      : 'text-text-muted-hover group-hover:text-text'
                }`}
              >
                {state.label}
              </span>
            </div>
          </button>
        ))}

        {/* Entry indicator — arrow pointing to first state */}
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

        {/* Legend for scanned mode */}
        {hasScannedData && (
          <div className="absolute bottom-2 right-2 flex items-center gap-3 text-2xs text-[#4a4e6a]" style={{ zIndex: 2 }}>
            <span className="flex items-center gap-1">
              <Sparkles className="w-2 h-2" style={{ color: '#f59e0b' }} />
              montage
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${ANIM_ACCENT}40`, border: `1px solid ${ANIM_ACCENT}30` }} />
              stub
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-2 h-2 text-[#22c55e]" />
              done
            </span>
          </div>
        )}
      </div>

      {/* Montage & variable detail (scanned mode) */}
      {scanResult && scanResult.montageRefs.length > 0 && (
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

      {scanResult && scanResult.animVariables.length > 0 && (
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
