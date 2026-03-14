import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { IntentProvider, useIntent } from '../hooks';
import { createIntentBus } from '../bus';
import { createDirector, NEEDS_LLM } from '../director';
import type { Intent, IntentResult } from '../types';
import type { StateEngine, WorkspaceState } from '../../state/types';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockStateEngine(): StateEngine<WorkspaceState> {
  return {
    getState: vi.fn(() => ({
      layout: { template: 'single' as const, gridTemplateRows: '1fr', gridTemplateColumns: '1fr' },
      panels: [],
      streaming: null,
    })),
    getSnapshot: vi.fn(() => '{}'),
    dispatch: vi.fn(),
    undo: vi.fn(() => null),
    redo: vi.fn(() => null),
    canUndo: vi.fn(() => false),
    canRedo: vi.fn(() => false),
    getHistory: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
    _applyWithoutUndo: vi.fn(),
    _recordUndoGroup: vi.fn(),
  };
}

function makeIntent(type: Intent['type'] = 'compose'): Intent {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    type,
    payload: { action: 'open', panelType: 'test' } as never,
    source: 'click',
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useIntent', () => {
  it('throws when used outside IntentProvider', () => {
    // Suppress console.error from React's error boundary
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useIntent());
    }).toThrow('useIntent must be used within IntentProvider');

    spy.mockRestore();
  });

  it('returns dispatch function', () => {
    const engine = mockStateEngine();
    const director = createDirector();
    const bus = createIntentBus(director, engine);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntentProvider bus={bus}>{children}</IntentProvider>
    );

    const { result } = renderHook(() => useIntent(), { wrapper });
    expect(typeof result.current.dispatch).toBe('function');
  });

  it('isResolving is false with no pending intents', () => {
    const engine = mockStateEngine();
    const director = createDirector({
      compose: () => ({
        status: 'resolved' as const,
        patches: [],
        origin: 'user' as const,
        description: 'noop',
      }),
    });
    const bus = createIntentBus(director, engine);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntentProvider bus={bus}>{children}</IntentProvider>
    );

    const { result } = renderHook(() => useIntent(), { wrapper });
    expect(result.current.isResolving).toBe(false);
    expect(result.current.pendingCount).toBe(0);
  });

  it('isResolving becomes true after dispatching NEEDS_LLM intent', () => {
    const engine = mockStateEngine();
    const director = createDirector(); // no handlers => all needs-llm
    const bus = createIntentBus(director, engine);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntentProvider bus={bus}>{children}</IntentProvider>
    );

    const { result } = renderHook(() => useIntent(), { wrapper });

    act(() => {
      result.current.dispatch(makeIntent('query'));
    });

    expect(result.current.isResolving).toBe(true);
    expect(result.current.pendingCount).toBe(1);
  });

  it('re-renders when dispatch produces a new event', () => {
    const engine = mockStateEngine();
    const resolvedResult: IntentResult = {
      status: 'resolved',
      patches: [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      origin: 'user',
      description: 'test',
    };
    const director = createDirector({
      compose: () => resolvedResult,
    });
    const bus = createIntentBus(director, engine);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntentProvider bus={bus}>{children}</IntentProvider>
    );

    let renderCount = 0;
    const { result } = renderHook(
      () => {
        renderCount++;
        return useIntent();
      },
      { wrapper },
    );

    const initialRenderCount = renderCount;

    act(() => {
      result.current.dispatch(makeIntent('compose'));
    });

    // Should have re-rendered at least once after dispatch
    expect(renderCount).toBeGreaterThan(initialRenderCount);
  });
});
