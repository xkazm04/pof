import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, cleanup, act, fireEvent, renderHook } from '@testing-library/react';
import type { AnimBPScanResult } from '@/app/api/filesystem/scan-animbp/route';
import type { CLITask } from '@/lib/cli-task';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// useReducedMotion reads matchMedia (absent in jsdom).
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));

// Never spawn a real CLI: the tab's rail is captured, execute is a spy.
const cli = vi.hoisted(() => ({
  execute: null as unknown as ReturnType<typeof vi.fn>,
  opts: null as null | { moduleId: string; sessionKey: string; onComplete?: (success: boolean) => void },
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { moduleId: string; sessionKey: string; onComplete?: (success: boolean) => void }) => {
    cli.opts = opts;
    return { execute: cli.execute, sendPrompt: () => undefined, isRunning: false };
  },
}));

// The scan is operator-triggered; the test owns its result and the trigger.
const scan = vi.hoisted(() => ({
  result: null as AnimBPScanResult | null,
  handleScan: null as unknown as ReturnType<typeof vi.fn>,
}));
vi.mock('@/components/modules/content/animations/AnimationStateMachine/useAnimBpScan', () => ({
  useAnimBpScan: () => ({
    scanResult: scan.result,
    isScanning: false,
    scanError: null,
    newStateIds: new Set<string>(),
    modifiedTransitions: new Set<string>(),
    handleScan: scan.handleScan,
  }),
}));

import { buildApplyPlan, buildApplyPrompt } from '@/components/modules/content/animations/StateMachineEditor/applyPlan';
import { seedFromScan, seedFromBridge, seedSignature, type EditorSeed } from '@/components/modules/content/animations/StateMachineEditor/seed';
import { useStateMachineEditor } from '@/components/modules/content/animations/StateMachineEditor/useStateMachineEditor';
import { StateMachineEditorTab } from '@/components/modules/content/animations/StateMachineEditor/EditorTab';
import { clearDrafts, loadDraft, saveDraft } from '@/components/modules/content/animations/StateMachineEditor/draftStore';
import { DEFAULT_STATES, DEFAULT_TRANSITIONS, KNOWN_FLAGS } from '@/components/modules/content/animations/StateMachineEditor/constants';
import type { EditorState, EditorTransition } from '@/components/modules/content/animations/StateMachineEditor/types';
import { validateStateMachine, type ValidationWarning } from '@/lib/state-machine-validator';
import { useProjectStore } from '@/stores/projectStore';

const SCAN: AnimBPScanResult = {
  scannedAt: '2026-09-05T00:00:00.000Z',
  animInstanceClass: 'UPoFAnimInstance',
  headerPath: 'PoF/Animation/PoFAnimInstance.h',
  states: [
    { name: 'Idle', hasMontage: false, montageRef: null },
    { name: 'Sprint', hasMontage: false, montageRef: null },
    { name: 'SaberSlash', hasMontage: true, montageRef: 'AM_SaberSlash' },
  ],
  transitions: [
    { from: 'Idle', to: 'Sprint', rule: 'Speed > 0' },
    { from: 'Sprint', to: 'Idle', rule: null },
  ],
  montageRefs: ['AM_SaberSlash'],
  animVariables: ['Speed'],
  scanDurationMs: 12,
};

const idOf = (seed: EditorSeed, name: string) => seed.states.find((s) => s.name === name)!.id;

/** Case-4 edits: rename Sprint->Run, Idle priority 0->3, add Run->SaberSlash. */
function editedCanvas(seed: EditorSeed): { states: EditorState[]; transitions: EditorTransition[] } {
  const states = seed.states.map((s) => {
    if (s.name === 'Sprint') return { ...s, name: 'Run' };
    if (s.name === 'Idle') return { ...s, priority: 3 };
    return s;
  });
  const transitions = [
    ...seed.transitions,
    { id: 'trans-new-1', from: idOf(seed, 'Sprint'), to: idOf(seed, 'SaberSlash'), rule: 'bIsAttacking == true' },
  ];
  return { states, transitions };
}

