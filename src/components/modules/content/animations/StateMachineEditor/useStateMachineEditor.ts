'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  validateStateMachine,
  groupWarningsByState,
  type ValidationWarning,
} from '@/lib/state-machine-validator';
import { compileMachine } from '@/lib/state-machine-compile';
import type { EditorState, EditorTransition, DiffResult } from './types';
import { DEFAULT_STATES, DEFAULT_TRANSITIONS, KNOWN_FLAGS } from './constants';
import { computeDiff, genId } from './helpers';
import { loadDraft, saveDraft, clearDraft } from './draftStore';
import { seedSignature, type EditorSeed } from './seed';
import { buildApplyPlan } from './applyPlan';
import {
  generateEnumCode,
  generateComputeAnimState,
  generateAnimBPSetup,
  generateFullCppOutput,
} from './codegen';

/**
 * Canvas bounds for a node's percent position. Shared by pointer drag and
 * keyboard nudge so neither input path can push a node off-canvas.
 */
const clampPct = (v: number) => Math.max(5, Math.min(95, v));

export interface StateMachineEditorOptions {
  /**
   * States/transitions from a real source (AnimBP scan or the live bridge).
   * With one, the editor opens on the PROJECT's machine; without one it opens
   * on `DEFAULT_STATES`, which the UI must call a template.
   */
  seed?: EditorSeed | null;
  /**
   * Draft key for the session-scoped flush target. Set it and unsaved canvas
   * edits survive an LRU eviction (unmount) of the module.
   */
  draftKey?: string;
}

