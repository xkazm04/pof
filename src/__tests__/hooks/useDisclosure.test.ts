import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDisclosure, disclosureA11y } from '@/hooks/useDisclosure';

describe('useDisclosure', () => {
  it('starts closed by default and toggles open with matched aria-expanded', () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.open).toBe(false);
    expect(result.current.buttonProps['aria-expanded']).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    expect(result.current.buttonProps['aria-expanded']).toBe(true);
  });

  it('respects the initial open value', () => {
    const { result } = renderHook(() => useDisclosure(true));
    expect(result.current.open).toBe(true);
    expect(result.current.buttonProps['aria-expanded']).toBe(true);
  });

  it('wires aria-controls to a stable panel id', () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.buttonProps['aria-controls']).toBe(result.current.panelProps.id);
    expect(result.current.panelProps.id).toMatch(/^disclosure-/);
    const firstId = result.current.panelProps.id;
    act(() => result.current.toggle());
    expect(result.current.panelProps.id).toBe(firstId); // id is stable across toggles
  });
});

describe('disclosureA11y', () => {
  it('builds matched button + panel props for parent-owned open state', () => {
    const a = disclosureA11y(true, 'panel-1');
    expect(a.buttonProps).toEqual({ 'aria-expanded': true, 'aria-controls': 'panel-1' });
    expect(a.panelProps).toEqual({ id: 'panel-1' });
  });
});