beforeEach(() => {
  clearDrafts();
  cli.execute = vi.fn();
  cli.opts = null;
  scan.result = null;
  scan.handleScan = vi.fn();
  useProjectStore.setState({ projectPath: '', projectName: '' });
});

describe('buildApplyPlan — a seed-relative change plan', () => {
  it('blocks a template canvas: there is no project target to write to', () => {
    const plan = buildApplyPlan({ seed: null, states: DEFAULT_STATES, transitions: DEFAULT_TRANSITIONS, warnings: [] });
    expect(plan.status).toBe('blocked');
    expect(plan.reasons[0].toLowerCase()).toContain('template');
    expect(plan.reasons[0].toLowerCase()).toContain('no project target');
  });

  it('blocks a bridge-only seed: it names no AnimInstance header — run Scan AnimBP', () => {
    const seed = seedFromBridge([{ states: ['Idle', 'Run'], transitions: [] }], '/Game/ABP_Hero')!;
    const plan = buildApplyPlan({ seed, states: seed.states, transitions: seed.transitions, warnings: [] });
    expect(plan.status).toBe('blocked');
    expect(plan.reasons.join(' ')).toContain('AnimInstance header');
    expect(plan.reasons.join(' ')).toContain('Scan AnimBP');
  });

  it('reports no-changes when the canvas is the seed', () => {
    const seed = seedFromScan(SCAN)!;
    const plan = buildApplyPlan({ seed, states: seed.states, transitions: seed.transitions, warnings: [] });
    expect(plan.status).toBe('no-changes');
    expect(plan.changes).toEqual([]);
  });

  it('names every change vs the seed by state NAME, never by editor id', () => {
    const seed = seedFromScan(SCAN)!;
    const plan = buildApplyPlan({ seed, ...editedCanvas(seed), warnings: [] });
    expect(plan.status).toBe('ready');
    expect(plan.changes.map((c) => c.kind)).toEqual(['state-renamed', 'priority-changed', 'transition-added']);
    const [renamed, priority, added] = plan.changes.map((c) => c.label);
    expect(renamed).toMatch(/Sprint.*Run/);
    expect(priority).toMatch(/Idle.*0.*3/);
    expect(added).toMatch(/Run.*SaberSlash/);
    expect(added).toContain('bIsAttacking == true');
    for (const c of plan.changes) expect(c.label).not.toContain('scanned-');
  });

  it('blocks on an error-severity lint finding and says which', () => {
    const seed = seedFromScan(SCAN)!;
    const dup: ValidationWarning = {
      kind: 'duplicate-state-name', severity: 'error', stateIds: [], transitionIds: [],
      message: 'State name "Run" is used by 2 states — generated C++ would have duplicate enumerators.',
    };
    const plan = buildApplyPlan({ seed, ...editedCanvas(seed), warnings: [dup] });
    expect(plan.status).toBe('blocked');
    expect(plan.reasons).toContain(dup.message);
  });
});

describe('buildApplyPrompt — the write-back instruction', () => {
  it('targets the SCANNED class and header and lists every change by name', () => {
    const seed = seedFromScan(SCAN)!;
    const plan = buildApplyPlan({ seed, ...editedCanvas(seed), warnings: [] });
    const prompt = buildApplyPrompt(plan);
    expect(prompt).toContain('PoF/Animation/PoFAnimInstance.h');
    expect(prompt).toContain('UPoFAnimInstance::ComputeAnimState');
    for (const c of plan.changes) expect(prompt).toContain(c.label);
    expect(prompt).not.toContain('UARPGAnimInstance');
    expect(prompt).not.toContain('scanned-');
  });
});