export function useStateMachineEditor(options: StateMachineEditorOptions = {}) {
  const { seed = null, draftKey } = options;

  // Initial graph, in precedence order: a restored draft (the operator's own
  // unsaved edits) → the seed (what the project really has) → the template.
  const [initial] = useState(() => {
    const draft = draftKey ? loadDraft(draftKey) : null;
    if (draft) return { states: draft.states, transitions: draft.transitions, restored: true };
    if (seed) return { states: seed.states, transitions: seed.transitions, restored: false };
    return { states: DEFAULT_STATES, transitions: DEFAULT_TRANSITIONS, restored: false };
  });
  // Mutable: a converged apply (markApplied + matching re-scan) retires the
  // restored draft, so the canvas reads as untouched again.
  const [draftRestored, setDraftRestored] = useState(initial.restored);
  const [states, setStates] = useState<EditorState[]>(initial.states);
  const [transitions, setTransitions] = useState<EditorTransition[]>(initial.transitions);

  /**
   * "Untouched" is array identity against the baseline the graph was last
   * loaded from — every mutation below replaces the array, so no mutation flag
   * has to be threaded through a dozen callbacks (and none can be forgotten).
   */
  const [baseline, setBaseline] = useState<{ states: EditorState[]; transitions: EditorTransition[] }>({
    states: initial.states,
    transitions: initial.transitions,
  });
  const touched = draftRestored || states !== baseline.states || transitions !== baseline.transitions;

  /**
   * Adopt a seed that arrives AFTER mount (the scan is asynchronous) — but only
   * while the canvas is still untouched and no draft was restored. Overwriting
   * the operator's edits with a late scan would be exactly the silent data loss
   * this hook exists to prevent.
   */
  //
   // Adjusted DURING render (React's derive-from-props idiom, as in
   // `PreflightPanel`): an effect would paint one frame of the previous graph
   // and trips `react-hooks/set-state-in-effect`. The seed is compared by
   // CONTENT — callers rebuild the object every render, and an identity check
   // would re-adopt (and re-render) forever.
  //
  // After `markApplied()` the next new seed is the post-apply re-scan: it is
  // adopted (and the draft retired) ONLY when the canvas has no changes left
  // against it. A re-scan that still differs keeps the canvas and the draft,
  // and the plan lists the residual changes — a CLI "success" is not proof.
  const seedSig = seedSignature(seed);
  const [adoptedSig, setAdoptedSig] = useState<string | null>(seedSig);
  const [applyPending, setApplyPending] = useState(false);
  const [lastApplyOutcome, setLastApplyOutcome] = useState<'converged' | 'residual' | null>(null);
  // Only while an apply awaits its re-scan: THIS canvas's status against the
  // incoming seed (lint-free — convergence is about content, not findings).
  const statusVsSeed = useMemo(
    () => (applyPending ? buildApplyPlan({ seed, states, transitions, warnings: [] }).status : null),
    [applyPending, seed, states, transitions],
  );
  if (seed && adoptedSig !== seedSig) {
    setAdoptedSig(seedSig);
    const converged = applyPending && statusVsSeed === 'no-changes';
    if (applyPending) {
      setApplyPending(false);
      setLastApplyOutcome(converged ? 'converged' : 'residual');
    }
    if (converged) setDraftRestored(false);
    if (applyPending ? converged : !touched) {
      setBaseline({ states: seed.states, transitions: seed.transitions });
      setStates(seed.states);
      setTransitions(seed.transitions);
    }
  }

  // Flush every edit to the session draft store so an LRU eviction (unmount)
  // cannot silently drop unsaved canvas work.
  useEffect(() => {
    if (!draftKey || !touched) return;
    saveDraft(draftKey, { states, transitions }, Date.now());
  }, [draftKey, touched, states, transitions]);

  // A converged apply retires the draft: the project now holds those edits.
  useEffect(() => {
    if (draftKey && !touched && lastApplyOutcome === 'converged') clearDraft(draftKey);
  }, [draftKey, touched, lastApplyOutcome]);

  /**
   * The CLI reported a successful apply: arm the rebase. Nothing is cleared
   * here — the next seed (the re-scan) decides, see the adoption block above.
   */
  const markApplied = useCallback(() => {
    setApplyPending(true);
    setLastApplyOutcome(null);
  }, []);

  // Snapshot for diff
  const [snapshot, setSnapshot] = useState<{ states: EditorState[]; transitions: EditorTransition[] } | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);

  // UI state
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [drawingTransition, setDrawingTransition] = useState<string | null>(null); // from state id
  const [draggingStateId, setDraggingStateId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [codeTab, setCodeTab] = useState<'full' | 'enum' | 'compute' | 'setup'>('full');
  const [showDiff, setShowDiff] = useState(false);
  const [editingPanel, setEditingPanel] = useState<'state' | 'transition' | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  // Set of "from->to" edge keys for O(1) reverse-edge lookups (avoids O(E) .some() per edge on drag)
  const edgeKeySet = useMemo(() => {
    const s = new Set<string>();
    for (const t of transitions) s.add(`${t.from}->${t.to}`);
    return s;
  }, [transitions]);

  // ── State CRUD ──

  const addState = useCallback(() => {
    const id = genId('state');
    const newState: EditorState = {
      id,
      name: 'NewState',
      stateType: 'other',
      priority: states.length,
      flag: 'bIsNewState',
      x: 50 + (Math.random() - 0.5) * 20,
      y: 50 + (Math.random() - 0.5) * 20,
    };
    setStates((prev) => [...prev, newState]);
    setSelectedStateId(id);
    setEditingPanel('state');
  }, [states.length]);

  const removeState = useCallback((id: string) => {
    setStates((prev) => prev.filter((s) => s.id !== id));
    setTransitions((prev) => prev.filter((t) => t.from !== id && t.to !== id));
    if (selectedStateId === id) {
      setSelectedStateId(null);
      setEditingPanel(null);
    }
  }, [selectedStateId]);

  const updateState = useCallback((id: string, updates: Partial<EditorState>) => {
    setStates((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
  }, []);

  // ── Transition CRUD ──

  const addTransition = useCallback((fromId: string, toId: string) => {
    // Don't create duplicate transitions
    const exists = transitions.some((t) => t.from === fromId && t.to === toId);
    if (exists) return;
    const id = genId('trans');
    const newTrans: EditorTransition = {
      id,
      from: fromId,
      to: toId,
      rule: '',
    };
    setTransitions((prev) => [...prev, newTrans]);
    setSelectedTransitionId(id);
    setEditingPanel('transition');
  }, [transitions]);

  const removeTransition = useCallback((id: string) => {
    setTransitions((prev) => prev.filter((t) => t.id !== id));
    if (selectedTransitionId === id) {
      setSelectedTransitionId(null);
      setEditingPanel(null);
    }
  }, [selectedTransitionId]);

  const updateTransition = useCallback((id: string, updates: Partial<EditorTransition>) => {
    setTransitions((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
  }, []);

  // ── Dragging ──

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingStateId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    updateState(draggingStateId, { x: clampPct(x), y: clampPct(y) });
  }, [draggingStateId, updateState]);

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingStateId(null);
  }, []);

  /**
   * Move a state by a percent delta — the keyboard equivalent of dragging,
   * so a node can be repositioned without a pointer.
   */
  const nudgeState = useCallback((id: string, dx: number, dy: number) => {
    setStates((prev) => prev.map((s) => (
      s.id === id ? { ...s, x: clampPct(s.x + dx), y: clampPct(s.y + dy) } : s
    )));
  }, []);

  // ── Drawing transition arrows ──

  const handleStateClick = useCallback((stateId: string) => {
    if (drawingTransition) {
      if (drawingTransition !== stateId) {
        addTransition(drawingTransition, stateId);
      }
      setDrawingTransition(null);
    } else {
      setSelectedStateId(stateId);
      setSelectedTransitionId(null);
      setEditingPanel('state');
    }
  }, [drawingTransition, addTransition]);

  // ── Snapshot & Diff ──

  const takeSnapshot = useCallback(() => {
    setSnapshot({ states: [...states], transitions: [...transitions] });
    setDiff(null);
    setShowDiff(false);
  }, [states, transitions]);

  const showDiffResult = useCallback(() => {
    if (!snapshot) return;
    const result = computeDiff(snapshot.states, snapshot.transitions, states, transitions);
    setDiff(result);
    setShowDiff(true);
  }, [snapshot, states, transitions]);

  // ── Code gen ──

  const generatedCode = useMemo(() => {
    // Skip the full string-building pipeline while the code panel is hidden:
    // node drag mutates `states` on every mousemove, so without this gate the
    // 4-section C++ output would regenerate on every pointer frame for output
    // the user can't see. When `showCode` is true the result is identical.
    if (!showCode) return '';
    switch (codeTab) {
      case 'enum': return generateEnumCode(states);
      case 'compute': return generateComputeAnimState(states);
      case 'setup': return generateAnimBPSetup(states, transitions);
      default: return generateFullCppOutput(states, transitions);
    }
  }, [showCode, states, transitions, codeTab]);

  // Copying the visible section is owned by the shared CodeViewer inside
  // CodeOutputPanel (clipboard + toast feedback); the editor only keeps the
  // whole-machine .cpp export below, which the toolbar also drives.

  const handleExport = useCallback(() => {
    // Nothing meaningful to export without states — the toolbar disables the
    // button in this case; this guard covers any other callers.
    if (states.length === 0) return;
    const code = generateFullCppOutput(states, transitions);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ARPGAnimInstance_StateMachine_${new Date().toISOString().slice(0, 10)}.cpp`;
    a.click();
    URL.revokeObjectURL(url);
  }, [states, transitions]);

  // ── Reset to defaults ──

  const handleReset = useCallback(() => {
    // Reset drops the session draft too — otherwise the next mount would
    // restore the very edits the operator just discarded.
    if (draftKey) clearDraft(draftKey);
    setBaseline({ states: DEFAULT_STATES, transitions: DEFAULT_TRANSITIONS });
    setStates(DEFAULT_STATES);
    setTransitions(DEFAULT_TRANSITIONS);
    setSelectedStateId(null);
    setSelectedTransitionId(null);
    setEditingPanel(null);
    setSnapshot(null);
    setDiff(null);
    setApplyPending(false);
    setLastApplyOutcome(null);
  }, [draftKey]);

  // cleanup mouse listener
  useEffect(() => {
    const handleUp = () => setDraggingStateId(null);
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, []);

  const selectedState = selectedStateId ? stateMap.get(selectedStateId) ?? null : null;
  const selectedTransition = selectedTransitionId ? transitions.find((t) => t.id === selectedTransitionId) ?? null : null;

  // Priority sorted for display
  const sortedByPriority = useMemo(() => [...states].sort((a, b) => a.priority - b.priority), [states]);

  // ── Compiled model + lint warnings ──
  // One model of entry/cascade/emit (state-machine-compile.ts): the linter
  // checks it and the canvas draws Entry at its fallback, as codegen emits it.
  const compiled = useMemo(() => compileMachine(states, transitions), [states, transitions]);
  const warnings = useMemo(
    () => validateStateMachine(states, transitions, KNOWN_FLAGS, compiled),
    [states, transitions, compiled],
  );
  const warningsByState = useMemo(() => groupWarningsByState(warnings), [warnings]);
  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warnCount = warnings.filter((w) => w.severity === 'warning').length;
  const infoCount = warnings.filter((w) => w.severity === 'info').length;

  // ── Apply plan: canvas vs the SEED (what the project has), by name ──
  const applyPlan = useMemo(
    () => buildApplyPlan({ seed, states, transitions, warnings }),
    [seed, states, transitions, warnings],
  );
  const [showWarnings, setShowWarnings] = useState(true);

  const focusWarning = useCallback((w: ValidationWarning) => {
    if (w.transitionIds.length > 0) {
      setSelectedTransitionId(w.transitionIds[0]);
      setSelectedStateId(null);
      setEditingPanel('transition');
    } else if (w.stateIds.length > 0) {
      setSelectedStateId(w.stateIds[0]);
      setSelectedTransitionId(null);
      setEditingPanel('state');
    }
  }, []);

  const hasChanges = snapshot !== null;
  const diffTotal = diff ? diff.newStates.length + diff.removedStates.length + diff.modifiedStates.length + diff.newTransitions.length + diff.removedTransitions.length + diff.modifiedTransitions.length : 0;

  return {
    states,
    transitions,
    /** Where the on-screen graph came from — 'template' when nothing real seeded it. */
    seedSource: seed?.source ?? ('template' as const),
    /** Sentence naming that source (AnimInstance class, bridge asset). */
    seedOrigin: seed?.origin ?? null,
    /** True when this mount restored unsaved edits from the session draft. */
    draftRestored,
    /** True when the graph differs from what it was loaded with. */
    touched,
    snapshot,
    diff,
    selectedStateId, setSelectedStateId,
    selectedTransitionId, setSelectedTransitionId,
    drawingTransition, setDrawingTransition,
    draggingStateId, setDraggingStateId,
    showCode, setShowCode,
    codeTab, setCodeTab,
    showDiff, setShowDiff,
    editingPanel, setEditingPanel,
    canvasRef,
    stateMap,
    edgeKeySet,
    addState,
    removeState,
    updateState,
    addTransition,
    removeTransition,
    updateTransition,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    nudgeState,
    handleStateClick,
    takeSnapshot,
    showDiffResult,
    generatedCode,
    handleExport,
    handleReset,
    selectedState,
    selectedTransition,
    sortedByPriority,
    /** The state ComputeAnimState() falls back to — the canvas Entry. */
    entryStateId: compiled.entryId,
    /** 'implicit' when no state is marked Default (lowest priority wins). */
    entrySource: compiled.entrySource,
    warnings,
    warningsByState,
    errorCount,
    warnCount,
    infoCount,
    showWarnings, setShowWarnings,
    focusWarning,
    hasChanges,
    diffTotal,
    /** Seed-relative change plan: status, blocking reasons, named changes. */
    applyPlan,
    /** Call when the apply CLI run succeeded; the next re-scan seed rebases. */
    markApplied,
    /** How the last post-apply re-scan compared with the canvas. */
    lastApplyOutcome,
  };
}

export type StateMachineEditorApi = ReturnType<typeof useStateMachineEditor>;
