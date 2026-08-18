import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// NO registry mock. The whole point of this suite is that attribution is driven
// by the REAL `SPECIAL_CATEGORIES` / `MODULE_COMPONENTS`, so a stub would hide
// exactly the defect being closed (a special category the hook never heard of).
// `lazy()` only records a thunk, so importing the real registry loads no chunks.
import { useActiveModuleId } from '@/hooks/useActiveModuleId';
import { useNavigationStore } from '@/stores/navigationStore';
import {
  MODULE_COMPONENTS,
  SPECIAL_CATEGORIES,
} from '@/components/layout/ModuleRenderer/registry';

/** The id the hook attributes a terminal to for a given navigation state. */
function attributedId(cat: string | null, sub: string | null): string | null {
  act(() => {
    useNavigationStore.setState({
      activeCategory: cat as never,
      activeSubModule: sub as never,
    });
  });
  const { result, unmount } = renderHook(() => useActiveModuleId());
  const id = result.current;
  unmount();
  return id;
}

beforeEach(() => {
  useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
});

describe('the special-category set is registry truth, not a hardcoded list', () => {
  it('has THREE special categories — game-director among them', () => {
    // The premise check. `useActiveModuleId` used to hardcode
    // `'project-setup' || 'evaluator'`; this asserts against the real registry
    // that the set is larger than that list, so the omission was a live bug and
    // not a phantom.
    expect(Object.keys(SPECIAL_CATEGORIES).sort()).toEqual([
      'evaluator',
      'game-director',
      'project-setup',
    ]);
  });

  it('does not also register the special categories as sub-modules', () => {
    // If a special id were ALSO a sub-module the two branches could both match
    // and the rule would be ambiguous. It is not.
    for (const id of Object.keys(SPECIAL_CATEGORIES)) {
      expect(MODULE_COMPONENTS[id as never]).toBeUndefined();
    }
  });
});

describe('useActiveModuleId attributes to the module the user is LOOKING AT', () => {
  it('attributes to the sub-module in the dual-set state', () => {
    // `navigateToModule('game-design-doc')` sets BOTH: category `evaluator`
    // (derived context for the rails) and sub-module `game-design-doc` (what was
    // asked for). The visible pane is the sub-module, so attribution must be too.
    // Under the old category-first rule this returned 'evaluator'.
    expect(attributedId('evaluator', 'game-design-doc')).toBe('game-design-doc');
  });

  it('reaches the dual-set state through the real navigateToModule', () => {
    act(() => {
      useNavigationStore.getState().navigateToModule('game-design-doc');
    });
    const { activeCategory, activeSubModule } = useNavigationStore.getState();
    expect([activeCategory, activeSubModule]).toEqual(['evaluator', 'game-design-doc']);

    const { result } = renderHook(() => useActiveModuleId());
    expect(result.current).toBe('game-design-doc');
  });

  it('attributes to a special category that the old hardcoded list omitted', () => {
    // game-director IS special (asserted against the registry above) but was
    // absent from the hardcoded list, so this fell through to `activeSubModule`
    // and returned null — a maximized Game Director terminal was attributed to
    // nothing. The class of bug, not just this instance, is what the registry
    // lookup closes.
    expect(attributedId('game-director', null)).toBe('game-director');
  });

  it('still attributes to the special categories the old list did cover', () => {
    expect(attributedId('evaluator', null)).toBe('evaluator');
    expect(attributedId('project-setup', null)).toBe('project-setup');
  });

  it('attributes to the sub-module under an ordinary category', () => {
    expect(attributedId('content', 'materials')).toBe('materials');
  });

  it('attributes to nothing when an ordinary category has no sub-module', () => {
    // No pane is visible in this state, so no session can be "the visible one".
    expect(attributedId('content', null)).toBeNull();
    expect(attributedId(null, null)).toBeNull();
  });

  it('falls back to the category when the stored sub-module has no view', () => {
    // Navigation state is persisted, so an id from an older build can rehydrate.
    // ModuleRenderer shows the category in that state; attribution follows.
    expect(attributedId('evaluator', 'ghost-removed-module')).toBe('evaluator');
  });

  it('attributes to nothing when a stale sub-module sits under an ordinary category', () => {
    expect(attributedId('content', 'ghost-removed-module')).toBeNull();
  });
});