describe('useStateMachineEditor — markApplied rebases only on a converged re-scan', () => {
  const AFTER_RENAME: AnimBPScanResult = {
    ...SCAN,
    states: [SCAN.states[0], { name: 'Run', hasMontage: false, montageRef: null }, SCAN.states[2]],
    transitions: [{ from: 'Idle', to: 'Run', rule: 'Speed > 0' }, { from: 'Run', to: 'Idle', rule: null }],
  };

  it('clears the draft and adopts the re-scan when it yields no-changes', () => {
    const key = 'anim-sm-editor:apply-clean';
    const seed = seedFromScan(SCAN)!;
    const h = renderHook(({ s }) => useStateMachineEditor({ seed: s, draftKey: key }), { initialProps: { s: seed } });
    act(() => { h.result.current.updateState(idOf(seed, 'Sprint'), { name: 'Run', flag: 'bIsRun' }); });
    expect(loadDraft(key)).not.toBeNull();

    act(() => { h.result.current.markApplied(); });
    // Not yet: only the re-scan can say the project now matches.
    expect(h.result.current.touched).toBe(true);
    expect(loadDraft(key)).not.toBeNull();

    const rescanned = seedFromScan(AFTER_RENAME)!;
    h.rerender({ s: rescanned });
    expect(h.result.current.touched).toBe(false);
    expect(loadDraft(key)).toBeNull();
    expect(h.result.current.states).toBe(rescanned.states);
    expect(h.result.current.applyPlan.status).toBe('no-changes');
  });

  it('keeps the draft and surfaces the residual change when the re-scan still differs', () => {
    const key = 'anim-sm-editor:apply-residual';
    const seed = seedFromScan(SCAN)!;
    const h = renderHook(({ s }) => useStateMachineEditor({ seed: s, draftKey: key }), { initialProps: { s: seed } });
    act(() => {
      h.result.current.updateState(idOf(seed, 'Sprint'), { name: 'Run', flag: 'bIsRun' });
      h.result.current.addTransition(idOf(seed, 'Sprint'), idOf(seed, 'SaberSlash'));
    });
    act(() => { h.result.current.markApplied(); });
    h.rerender({ s: seedFromScan(AFTER_RENAME)! });

    expect(h.result.current.touched).toBe(true);
    expect(loadDraft(key)).not.toBeNull();
    expect(h.result.current.states.map((s) => s.name)).toEqual(['Idle', 'Run', 'SaberSlash']);
    expect(h.result.current.applyPlan.changes.map((c) => c.kind)).toEqual(['transition-added']);
    expect(h.result.current.applyPlan.changes[0].label).toMatch(/Run.*SaberSlash/);
    expect(h.result.current.lastApplyOutcome).toBe('residual');
  });

  it('[guard] seedSignature ignores the additive target field', () => {
    const seed = seedFromScan(SCAN)!;
    const { target: _target, ...withoutTarget } = seed as EditorSeed & { target?: unknown };
    void _target;
    expect(seedSignature(seed)).toBe(seedSignature(withoutTarget as EditorSeed));
    expect(seed.states.map((s) => s.id)).toEqual(['scanned-Idle', 'scanned-Sprint', 'scanned-SaberSlash']);
    expect(seed.transitions.map((t) => t.id)).toEqual(['seed-Idle->Sprint', 'seed-Sprint->Idle']);
  });
});

