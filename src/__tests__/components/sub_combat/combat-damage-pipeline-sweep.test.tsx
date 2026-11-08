import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CalcInput } from '@/components/modules/core-engine/sub_combat/damage-pipeline/ExecComponents';
import { ExecutionBreakdownPanel } from '@/components/modules/core-engine/sub_combat/damage-pipeline/ExecutionBreakdownPanel';

// scan-sweep night 2026-11-08, combat-damage-pipeline: one block per landed finding.

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
afterEach(() => cleanup());

describe('CalcInput keeps a typed value inside its declared range', () => {
  it('clamps below min and above max instead of passing the raw number through', () => {
    const onChange = vi.fn();
    render(<CalcInput value={30} onChange={onChange} min={0} max={1} label="Armor" />);
    const input = screen.getByLabelText('Armor');
    fireEvent.change(input, { target: { value: '-100' } });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent.change(input, { target: { value: '0.5' } });
    expect(onChange).toHaveBeenLastCalledWith(0.5);
  });

  it('a typed negative Armor never drives the shipped figure to Infinity', () => {
    const { container } = render(<ExecutionBreakdownPanel />);
    fireEvent.click(screen.getByTestId('calc-toggle'));
    fireEvent.change(screen.getByLabelText('Armor'), { target: { value: '-100' } });
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Infinity|NaN/);
  });
});
