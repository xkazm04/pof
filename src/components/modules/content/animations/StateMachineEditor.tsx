'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Trash2, GripVertical, ArrowRight, Code2, Download,
  Copy, Check, ChevronDown, ChevronRight, RotateCcw,
  Diff, Settings2, Layers, Zap,
} from 'lucide-react';
import {
  ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_CYAN,
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
  MODULE_COLORS, OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { logger } from '@/lib/logger';

const EDITOR_ACCENT = ACCENT_VIOLET;

// ── Types ──

export interface EditorState {
  id: string;
  name: string;
  stateType: StateType;
  priority: number; // 0 = highest priority (checked first in ComputeAnimState)
  flag: string; // e.g., 'bIsDead', 'bIsAttacking'
  x: number; // Percent position (0-100)
  y: number;
  isDefault?: boolean; // Locomotion is default (no flag needed)
  montageRef?: string; // e.g., 'AM_Dodge'
}

export interface EditorTransition {
  id: string;
  from: string; // state id
  to: string; // state id
  rule: string; // e.g., 'bIsAttacking == true'
  description?: string;
}

type StateType = 'locomotion' | 'combat' | 'reaction' | 'other';

const STATE_TYPE_COLORS: Record<StateType, string> = {
  locomotion: MODULE_COLORS.core,
  combat: MODULE_COLORS.evaluator,
  reaction: ACCENT_ORANGE,
  other: EDITOR_ACCENT,
};

const STATE_TYPE_OPTIONS: { value: StateType; label: string }[] = [
  { value: 'locomotion', label: 'Locomotion' },
  { value: 'combat', label: 'Combat' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'other', label: 'Other' },
];

// ── Known UE5 AnimInstance flags ──

const KNOWN_FLAGS = [
  'bIsAttacking',
  'bIsDodging',
  'bIsHitReacting',
  'bIsDead',
  'bIsInAir',
  'bIsSprinting',
  'bIsFullBodyMontage',
  'bIsComboWindowOpen',
  'bCanInterruptDodge',
  'bIsAttackRecovery',
  'bHitReactInterrupt',
  'bDodgeCancelsAttack',
  'bIsUpperBodyAction',
  'bIsAnyMontageActive',
  'bShouldMove',
  'bIsUsingRootMotion',
];

const KNOWN_RULE_TEMPLATES = [
  '{flag} == true',
  '{flag} == false',
  '{flag} == true && !bIsFullBodyMontage',
  '{flag} == true && bCanInterruptDodge',
  'bIsAttacking == false && !bIsFullBodyMontage',
  'bIsDodging == false',
  'bIsHitReacting == false',
  'Montage ends (bIsAnyMontageActive == false)',
  'StateTime > {threshold}',
  '(default) // fallback',
];

// ── Default 5-state setup matching C++ ──

const DEFAULT_STATES: EditorState[] = [
  { id: 'state-locomotion', name: 'Locomotion', stateType: 'locomotion', priority: 4, flag: '(default)', x: 50, y: 50, isDefault: true },
  { id: 'state-attacking', name: 'Attacking', stateType: 'combat', priority: 3, flag: 'bIsAttacking', x: 20, y: 25, montageRef: 'AM_Melee_Combo' },
  { id: 'state-dodging', name: 'Dodging', stateType: 'combat', priority: 2, flag: 'bIsDodging', x: 80, y: 25, montageRef: 'AM_Dodge' },
  { id: 'state-hitreact', name: 'HitReact', stateType: 'reaction', priority: 1, flag: 'bIsHitReacting', x: 20, y: 75, montageRef: 'AM_HitReact' },
  { id: 'state-death', name: 'Death', stateType: 'reaction', priority: 0, flag: 'bIsDead', x: 80, y: 75, montageRef: 'AM_Death' },
];

const DEFAULT_TRANSITIONS: EditorTransition[] = [
  { id: 't-loco-atk', from: 'state-locomotion', to: 'state-attacking', rule: 'bIsAttacking == true' },
  { id: 't-loco-dodge', from: 'state-locomotion', to: 'state-dodging', rule: 'bIsDodging == true' },
  { id: 't-loco-hit', from: 'state-locomotion', to: 'state-hitreact', rule: 'bIsHitReacting == true' },
  { id: 't-loco-death', from: 'state-locomotion', to: 'state-death', rule: 'bIsDead == true' },
  { id: 't-atk-loco', from: 'state-attacking', to: 'state-locomotion', rule: 'bIsAttacking == false && !bIsFullBodyMontage' },
  { id: 't-atk-dodge', from: 'state-attacking', to: 'state-dodging', rule: 'bIsDodging == true', description: 'Dodge cancels attack recovery' },
  { id: 't-atk-hit', from: 'state-attacking', to: 'state-hitreact', rule: 'bIsHitReacting == true', description: 'Hit interrupts attack' },
  { id: 't-dodge-loco', from: 'state-dodging', to: 'state-locomotion', rule: 'bIsDodging == false' },
  { id: 't-dodge-atk', from: 'state-dodging', to: 'state-attacking', rule: 'bIsAttacking == true && bCanInterruptDodge', description: 'Cancel window' },
  { id: 't-hit-loco', from: 'state-hitreact', to: 'state-locomotion', rule: 'bIsHitReacting == false' },
  { id: 't-hit-death', from: 'state-hitreact', to: 'state-death', rule: 'bIsDead == true' },
];

// ── Code Generation ──

function generateEnumCode(states: EditorState[]): string {
  const sorted = [...states].sort((a, b) => a.priority - b.priority);
  const lines = [
    'UENUM(BlueprintType)',
    'enum class EARPGAnimState : uint8',
    '{',
  ];
  for (const s of sorted) {
    lines.push(`\t${s.name},`);
  }
  lines.push('};');
  return lines.join('\n');
}

function generateComputeAnimState(states: EditorState[]): string {
  // Sort by priority ascending (0 = highest = checked first)
  const sorted = [...states].sort((a, b) => a.priority - b.priority);
  const nonDefault = sorted.filter((s) => !s.isDefault);
  const defaultState = sorted.find((s) => s.isDefault) ?? sorted[sorted.length - 1];

  const lines = [
    'EARPGAnimState UARPGAnimInstance::ComputeAnimState() const',
    '{',
    '\t// Priority order: ' + sorted.map((s) => s.name).join(' > '),
    '\t// Highest-priority state always wins.',
    '',
  ];

  for (const s of nonDefault) {
    lines.push(`\tif (${s.flag})`);
    lines.push('\t{');
    lines.push(`\t\treturn EARPGAnimState::${s.name};`);
    lines.push('\t}');
    lines.push('');
  }

  lines.push(`\treturn EARPGAnimState::${defaultState.name};`);
  lines.push('}');
  return lines.join('\n');
}

function generateNativeUpdateTransitionFlags(states: EditorState[], transitions: EditorTransition[]): string {
  const lines = [
    '// =================================================================',
    '// Transition flags (generated by PoF State Machine Editor)',
    '// Place inside NativeUpdateAnimation() after reading character state.',
    '// =================================================================',
    '',
  ];

  // Group useful derivative flags
  const derivedFlags = new Map<string, string>();

  for (const t of transitions) {
    const fromState = states.find((s) => s.id === t.from);
    const toState = states.find((s) => s.id === t.to);
    if (!fromState || !toState) continue;

    // Check for compound rules that imply derived transition flags
    if (t.rule.includes('&&') || t.description) {
      const flagName = `bCan${fromState.name}To${toState.name}`;
      if (!derivedFlags.has(flagName)) {
        derivedFlags.set(flagName, `${t.rule}; // ${fromState.name} -> ${toState.name}${t.description ? ` (${t.description})` : ''}`);
      }
    }
  }

  if (derivedFlags.size > 0) {
    lines.push('// Derived transition flags');
    for (const [flag, expr] of derivedFlags) {
      lines.push(`${flag} = ${expr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateTransitionRulesComment(states: EditorState[], transitions: EditorTransition[]): string {
  const lines = [
    '/**',
    ' * State machine transition rules:',
    ' *',
  ];

  for (const t of transitions) {
    const from = states.find((s) => s.id === t.from);
    const to = states.find((s) => s.id === t.to);
    if (!from || !to) continue;
    const desc = t.description ? ` (${t.description})` : '';
    lines.push(` *   ${from.name} -> ${to.name}: ${t.rule}${desc}`);
  }

  lines.push(' */');
  return lines.join('\n');
}

function generateAnimBPSetup(states: EditorState[], transitions: EditorTransition[]): string {
  const sorted = [...states].sort((a, b) => a.priority - b.priority);
  const lines = [
    '// =====================================================',
    '// Animation Blueprint Setup Instructions',
    '// (Generated by PoF State Machine Editor)',
    '// =====================================================',
    '//',
    '// 1. ENUM SETUP',
    `//    Add ${states.length} states to the EARPGAnimState enum:`,
    ...sorted.map((s) => `//      - ${s.name} (priority ${s.priority}${s.isDefault ? ', default/fallback' : ', flag: ' + s.flag})`),
    '//',
    '// 2. STATE MACHINE',
    '//    In the AnimBP, create a state machine with the following states:',
    ...sorted.map((s) => `//      [${s.name}]${s.montageRef ? ` → plays ${s.montageRef}` : ''}`),
    '//',
    '// 3. TRANSITIONS',
    '//    Wire the following transitions in the AnimBP:',
  ];

  for (const t of transitions) {
    const from = states.find((s) => s.id === t.from);
    const to = states.find((s) => s.id === t.to);
    if (!from || !to) continue;
    lines.push(`//      ${from.name} → ${to.name} : ${t.rule}${t.description ? ` // ${t.description}` : ''}`);
  }

  lines.push('//');
  lines.push('// 4. PRIORITY CASCADE');
  lines.push('//    ComputeAnimState() checks flags in this order:');
  for (const s of sorted) {
    if (s.isDefault) {
      lines.push(`//      ${s.priority}. ${s.name} (default fallback)`);
    } else {
      lines.push(`//      ${s.priority}. ${s.name} — ${s.flag}`);
    }
  }

  return lines.join('\n');
}

export function generateFullCppOutput(states: EditorState[], transitions: EditorTransition[]): string {
  const sections = [
    '// =====================================================',
    '// Generated by PoF — Visual State Machine Editor',
    `// ${new Date().toISOString()}`,
    '// =====================================================',
    '',
    '// ── EARPGAnimState Enum ──',
    '',
    generateEnumCode(states),
    '',
    '// ── Transition Rules Documentation ──',
    '',
    generateTransitionRulesComment(states, transitions),
    '',
    '// ── ComputeAnimState() Implementation ──',
    '',
    generateComputeAnimState(states),
    '',
    '// ── NativeUpdateAnimation() Transition Flags ──',
    '',
    generateNativeUpdateTransitionFlags(states, transitions),
    '',
    '// ── AnimBP Setup Instructions ──',
    '',
    generateAnimBPSetup(states, transitions),
  ];
  return sections.join('\n');
}

// ── Diff tracking ──

interface DiffResult {
  newStates: string[];
  removedStates: string[];
  modifiedStates: string[]; // states with changed properties
  newTransitions: string[];
  removedTransitions: string[];
  modifiedTransitions: string[]; // transitions with changed rules
}

function computeDiff(
  prevStates: EditorState[],
  prevTransitions: EditorTransition[],
  currStates: EditorState[],
  currTransitions: EditorTransition[],
): DiffResult {
  const prevStateIds = new Set(prevStates.map((s) => s.id));
  const currStateIds = new Set(currStates.map((s) => s.id));
  const prevTransIds = new Set(prevTransitions.map((t) => t.id));
  const currTransIds = new Set(currTransitions.map((t) => t.id));

  const prevStateMap = new Map(prevStates.map((s) => [s.id, s]));
  const prevTransMap = new Map(prevTransitions.map((t) => [t.id, t]));

  const newStates = currStates.filter((s) => !prevStateIds.has(s.id)).map((s) => s.name);
  const removedStates = prevStates.filter((s) => !currStateIds.has(s.id)).map((s) => s.name);
  const modifiedStates: string[] = [];
  for (const s of currStates) {
    const prev = prevStateMap.get(s.id);
    if (prev && (prev.name !== s.name || prev.priority !== s.priority || prev.flag !== s.flag)) {
      modifiedStates.push(s.name);
    }
  }

  const newTransitions = currTransitions.filter((t) => !prevTransIds.has(t.id)).map((t) => `${t.from}->${t.to}`);
  const removedTransitions = prevTransitions.filter((t) => !currTransIds.has(t.id)).map((t) => `${t.from}->${t.to}`);
  const modifiedTransitions: string[] = [];
  for (const t of currTransitions) {
    const prev = prevTransMap.get(t.id);
    if (prev && (prev.rule !== t.rule || prev.from !== t.from || prev.to !== t.to)) {
      modifiedTransitions.push(`${t.from}->${t.to}`);
    }
  }

  return { newStates, removedStates, modifiedStates, newTransitions, removedTransitions, modifiedTransitions };
}

// ── Helpers ──

let nextId = 100;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

const NODE_W = 120;
const NODE_H = 52;

// ── Component ──

export function StateMachineEditor() {
  const [states, setStates] = useState<EditorState[]>(DEFAULT_STATES);
  const [transitions, setTransitions] = useState<EditorTransition[]>(DEFAULT_TRANSITIONS);

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
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [editingPanel, setEditingPanel] = useState<'state' | 'transition' | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

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
    updateState(draggingStateId, {
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
    });
  }, [draggingStateId, updateState]);

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingStateId(null);
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
    switch (codeTab) {
      case 'enum': return generateEnumCode(states);
      case 'compute': return generateComputeAnimState(states);
      case 'setup': return generateAnimBPSetup(states, transitions);
      default: return generateFullCppOutput(states, transitions);
    }
  }, [states, transitions, codeTab]);

  const handleCopy = useCallback(async (section: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      logger.warn('Clipboard copy failed');
    }
  }, []);

  const handleExport = useCallback(() => {
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
    setStates(DEFAULT_STATES);
    setTransitions(DEFAULT_TRANSITIONS);
    setSelectedStateId(null);
    setSelectedTransitionId(null);
    setEditingPanel(null);
    setSnapshot(null);
    setDiff(null);
  }, []);

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

  const hasChanges = snapshot !== null;
  const diffTotal = diff ? diff.newStates.length + diff.removedStates.length + diff.modifiedStates.length + diff.newTransitions.length + diff.removedTransitions.length + diff.modifiedTransitions.length : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${EDITOR_ACCENT}${OPACITY_15}` }}>
            <Layers className="w-4 h-4" style={{ color: EDITOR_ACCENT }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              Visual State Machine Editor
              <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                EDITOR
              </span>
            </h3>
            <p className="text-2xs text-text-muted">
              Drag states, draw transitions, generate C++ code
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Snapshot */}
          <button
            onClick={takeSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: hasChanges ? `${STATUS_INFO}${OPACITY_15}` : `${EDITOR_ACCENT}${OPACITY_10}`,
              color: hasChanges ? STATUS_INFO : EDITOR_ACCENT,
              border: `1px solid ${hasChanges ? `${STATUS_INFO}${OPACITY_30}` : `${EDITOR_ACCENT}${OPACITY_20}`}`,
            }}
            title="Take snapshot for diff comparison"
          >
            <Diff className="w-3 h-3" />
            {hasChanges ? 'Re-snapshot' : 'Snapshot'}
          </button>

          {/* Show diff */}
          {hasChanges && (
            <button
              onClick={showDiffResult}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: `${STATUS_WARNING}${OPACITY_15}`,
                color: STATUS_WARNING,
                border: `1px solid ${STATUS_WARNING}${OPACITY_30}`,
              }}
            >
              <Diff className="w-3 h-3" />
              Diff
            </button>
          )}

          {/* Add state */}
          <button
            onClick={addState}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: `${STATUS_SUCCESS}${OPACITY_15}`,
              color: STATUS_SUCCESS,
              border: `1px solid ${STATUS_SUCCESS}${OPACITY_30}`,
            }}
          >
            <Plus className="w-3 h-3" />
            Add State
          </button>

          {/* Draw transition */}
          <button
            onClick={() => setDrawingTransition(drawingTransition ? null : (selectedStateId ?? null))}
            disabled={!selectedStateId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
            style={{
              backgroundColor: drawingTransition ? `${ACCENT_ORANGE}${OPACITY_15}` : `${ACCENT_CYAN}${OPACITY_15}`,
              color: drawingTransition ? ACCENT_ORANGE : ACCENT_CYAN,
              border: `1px solid ${drawingTransition ? `${ACCENT_ORANGE}${OPACITY_30}` : `${ACCENT_CYAN}${OPACITY_20}`}`,
            }}
            title={drawingTransition ? 'Cancel drawing (click target state to connect)' : 'Start drawing transition from selected state'}
          >
            <ArrowRight className="w-3 h-3" />
            {drawingTransition ? 'Drawing...' : 'Draw Arrow'}
          </button>

          {/* Code */}
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: showCode ? `${EDITOR_ACCENT}${OPACITY_20}` : `${EDITOR_ACCENT}${OPACITY_10}`,
              color: EDITOR_ACCENT,
              border: `1px solid ${EDITOR_ACCENT}${showCode ? OPACITY_30 : OPACITY_20}`,
            }}
          >
            <Code2 className="w-3 h-3" />
            {showCode ? 'Hide Code' : 'View Code'}
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`,
              color: STATUS_SUCCESS,
              border: `1px solid ${STATUS_SUCCESS}${OPACITY_20}`,
            }}
            title="Export full C++ code"
          >
            <Download className="w-3 h-3" />
            Export
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-text transition-colors border border-border/40"
            title="Reset to default 5-state machine"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Drawing mode indicator ── */}
      {drawingTransition && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: `${ACCENT_ORANGE}08`, border: `1px solid ${ACCENT_ORANGE}${OPACITY_30}`, color: ACCENT_ORANGE }}>
          <Zap className="w-3.5 h-3.5" />
          Drawing transition from <strong>{stateMap.get(drawingTransition)?.name ?? '?'}</strong> — click a target state to connect, or click &quot;Drawing...&quot; to cancel
        </div>
      )}

      {/* ── Diff display ── */}
      {showDiff && diff && (
        <div className="rounded-lg border border-border bg-surface-deep px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text flex items-center gap-2">
              <Diff className="w-3.5 h-3.5" style={{ color: STATUS_WARNING }} />
              Diff since snapshot
              {diffTotal === 0 && <span className="text-text-muted font-normal">(no changes)</span>}
            </span>
            <button onClick={() => setShowDiff(false)} className="text-2xs text-text-muted hover:text-text">&times;</button>
          </div>
          {diff.newStates.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_SUCCESS }}>+ States:</span> <span className="text-text-muted">{diff.newStates.join(', ')}</span></div>
          )}
          {diff.removedStates.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_ERROR }}>- States:</span> <span className="text-text-muted">{diff.removedStates.join(', ')}</span></div>
          )}
          {diff.modifiedStates.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_WARNING }}>~ States:</span> <span className="text-text-muted">{diff.modifiedStates.join(', ')}</span></div>
          )}
          {diff.newTransitions.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_SUCCESS }}>+ Transitions:</span> <span className="text-text-muted">{diff.newTransitions.length} added</span></div>
          )}
          {diff.removedTransitions.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_ERROR }}>- Transitions:</span> <span className="text-text-muted">{diff.removedTransitions.length} removed</span></div>
          )}
          {diff.modifiedTransitions.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_WARNING }}>~ Transitions:</span> <span className="text-text-muted">{diff.modifiedTransitions.length} changed</span></div>
          )}
        </div>
      )}

      {/* ── Main grid: Canvas + Property Panel ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        {/* ── Canvas ── */}
        <div
          ref={canvasRef}
          className="relative rounded-xl border-2 border-surface-deep bg-[#050510]/80 overflow-hidden select-none"
          style={{ height: 400, cursor: draggingStateId ? 'grabbing' : drawingTransition ? 'crosshair' : 'default' }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={(e) => {
            // Clicking empty space deselects
            if (e.target === canvasRef.current) {
              setSelectedStateId(null);
              setSelectedTransitionId(null);
              setEditingPanel(null);
              if (drawingTransition) setDrawingTransition(null);
            }
          }}
        >
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `linear-gradient(${EDITOR_ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${EDITOR_ACCENT} 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />

          {/* SVG for transitions */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <defs>
              <marker id="sme-arrow" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="6" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 8 3 L 0 6 z" fill={`${EDITOR_ACCENT}60`} />
              </marker>
              <marker id="sme-arrow-sel" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="6" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 8 3 L 0 6 z" fill={ACCENT_CYAN} />
              </marker>
            </defs>

            {transitions.map((t) => {
              const from = stateMap.get(t.from);
              const to = stateMap.get(t.to);
              if (!from || !to) return null;

              const isSelected = selectedTransitionId === t.id;

              // Offset for bidirectional edges
              const reverseExists = transitions.some((r) => r.from === t.to && r.to === t.from);
              const isForward = t.from < t.to;
              const perpOffset = reverseExists ? (isForward ? -1.5 : 1.5) : 0;

              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist === 0) return null;
              const nx = dx / dist;
              const ny = dy / dist;
              const px = -ny;
              const py = nx;
              const edgeOffset = 8;

              const x1 = from.x + nx * edgeOffset + px * perpOffset;
              const y1 = from.y + ny * edgeOffset + py * perpOffset;
              const x2 = to.x - nx * edgeOffset + px * perpOffset;
              const y2 = to.y - ny * edgeOffset + py * perpOffset;

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              const strokeColor = isSelected ? ACCENT_CYAN : `${EDITOR_ACCENT}40`;
              const strokeWidth = isSelected ? 2.5 : 1.5;

              return (
                <g key={t.id}>
                  {/* Hit area */}
                  <line
                    x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                    stroke="transparent" strokeWidth={15}
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTransitionId(t.id);
                      setSelectedStateId(null);
                      setEditingPanel('transition');
                    }}
                  />
                  {/* Glow */}
                  {isSelected && (
                    <line
                      x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                      stroke={ACCENT_CYAN} strokeWidth={strokeWidth * 3} opacity="0.2" style={{ filter: 'blur(3px)' }}
                    />
                  )}
                  <line
                    x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                    stroke={strokeColor} strokeWidth={strokeWidth}
                    markerEnd={isSelected ? 'url(#sme-arrow-sel)' : 'url(#sme-arrow)'}
                  />
                  {/* Rule label on line */}
                  {t.rule && (
                    <text
                      x={`${midX}%`} y={`${midY - 1.5}%`}
                      fill={isSelected ? ACCENT_CYAN : `${EDITOR_ACCENT}80`}
                      fontSize="8" fontFamily="monospace" textAnchor="middle" dominantBaseline="auto"
                      style={{ pointerEvents: 'none' }}
                    >
                      {t.rule.length > 30 ? t.rule.slice(0, 28) + '...' : t.rule}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* State nodes */}
          {states.map((state) => {
            const isSelected = selectedStateId === state.id;
            const isDrawSource = drawingTransition === state.id;
            const color = STATE_TYPE_COLORS[state.stateType];

            let borderColor = `${color}40`;
            let bgColor = `${color}0A`;
            let shadow = 'none';

            if (isSelected) {
              borderColor = `${ACCENT_CYAN}80`;
              bgColor = `${ACCENT_CYAN}20`;
              shadow = `0 0 20px ${ACCENT_CYAN}40, inset 0 0 15px ${ACCENT_CYAN}20`;
            } else if (isDrawSource) {
              borderColor = `${ACCENT_ORANGE}80`;
              bgColor = `${ACCENT_ORANGE}20`;
              shadow = `0 0 15px ${ACCENT_ORANGE}40`;
            }

            return (
              <div
                key={state.id}
                className="absolute rounded-xl border transition-all duration-150 group"
                style={{
                  left: `${state.x}%`,
                  top: `${state.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: NODE_W,
                  height: NODE_H,
                  zIndex: isSelected ? 10 : 1,
                  borderColor,
                  backgroundColor: bgColor,
                  boxShadow: shadow,
                  cursor: draggingStateId === state.id ? 'grabbing' : drawingTransition ? 'crosshair' : 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStateClick(state.id);
                }}
                onMouseDown={(e) => {
                  // Only start drag on left button and not drawing
                  if (e.button === 0 && !drawingTransition) {
                    e.preventDefault();
                    setDraggingStateId(state.id);
                  }
                }}
              >
                {/* Type color strip */}
                <div className="absolute left-0 top-1 bottom-1 w-[4px] rounded-full" style={{ backgroundColor: color }} />

                {/* Priority badge */}
                <div
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border"
                  style={{
                    backgroundColor: `${color}20`,
                    borderColor: `${color}50`,
                    color,
                  }}
                  title={`Priority ${state.priority} (lower = higher priority)`}
                >
                  {state.priority}
                </div>

                <div className="flex flex-col items-start justify-center h-full px-3 pl-4 overflow-hidden">
                  <span className="text-[11px] font-bold font-mono text-text truncate w-full">{state.name}</span>
                  <span className="text-[11px] font-mono text-text-muted truncate w-full">{state.flag}</span>
                  {state.montageRef && (
                    <span className="text-[11px] font-mono truncate w-full" style={{ color: MODULE_COLORS.content }}>{state.montageRef}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Entry indicator */}
          {states.length > 0 && (() => {
            const defaultState = states.find((s) => s.isDefault) ?? states[0];
            return (
              <div
                className="absolute flex items-center gap-0.5"
                style={{ left: `${defaultState.x - 9}%`, top: `${defaultState.y}%`, transform: 'translate(-100%, -50%)', zIndex: 2 }}
              >
                <span className="text-2xs text-text-muted uppercase tracking-wider font-medium">Entry</span>
                <svg width="16" height="8" viewBox="0 0 16 8">
                  <line x1="0" y1="4" x2="12" y2="4" stroke={`${EDITOR_ACCENT}50`} strokeWidth="1" />
                  <path d="M 10 1 L 14 4 L 10 7" stroke={`${EDITOR_ACCENT}50`} strokeWidth="1" fill="none" />
                </svg>
              </div>
            );
          })()}

          {/* Legend */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2.5 text-2xs text-text-muted" style={{ zIndex: 2 }}>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: MODULE_COLORS.core }} />locomotion</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: MODULE_COLORS.evaluator }} />combat</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: ACCENT_ORANGE }} />reaction</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: EDITOR_ACCENT }} />other</span>
          </div>

          {/* Instruction hint */}
          <div className="absolute top-2 left-2 text-[11px] text-text-muted/50 font-mono" style={{ zIndex: 2 }}>
            Drag to move · Click to select · Use toolbar for transitions
          </div>
        </div>

        {/* ── Property Panel ── */}
        <div className="space-y-3">
          {/* Priority cascade */}
          <div className="rounded-lg border border-border bg-surface-deep p-3">
            <div className="flex items-center gap-2 mb-2">
              <Settings2 className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-bold text-text">Priority Cascade</span>
            </div>
            <p className="text-2xs text-text-muted mb-2">
              ComputeAnimState() checks from top (highest) to bottom.
            </p>
            <div className="space-y-1">
              {sortedByPriority.map((s) => {
                const color = STATE_TYPE_COLORS[s.stateType];
                const isSelected = selectedStateId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStateId(s.id); setEditingPanel('state'); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-surface-hover/30"
                    style={isSelected ? { backgroundColor: `${ACCENT_CYAN}15`, border: `1px solid ${ACCENT_CYAN}30` } : { border: '1px solid transparent' }}
                  >
                    <span className="text-xs font-mono font-bold w-4 text-center" style={{ color }}>{s.priority}</span>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] font-mono font-medium text-text flex-1 truncate">{s.name}</span>
                    <span className="text-[11px] font-mono text-text-muted truncate max-w-[80px]">{s.flag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* State editor */}
          {editingPanel === 'state' && selectedState && (
            <StatePropertyEditor
              state={selectedState}
              onUpdate={(updates) => updateState(selectedState.id, updates)}
              onDelete={() => removeState(selectedState.id)}
              onStartDrawing={() => setDrawingTransition(selectedState.id)}
              transitions={transitions}
              stateMap={stateMap}
            />
          )}

          {/* Transition editor */}
          {editingPanel === 'transition' && selectedTransition && (
            <TransitionPropertyEditor
              transition={selectedTransition}
              stateMap={stateMap}
              onUpdate={(updates) => updateTransition(selectedTransition.id, updates)}
              onDelete={() => removeTransition(selectedTransition.id)}
            />
          )}

          {/* Transition list */}
          <TransitionList
            transitions={transitions}
            stateMap={stateMap}
            selectedId={selectedTransitionId}
            onSelect={(id) => { setSelectedTransitionId(id); setSelectedStateId(null); setEditingPanel('transition'); }}
          />
        </div>
      </div>

      {/* ── Code Output ── */}
      {showCode && (
        <CodeOutputPanel
          code={generatedCode}
          codeTab={codeTab}
          onTabChange={setCodeTab}
          onCopy={handleCopy}
          copiedSection={copiedSection}
          onExport={handleExport}
        />
      )}
    </div>
  );
}

// ── Sub-components ──

function StatePropertyEditor({
  state,
  onUpdate,
  onDelete,
  onStartDrawing,
  transitions,
  stateMap,
}: {
  state: EditorState;
  onUpdate: (updates: Partial<EditorState>) => void;
  onDelete: () => void;
  onStartDrawing: () => void;
  transitions: EditorTransition[];
  stateMap: Map<string, EditorState>;
}) {
  const outgoing = transitions.filter((t) => t.from === state.id);
  const incoming = transitions.filter((t) => t.to === state.id);

  return (
    <div className="rounded-lg border border-border bg-surface-deep p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-text-muted" />
          Edit State
        </span>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors" title="Delete state">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Name</label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text outline-none focus:border-border-bright transition-colors"
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Type</label>
        <div className="flex gap-1">
          {STATE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ stateType: opt.value })}
              className="flex-1 px-2 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: state.stateType === opt.value ? `${STATE_TYPE_COLORS[opt.value]}20` : 'transparent',
                color: state.stateType === opt.value ? STATE_TYPE_COLORS[opt.value] : 'var(--text-muted)',
                border: `1px solid ${state.stateType === opt.value ? `${STATE_TYPE_COLORS[opt.value]}50` : 'var(--border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Priority (0 = highest)</label>
        <input
          type="number"
          min={0}
          value={state.priority}
          onChange={(e) => onUpdate({ priority: parseInt(e.target.value, 10) || 0 })}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text outline-none focus:border-border-bright transition-colors"
        />
      </div>

      {/* Flag */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Flag / Condition</label>
        <input
          type="text"
          value={state.flag}
          onChange={(e) => onUpdate({ flag: e.target.value })}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text outline-none focus:border-border-bright transition-colors"
          list="known-flags"
        />
        <datalist id="known-flags">
          {KNOWN_FLAGS.map((f) => <option key={f} value={f} />)}
        </datalist>
        <div className="mt-1 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-2xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={state.isDefault ?? false}
              onChange={(e) => onUpdate({ isDefault: e.target.checked })}
              className="rounded border-border"
            />
            Default / fallback state
          </label>
        </div>
      </div>

      {/* Montage ref */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Montage Reference</label>
        <input
          type="text"
          value={state.montageRef ?? ''}
          onChange={(e) => onUpdate({ montageRef: e.target.value || undefined })}
          placeholder="e.g., AM_Dodge"
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
        />
      </div>

      {/* Connections summary */}
      <div className="pt-2 border-t border-border/40">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Connections</span>
          <button
            onClick={onStartDrawing}
            className="text-2xs font-medium px-2 py-0.5 rounded transition-colors"
            style={{ color: ACCENT_CYAN, backgroundColor: `${ACCENT_CYAN}${OPACITY_10}` }}
          >
            + Draw arrow
          </button>
        </div>
        {outgoing.length > 0 && (
          <div className="text-2xs text-text-muted space-y-0.5">
            {outgoing.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <ArrowRight className="w-2.5 h-2.5" style={{ color: STATUS_SUCCESS }} />
                <span className="font-mono">{stateMap.get(t.to)?.name ?? '?'}</span>
              </div>
            ))}
          </div>
        )}
        {incoming.length > 0 && (
          <div className="text-2xs text-text-muted space-y-0.5 mt-1">
            {incoming.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <ArrowRight className="w-2.5 h-2.5 rotate-180" style={{ color: STATUS_INFO }} />
                <span className="font-mono">{stateMap.get(t.from)?.name ?? '?'}</span>
              </div>
            ))}
          </div>
        )}
        {outgoing.length === 0 && incoming.length === 0 && (
          <div className="text-2xs text-text-muted italic">No connections</div>
        )}
      </div>
    </div>
  );
}

function TransitionPropertyEditor({
  transition,
  stateMap,
  onUpdate,
  onDelete,
}: {
  transition: EditorTransition;
  stateMap: Map<string, EditorState>;
  onUpdate: (updates: Partial<EditorTransition>) => void;
  onDelete: () => void;
}) {
  const fromName = stateMap.get(transition.from)?.name ?? '?';
  const toName = stateMap.get(transition.to)?.name ?? '?';

  return (
    <div className="rounded-lg border border-border bg-surface-deep p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text flex items-center gap-2">
          <ArrowRight className="w-3 h-3" style={{ color: ACCENT_CYAN }} />
          Edit Transition
        </span>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* From / To display */}
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="px-2 py-1 rounded" style={{ backgroundColor: `${EDITOR_ACCENT}15`, color: EDITOR_ACCENT }}>{fromName}</span>
        <ArrowRight className="w-3 h-3 text-text-muted" />
        <span className="px-2 py-1 rounded bg-surface-hover text-text">{toName}</span>
      </div>

      {/* Rule */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Transition Rule</label>
        <input
          type="text"
          value={transition.rule}
          onChange={(e) => onUpdate({ rule: e.target.value })}
          placeholder="e.g., bIsAttacking == true"
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
        />
        {/* Quick templates */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {KNOWN_RULE_TEMPLATES.slice(0, 5).map((tmpl) => (
            <button
              key={tmpl}
              onClick={() => onUpdate({ rule: tmpl })}
              className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-border/40 text-text-muted hover:text-text hover:bg-surface-hover transition-colors truncate max-w-[140px]"
              title={tmpl}
            >
              {tmpl.length > 20 ? tmpl.slice(0, 18) + '...' : tmpl}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Description (optional)</label>
        <input
          type="text"
          value={transition.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value || undefined })}
          placeholder="e.g., Dodge cancels attack recovery"
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
        />
      </div>
    </div>
  );
}

function TransitionList({
  transitions,
  stateMap,
  selectedId,
  onSelect,
}: {
  transitions: EditorTransition[];
  stateMap: Map<string, EditorState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface-deep p-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between text-xs font-bold text-text"
      >
        <span className="flex items-center gap-2">
          <ArrowRight className="w-3 h-3 text-text-muted" />
          Transitions ({transitions.length})
        </span>
        {collapsed ? <ChevronRight className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
      </button>
      {!collapsed && (
        <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
          {transitions.map((t) => {
            const from = stateMap.get(t.from);
            const to = stateMap.get(t.to);
            const isSelected = selectedId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-left text-2xs transition-colors hover:bg-surface-hover/30"
                style={isSelected ? { backgroundColor: `${ACCENT_CYAN}15`, border: `1px solid ${ACCENT_CYAN}30` } : { border: '1px solid transparent' }}
              >
                <span className="font-mono font-medium text-text truncate">{from?.name ?? '?'}</span>
                <ArrowRight className="w-2.5 h-2.5 text-text-muted flex-shrink-0" />
                <span className="font-mono font-medium text-text truncate">{to?.name ?? '?'}</span>
                {t.rule && (
                  <span className="ml-auto font-mono text-text-muted truncate max-w-[120px]">{t.rule}</span>
                )}
              </button>
            );
          })}
          {transitions.length === 0 && (
            <div className="text-2xs text-text-muted italic px-2 py-1">No transitions defined</div>
          )}
        </div>
      )}
    </div>
  );
}

function CodeOutputPanel({
  code,
  codeTab,
  onTabChange,
  onCopy,
  copiedSection,
  onExport,
}: {
  code: string;
  codeTab: 'full' | 'enum' | 'compute' | 'setup';
  onTabChange: (tab: 'full' | 'enum' | 'compute' | 'setup') => void;
  onCopy: (section: string, text: string) => void;
  copiedSection: string | null;
  onExport: () => void;
}) {
  const tabs = [
    { id: 'full' as const, label: 'Full Output' },
    { id: 'enum' as const, label: 'Enum' },
    { id: 'compute' as const, label: 'ComputeAnimState()' },
    { id: 'setup' as const, label: 'AnimBP Setup' },
  ];

  return (
    <div className="rounded-xl border border-border bg-[#0a0a1a] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Code2 className="w-3.5 h-3.5 mr-2" style={{ color: EDITOR_ACCENT }} />
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: codeTab === t.id ? `${EDITOR_ACCENT}20` : 'transparent',
                color: codeTab === t.id ? EDITOR_ACCENT : 'var(--text-muted)',
                border: codeTab === t.id ? `1px solid ${EDITOR_ACCENT}40` : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCopy(codeTab, code)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: copiedSection === codeTab ? `${STATUS_SUCCESS}20` : `${EDITOR_ACCENT}10`,
              color: copiedSection === codeTab ? STATUS_SUCCESS : EDITOR_ACCENT,
            }}
          >
            {copiedSection === codeTab ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedSection === codeTab ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: `${STATUS_SUCCESS}10`, color: STATUS_SUCCESS }}
          >
            <Download className="w-3 h-3" />
            Export .cpp
          </button>
        </div>
      </div>

      {/* Code content */}
      <pre className="p-4 text-[11px] font-mono text-text-muted leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
