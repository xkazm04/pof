/**
 * Editing a Test Harness suite: an edit stays on the suite it was opened for. The runner
 * and snapshot hooks are mocked, so nothing reaches a UE editor.
 */

import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, renderHook, act, screen, fireEvent } from '@testing-library/react';
import type { PofTestSpec } from '@/types/pof-bridge';

vi.mock('@/hooks/useTestRunner', () => ({
  useTestRunner: () => ({ runTest: vi.fn(), results: [], isRunning: false, error: null, clearResults: vi.fn(), abort: vi.fn() }),
}));

vi.mock('@/hooks/useSnapshots', () => ({
  useSnapshots: () => ({
    capture: vi.fn(), acceptBaselines: vi.fn(), diffReport: null, isCapturing: false, error: null, refreshDiff: vi.fn(),
  }),
}));

import { useTestHarnessPanel } from '@/components/modules/project-setup/TestHarnessPanel/useTestHarnessPanel';
import { parseScenariosDraft } from '@/components/modules/project-setup/TestHarnessPanel/helpers';
import { TEMPLATE_SCENARIO } from '@/components/modules/project-setup/TestHarnessPanel/constants';
import { SuitesTab } from '@/components/modules/project-setup/TestHarnessPanel/SuitesTab';
import { ScenarioCard } from '@/components/modules/project-setup/TestHarnessPanel/ScenarioCard';
import type { TestSuite } from '@/components/modules/project-setup/TestHarnessPanel/types';

afterEach(() => cleanup());

/** Two suites; A is active with its JSON editor open and its first scenario expanded. */
function twoSuitesEditingA() {
  const { result: hook } = renderHook(() => useTestHarnessPanel());
  act(() => hook.current.createSuite());
  const a = hook.current.activeSuiteId as string;
  act(() => hook.current.createSuite());
  const b = hook.current.activeSuiteId as string;
  act(() => hook.current.setActiveSuiteId(a));
  act(() => hook.current.openJsonEditor());
  act(() => hook.current.setEditingScenarioIdx(0));
  return { hook, a, b };
}

describe('switching suites', () => {
  it("closes the JSON editor, so A's draft cannot be applied over B", () => {
    const { hook, b } = twoSuitesEditingA();
    act(() => hook.current.setActiveSuiteId(b));
    expect(hook.current.jsonEditorOpen).toBe(false);
    const before = hook.current.activeSuite?.scenarios;
    act(() => hook.current.applyJsonDraft());
    expect(hook.current.activeSuite?.scenarios).toBe(before);
  });

  it("does not carry A's expanded scenario onto B", () => {
    const { hook, b } = twoSuitesEditingA();
    act(() => hook.current.setActiveSuiteId(b));
    expect(hook.current.editingScenarioIdx).toBeNull();
  });

  it('creating a suite also leaves the previous editor behind', () => {
    const { hook } = twoSuitesEditingA();
    act(() => hook.current.createSuite());
    expect(hook.current.jsonEditorOpen).toBe(false);
    expect(hook.current.editingScenarioIdx).toBeNull();
  });
});

/** The Suites tab over live scenario state, its first scenario expanded. */
function EditableSuite() {
  const [scenarios, setScenarios] = useState<PofTestSpec[]>([TEMPLATE_SCENARIO]);
  const suite: TestSuite = { id: 's', name: 'S', description: '', scenarios, snapshotPresets: [], createdAt: 0 };
  const noop = () => {};
  return (
    <SuitesTab
      suites={[suite]} activeSuiteId="s" activeSuite={suite} isRunning={false} editingScenarioIdx={0}
      jsonEditorOpen={false} jsonDraft=""
      onSelectSuite={noop} onCreateSuite={noop} onDeleteSuite={noop} onDuplicateSuite={noop}
      onUpdateField={noop} onAddScenario={noop} onRemoveScenario={noop}
      onUpdateScenario={(i, s) => setScenarios((prev) => prev.map((x, j) => (j === i ? s : x)))}
      onSetEditingIdx={noop} onOpenJsonEditor={noop} onSetJsonDraft={noop} onApplyJsonDraft={noop}
      onCloseJsonEditor={noop} onRunSuite={noop} onAbort={noop}
    />
  );
}

describe('editing a scenario in place', () => {
  it('typing in Test ID keeps the same input mounted (focus survives the keystroke)', () => {
    render(<EditableSuite />);
    const input = screen.getByLabelText('Test ID') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'renamed' } });
    expect(input.isConnected).toBe(true);
    expect(input.value).toBe('renamed');
  });
});

describe('the scenario card header', () => {
  it('keeps Remove a separate, named control that does not toggle the card', () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(
      <ScenarioCard scenario={TEMPLATE_SCENARIO} index={0} isExpanded={false} onToggle={onToggle} onUpdate={() => {}} onRemove={onRemove} />,
    );
    expect(container.querySelector('button button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove scenario 1' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('exposes the expanded state on its toggle', () => {
    render(<ScenarioCard scenario={TEMPLATE_SCENARIO} index={0} isExpanded onToggle={() => {}} onUpdate={() => {}} onRemove={() => {}} />);
    const toggle = screen.getByRole('button', { name: new RegExp(TEMPLATE_SCENARIO.description) });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('the scenarios JSON draft', () => {
  it('accepts the template scenario', () => {
    const r = parseScenariosDraft(JSON.stringify([TEMPLATE_SCENARIO]));
    expect(r.ok).toBe(true);
  });

  it.each([
    ['not an array', '{}', /array/i],
    ['a non-object element', '[1]', /#1/],
    ['an empty object', '[{}]', /#1.*testId/],
    ['a spawn without a location', JSON.stringify([{ ...TEMPLATE_SCENARIO, setup: [{ spawn: 'x', tag: 't' }] }]), /#1.*setup/],
    ['an unknown action type', JSON.stringify([{ ...TEMPLATE_SCENARIO, actions: [{ type: 'jump' }] }]), /#1.*actions/],
    ['a repeated testId', JSON.stringify([TEMPLATE_SCENARIO, TEMPLATE_SCENARIO]), /duplicate.*test-basic-spawn/i],
    ['unparseable text', '[', /.+/],
  ])('refuses %s and says why', (_name, draft, message) => {
    const r = parseScenariosDraft(draft);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });

  it('applyJsonDraft keeps the scenarios and the editor when the shape is wrong', () => {
    const { hook } = twoSuitesEditingA();
    const before = hook.current.activeSuite?.scenarios;
    act(() => hook.current.setJsonDraft('[{}]'));
    act(() => hook.current.applyJsonDraft());
    expect(hook.current.activeSuite?.scenarios).toBe(before);
    expect(hook.current.jsonEditorOpen).toBe(true);
  });
});
