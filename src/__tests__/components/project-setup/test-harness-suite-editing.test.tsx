/**
 * Editing a Test Harness suite: an edit stays on the suite it was opened for. The runner
 * and snapshot hooks are mocked, so nothing reaches a UE editor.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/useTestRunner', () => ({
  useTestRunner: () => ({ runTest: vi.fn(), results: [], isRunning: false, error: null, clearResults: vi.fn() }),
}));

vi.mock('@/hooks/useSnapshots', () => ({
  useSnapshots: () => ({
    capture: vi.fn(), acceptBaselines: vi.fn(), diffReport: null, isCapturing: false, error: null, refreshDiff: vi.fn(),
  }),
}));

import { useTestHarnessPanel } from '@/components/modules/project-setup/TestHarnessPanel/useTestHarnessPanel';
import { parseScenariosDraft } from '@/components/modules/project-setup/TestHarnessPanel/helpers';
import { TEMPLATE_SCENARIO } from '@/components/modules/project-setup/TestHarnessPanel/constants';

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
