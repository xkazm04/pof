import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { CalcInput } from '@/components/modules/core-engine/sub_combat/damage-pipeline/ExecComponents';
import { ExecutionBreakdownPanel } from '@/components/modules/core-engine/sub_combat/damage-pipeline/ExecutionBreakdownPanel';
import { DirectHealthFlow } from '@/components/modules/core-engine/sub_combat/damage-pipeline/DirectHealthFlow';
import { FeedbackTab } from '@/components/modules/core-engine/sub_combat/polish/FeedbackTab';
import { FEEDBACK_PARAMS } from '@/components/modules/core-engine/sub_combat/_shared/data';
import { ComboChainBuilder } from '@/components/modules/core-engine/sub_combat/combos';
import { PRESET_COMBOS } from '@/components/modules/core-engine/sub_ability/_shared/data';
import { DIRECT_PIPELINE } from '@/components/modules/core-engine/sub_combat/damage-pipeline/pipeline-data';

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

describe('DirectHealthFlow honours the disclosure affordance FlowNode draws', () => {
  it('every node with a cppRef reveals it on click, like the Damage and Heal flows', () => {
    render(<DirectHealthFlow />);
    const withRef = DIRECT_PIPELINE.filter(n => n.cppRef);
    expect(withRef.length).toBeGreaterThan(0);
    let revealed = 0;
    for (const node of withRef) {
      fireEvent.click(screen.getByTestId(`pipeline-node-${node.id}`));
      const panel = screen.queryByTestId('pipeline-cpp-ref');
      if (panel?.textContent?.includes(node.cppRef!)) revealed++;
      fireEvent.click(screen.getByTestId(`pipeline-node-${node.id}`));
    }
    expect(revealed).toBe(withRef.length);
  });

  it('exposes the same keyboard/ARIA contract: a labelled group of focusable step buttons', () => {
    const { container } = render(<DirectHealthFlow />);
    const svg = screen.getByTestId('direct-pipeline-svg');
    expect(svg.getAttribute('role')).toBe('group');
    expect(svg.getAttribute('aria-label') ?? '').toMatch(/Direct/i);
    const buttons = container.querySelectorAll('g[role="button"][tabindex="0"]');
    expect(buttons.length).toBe(DIRECT_PIPELINE.filter(n => n.cppRef).length);
    const first = buttons[0] as SVGGElement;
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByTestId('pipeline-cpp-ref')).not.toBeNull();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(screen.queryByTestId('pipeline-cpp-ref')).toBeNull();
  });
});

describe('FeedbackTab "Copy Python" reports what the clipboard actually did', () => {
  const values = Object.fromEntries(FEEDBACK_PARAMS.map(p => [p.id, p.defaultValue]));
  const renderTab = () => render(<FeedbackTab feedbackValues={values} juiceLevel={0.5} onPreset={() => {}} onParam={() => {}} />);
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const setClipboard = (v: unknown) => Object.defineProperty(navigator, 'clipboard', { value: v, configurable: true });
  afterEach(() => { if (original) Object.defineProperty(navigator, 'clipboard', original); else setClipboard(undefined); });

  it('says Copied only after writeText resolves', async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    renderTab();
    await act(async () => { fireEvent.click(screen.getByTestId('combat-feel-export')); });
    expect(screen.getByTestId('combat-feel-export').textContent).toMatch(/Copied/);
  });

  it('does not claim Copied when the write is rejected', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    renderTab();
    await act(async () => { fireEvent.click(screen.getByTestId('combat-feel-export')); });
    const label = screen.getByTestId('combat-feel-export').textContent ?? '';
    expect(label).not.toMatch(/^Copied$/);
    expect(label).toMatch(/fail/i);
  });

  it('does not claim Copied when there is no clipboard at all', async () => {
    setClipboard(undefined);
    renderTab();
    await act(async () => { fireEvent.click(screen.getByTestId('combat-feel-export')); });
    const label = screen.getByTestId('combat-feel-export').textContent ?? '';
    expect(label).not.toMatch(/^Copied$/);
    expect(label).toMatch(/fail/i);
  });
});

describe('combo timeline remove buttons are reachable without a mouse', () => {
  it('each block has a named remove button that becomes visible on keyboard focus', () => {
    render(<ComboChainBuilder />);
    const removes = screen.queryAllByRole('button', { name: /^Remove .+ from the combo/ });
    expect(removes.length).toBe(PRESET_COMBOS[0].abilities.length);
    for (const b of removes) {
      expect(b.getAttribute('type')).toBe('button');
      expect(b.className).toMatch(/focus-visible:opacity-100/);
    }
  });
});
