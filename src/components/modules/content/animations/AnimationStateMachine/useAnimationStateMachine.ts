import { useState, useCallback, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { useManifest } from '@/hooks/useManifest';
import type { AnimTransition } from '@/app/api/filesystem/scan-animbp/route';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { logger } from '@/lib/logger';
import { exportStatesToBlenderNLA } from '../shared/state-machine-shared';
import type { StateNode, TransitionEdge, AnimationStateMachineProps } from './types';
import { EMPTY_PROGRESS, FALLBACK_STATES, FALLBACK_TRANSITIONS } from './constants';
import { layoutStates, findReachableStates, findDeadEnds } from './helpers';
import { useAnimBpScan } from './useAnimBpScan';

export function useAnimationStateMachine({ onSelectState, isRunning, activeStateId }: AnimationStateMachineProps) {
  // Honor the OS reduced-motion preference: looping SMIL edge animations are
  // suppressed (they fall back to a static dashed/colored highlight) and the
  // pulse/scale decorations are neutralised below. SMIL <animate> is NOT covered
  // by the global prefers-reduced-motion CSS rule, so it must be gated in JS.
  const prefersReducedMotion = useReducedMotion();
  const progress = useModuleStore((s) => s.checklistProgress['animations'] ?? EMPTY_PROGRESS);
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);

  const { scanResult, isScanning, scanError, newStateIds, modifiedTransitions, handleScan } =
    useAnimBpScan(projectPath, projectName);

  // Blender NLA export
  const [blenderExporting, setBlenderExporting] = useState(false);
  const [blenderResult, setBlenderResult] = useState<{ message: string; isError: boolean } | null>(null);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  // Simulation mode
  const [simMode, setSimMode] = useState(false);
  const [simPath, setSimPath] = useState<string[]>([]);
  const [simUnreachable, setSimUnreachable] = useState<Set<string>>(new Set());
  const [simDeadEnds, setSimDeadEnds] = useState<Set<string>>(new Set());

  // Hovered transition for showing rule label
  const [hoveredTransition, setHoveredTransition] = useState<string | null>(null);

  // ── Bridge data ──
  const { manifest, isConnected: bridgeConnected } = useManifest();

  const bridgeStates = useMemo(() => {
    if (!manifest?.animAssets?.length) return { states: [] as StateNode[], transitions: [] as TransitionEdge[] };

    const animBPs = manifest.animAssets.filter(
      (a) => a.assetType === 'AnimBlueprint' && a.stateMachines && a.stateMachines.length > 0,
    );
    if (animBPs.length === 0) return { states: [] as StateNode[], transitions: [] as TransitionEdge[] };

    // Flatten all states across all state machines
    const stateNames = new Set<string>();
    const rawTransitions: { from: string; to: string; condition: string }[] = [];

    for (const bp of animBPs) {
      for (const sm of bp.stateMachines!) {
        for (const s of sm.states) {
          stateNames.add(s);
        }
        for (const t of sm.transitions) {
          rawTransitions.push(t);
        }
      }
    }

    const stateArr = Array.from(stateNames).map((name) => ({
      name,
      hasMontage: false, // bridge doesn't convey montage-per-state info
    }));

    const states = layoutStates(stateArr);
    const transitions: TransitionEdge[] = rawTransitions.map((t) => ({
      from: `scanned-${t.from}`,
      to: `scanned-${t.to}`,
      rule: t.condition || null,
    }));

    return { states, transitions };
  }, [manifest]);

  const hasScannedData = scanResult && scanResult.states.length > 0;

  const useBridgeData = bridgeConnected && bridgeStates.states.length > 0;

  const { states: displayStates, transitions: displayTransitions } = useMemo(() => {
    if (useBridgeData) {
      return { states: bridgeStates.states, transitions: bridgeStates.transitions };
    }
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
  }, [useBridgeData, bridgeStates, hasScannedData, scanResult]);

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

  // Set of "from->to" edge keys for O(1) reverse-edge lookups (avoids O(E) .some() per edge)
  const edgeKeySet = useMemo(() => {
    const s = new Set<string>();
    for (const t of displayTransitions) s.add(`${t.from}->${t.to}`);
    return s;
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

  const handleExportToBlenderNLA = useCallback(async () => {
    setBlenderExporting(true);
    setBlenderResult(null);
    try {
      const exportStates = displayStates.map((state) => ({
        name: state.label,
        type: state.stateType,
      }));
      const result = await exportStatesToBlenderNLA(exportStates);
      if (result.ok) {
        setBlenderResult({ message: result.data.output || `Exported ${exportStates.length} states to Blender NLA`, isError: false });
      } else {
        setBlenderResult({ message: result.error, isError: true });
      }
    } catch (e) {
      logger.warn('Blender NLA export failed', e);
      setBlenderResult({ message: e instanceof Error ? e.message : 'Export failed', isError: true });
    } finally {
      setBlenderExporting(false);
    }
  }, [displayStates]);

  const completedCount = stateNodes.filter((n) => n.completed).length;

  return {
    prefersReducedMotion,
    projectPath,
    projectName,
    scanResult,
    isScanning,
    scanError,
    blenderExporting,
    blenderResult,
    blenderConnected,
    simMode,
    simPath,
    simUnreachable,
    simDeadEnds,
    modifiedTransitions,
    hoveredTransition,
    setHoveredTransition,
    handleScan,
    hasScannedData,
    useBridgeData,
    displayStates,
    displayTransitions,
    transitionRuleMap,
    edgeKeySet,
    stateNodes,
    stateMap,
    simEdges,
    validNextStates,
    handleClick,
    toggleSimMode,
    resetSimPath,
    handleExportToBlenderNLA,
    completedCount,
    isRunning,
  };
}
