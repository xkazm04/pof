import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createStateEngine } from '../engine';
import { createUndoStack } from '../undo';
import { useWorkspaceState, useUndoRedoKeyboard } from '../hooks';
import type { WorkspaceState } from '../types';

const INITIAL_STATE: WorkspaceState = {
  layout: { template: 'single', gridTemplateRows: '1fr', gridTemplateColumns: '1fr' },
  panels: [],
  streaming: null,
};

function makeEngine() {
  return createStateEngine<WorkspaceState>(structuredClone(INITIAL_STATE), createUndoStack());
}

describe('useWorkspaceState', () => {
  it('returns current state from engine', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useWorkspaceState(engine));
    expect(result.current.state).toEqual(INITIAL_STATE);
  });

  it('re-renders when engine state changes', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useWorkspaceState(engine));

    act(() => {
      engine.dispatch(
        [{ op: 'add', path: '/panels/-', value: { id: 'p1', type: 'test', slotIndex: 0, density: 'full', role: 'primary', uiState: {} } }],
        'user',
        'add panel'
      );
    });

    expect(result.current.state.panels).toHaveLength(1);
    expect(result.current.state.panels[0].id).toBe('p1');
  });

  it('exposes undo, redo, canUndo, canRedo', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useWorkspaceState(engine));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(typeof result.current.undo).toBe('function');
    expect(typeof result.current.redo).toBe('function');

    act(() => {
      engine.dispatch(
        [{ op: 'add', path: '/panels/-', value: { id: 'p1', type: 'test', slotIndex: 0, density: 'full', role: 'primary', uiState: {} } }],
        'user',
        'add panel'
      );
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => { result.current.undo(); });
    expect(result.current.state.panels).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.redo(); });
    expect(result.current.state.panels).toHaveLength(1);
  });
});

describe('useUndoRedoKeyboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls undo on Ctrl+Z', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoRedoKeyboard(undo, redo, true, false));

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);

    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).not.toHaveBeenCalled();
  });

  it('calls redo on Ctrl+Shift+Z', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoRedoKeyboard(undo, redo, false, true));

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true });
    document.dispatchEvent(event);

    expect(redo).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('calls redo on Ctrl+Y', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoRedoKeyboard(undo, redo, false, true));

    const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);

    expect(redo).toHaveBeenCalledTimes(1);
  });

  it('does not call undo when canUndo is false', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoRedoKeyboard(undo, redo, false, false));

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);

    expect(undo).not.toHaveBeenCalled();
  });
});
