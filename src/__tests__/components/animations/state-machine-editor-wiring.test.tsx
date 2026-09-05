import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent, renderHook, waitFor } from '@testing-library/react';

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

import { AnimationsView } from '@/components/modules/content/animations/AnimationsView';
import { useStateMachineEditor } from '@/components/modules/content/animations/StateMachineEditor/useStateMachineEditor';
import { seedFromScan } from '@/components/modules/content/animations/StateMachineEditor/seed';
import { clearDrafts, loadDraft } from '@/components/modules/content/animations/StateMachineEditor/draftStore';
import { useProjectStore } from '@/stores/projectStore';
import type { AnimBPScanResult } from '@/app/api/filesystem/scan-animbp/route';

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

beforeEach(() => {
  clearDrafts();
  useProjectStore.setState({ projectPath: '', projectName: '' });
});

function openTab(container: HTMLElement, label: string) {
  const tab = Array.from(container.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  expect(tab, `${label} tab button`).toBeTruthy();
  act(() => { fireEvent.click(tab!); });
}

describe('the visual State Machine Editor is reachable from AnimationsView', () => {
  it('renders the editor canvas when its tab is opened', () => {
    const view = render(<AnimationsView />);
    openTab(view.container, 'SM Editor');
    expect(view.container.querySelector('[data-testid="pof-anim-sm-editor-tab"]')).toBeTruthy();
    expect(view.container.querySelector('[data-testid="pof-anim-sm-editor-canvas"]')).toBeTruthy();
  });

  it('says its states are a starting template when no scan has produced any', () => {
    const view = render(<AnimationsView />);
    openTab(view.container, 'SM Editor');
    const prov = view.container.querySelector('[data-testid="pof-anim-sm-editor-provenance"]');
    expect(prov).toBeTruthy();
    expect(prov!.getAttribute('data-source')).toBe('template');
    expect((prov!.textContent ?? '').toLowerCase()).toContain('template');
  });
});

describe('seedFromScan', () => {
  it('turns a scan into editor states/transitions and names its origin', () => {
    const seed = seedFromScan(SCAN);
    expect(seed).toBeTruthy();
    expect(seed!.source).toBe('scan');
    expect(seed!.states.map((s) => s.name)).toEqual(['Idle', 'Sprint', 'SaberSlash']);
    expect(seed!.states.find((s) => s.name === 'SaberSlash')!.montageRef).toBe('AM_SaberSlash');
    expect(seed!.transitions).toHaveLength(2);
    expect(seed!.transitions[0].rule).toBe('Speed > 0');
    expect(seed!.origin).toContain('UPoFAnimInstance');
  });

  it('returns null when the scan produced no states — nothing to seed from', () => {
    expect(seedFromScan({ ...SCAN, states: [] })).toBeNull();
    expect(seedFromScan(null)).toBeNull();
  });
});

describe('the editor round-trips edits into the linter and the generated C++', () => {
  it('reflects a renamed state in ComputeAnimState() and in the linter findings', async () => {
    const { result } = renderHook(() => useStateMachineEditor({ seed: seedFromScan(SCAN) }));

    // Seeded from the scan, not from the six invented locomotion states.
    expect(result.current.states.map((s) => s.name)).toEqual(['Idle', 'Sprint', 'SaberSlash']);

    act(() => { result.current.setShowCode(true); result.current.setCodeTab('compute'); });
    await waitFor(() => expect(result.current.generatedCode).toContain('Sprint'));

    const sprintId = result.current.states.find((s) => s.name === 'Sprint')!.id;
    act(() => { result.current.updateState(sprintId, { name: 'Dashing', flag: 'bIsDashing' }); });

    await waitFor(() => {
      expect(result.current.generatedCode).toContain('Dashing');
      expect(result.current.generatedCode).not.toContain('Sprint');
    });
    // `bIsDashing` is not a KNOWN_FLAG — the live linter must say so.
    expect(result.current.warnings.some((w) => w.message.includes('bIsDashing'))).toBe(true);
  });

  it('keeps unsaved canvas edits across an LRU unmount via the draft store', () => {
    const key = 'anim-sm-editor:test';
    const first = renderHook(() => useStateMachineEditor({ seed: seedFromScan(SCAN), draftKey: key }));
    const sprintId = first.result.current.states.find((s) => s.name === 'Sprint')!.id;
    act(() => { first.result.current.updateState(sprintId, { name: 'Dashing' }); });
    expect(loadDraft(key)?.states.some((s) => s.name === 'Dashing')).toBe(true);
    first.unmount();

    // Remounted after eviction: the edit is still there, and the editor says so.
    const second = renderHook(() => useStateMachineEditor({ seed: seedFromScan(SCAN), draftKey: key }));
    expect(second.result.current.states.map((s) => s.name)).toContain('Dashing');
    expect(second.result.current.draftRestored).toBe(true);
  });
});