describe('StateMachineEditorTab — Apply goes through the module CLI rail, on explicit confirm only', () => {
  const PROJECT = 'C:/proj';
  const KEY = `anim-sm-editor:${PROJECT}`;

  /** A lint-clean edit: Sprint->Run, plus Run->SaberSlash and SaberSlash->Idle. */
  function readyCanvas(seed: EditorSeed) {
    const states = seed.states.map((s) => (s.name === 'Sprint' ? { ...s, name: 'Run', flag: 'bIsRun' } : s));
    const transitions = [
      ...seed.transitions,
      { id: 'trans-a', from: idOf(seed, 'Sprint'), to: idOf(seed, 'SaberSlash'), rule: 'bIsAttacking' },
      { id: 'trans-b', from: idOf(seed, 'SaberSlash'), to: idOf(seed, 'Idle'), rule: '!bIsAttacking' },
    ];
    return { states, transitions };
  }
  const AFTER_APPLY: AnimBPScanResult = {
    ...SCAN,
    states: [SCAN.states[0], { name: 'Run', hasMontage: false, montageRef: null }, SCAN.states[2]],
    transitions: [
      { from: 'Idle', to: 'Run', rule: 'Speed > 0' },
      { from: 'Run', to: 'Idle', rule: null },
      { from: 'Run', to: 'SaberSlash', rule: 'bIsAttacking' },
      { from: 'SaberSlash', to: 'Idle', rule: '!bIsAttacking' },
    ],
  };

  const applyBtn = (c: HTMLElement) => c.querySelector('[data-testid="pof-anim-sm-editor-apply"]') as HTMLButtonElement | null;
  const confirmBtn = (c: HTMLElement) => c.querySelector('[data-testid="pof-anim-sm-editor-apply-confirm"]') as HTMLButtonElement | null;

  function mountReady() {
    useProjectStore.setState({ projectPath: PROJECT, projectName: 'PoF' });
    scan.result = SCAN;
    const seed = seedFromScan(SCAN)!;
    const canvas = readyCanvas(seed);
    saveDraft(KEY, canvas, Date.now());
    const view = render(createElement(StateMachineEditorTab));
    return { view, seed, canvas };
  }

  function confirmApply(container: HTMLElement) {
    const btn = applyBtn(container);
    expect(btn, 'Apply button').toBeTruthy();
    expect(btn!.disabled).toBe(false);
    act(() => { fireEvent.click(btn!); });
    expect(cli.execute).not.toHaveBeenCalled(); // the click opens the change list; it writes nothing
    const ok = confirmBtn(container);
    expect(ok, 'confirm button').toBeTruthy();
    act(() => { fireEvent.click(ok!); });
  }

  it('a confirmed ready plan dispatches exactly one quickAction whose prompt is buildApplyPrompt(plan)', () => {
    const { view, seed, canvas } = mountReady();
    expect(view.container.textContent).toContain('Run');
    confirmApply(view.container);

    const warnings = validateStateMachine(canvas.states, canvas.transitions, KNOWN_FLAGS);
    const plan = buildApplyPlan({ seed, ...canvas, warnings });
    expect(plan.status).toBe('ready');
    expect(cli.execute).toHaveBeenCalledTimes(1);
    const task = cli.execute.mock.calls[0][0] as CLITask;
    expect(task.type).toBe('quick-action');
    expect(task.moduleId).toBe('animations');
    expect(task.prompt).toBe(buildApplyPrompt(plan));
    expect(cli.opts?.moduleId).toBe('animations');
  });

  it('a blocked plan disables Apply and dispatches nothing', () => {
    // No scan: the canvas is the template.
    const view = render(createElement(StateMachineEditorTab));
    const btn = applyBtn(view.container);
    expect(btn, 'Apply button').toBeTruthy();
    expect(btn!.disabled).toBe(true);
    act(() => { fireEvent.click(btn!); });
    expect(confirmBtn(view.container)).toBeNull();
    expect(cli.execute).toHaveBeenCalledTimes(0);
  });

  it('onComplete(true) re-scans; a converged re-scan clears the draft', () => {
    const { view } = mountReady();
    confirmApply(view.container);
    expect(scan.handleScan).not.toHaveBeenCalled();
    act(() => { cli.opts!.onComplete!(true); });
    expect(scan.handleScan).toHaveBeenCalledTimes(1);
    expect(loadDraft(KEY)).not.toBeNull();

    scan.result = AFTER_APPLY;
    view.rerender(createElement(StateMachineEditorTab));
    expect(loadDraft(KEY)).toBeNull();
    expect(applyBtn(view.container)!.disabled).toBe(true); // no-changes
  });

  it('onComplete(false) keeps the draft and does not re-scan', () => {
    const { view } = mountReady();
    confirmApply(view.container);
    act(() => { cli.opts!.onComplete!(false); });
    expect(scan.handleScan).not.toHaveBeenCalled();
    expect(loadDraft(KEY)).not.toBeNull();
    expect(applyBtn(view.container)!.disabled).toBe(false);
  });
});
