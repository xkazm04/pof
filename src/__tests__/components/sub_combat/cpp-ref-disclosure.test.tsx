import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DamagePipelineFlow } from '@/components/modules/core-engine/sub_combat/damage-pipeline/DamagePipelineFlow';
import { HealPipelineFlow } from '@/components/modules/core-engine/sub_combat/damage-pipeline/HealPipelineFlow';
import { DirectHealthFlow } from '@/components/modules/core-engine/sub_combat/damage-pipeline/DirectHealthFlow';
import { DAMAGE_PIPELINE, HEAL_PIPELINE, DIRECT_PIPELINE } from '@/components/modules/core-engine/sub_combat/damage-pipeline/pipeline-data';

// scan-sweep night 2026-11-08, combat-damage-pipeline: one dismiss contract across the three flows.

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

const FLOWS = [
  { name: 'Damage', Flow: DamagePipelineFlow, nodes: DAMAGE_PIPELINE },
  { name: 'Heal', Flow: HealPipelineFlow, nodes: HEAL_PIPELINE },
  { name: 'Direct', Flow: DirectHealthFlow, nodes: DIRECT_PIPELINE },
] as const;

describe.each(FLOWS)('$name flow C++ reference disclosure', ({ Flow, nodes }) => {
  const nodeId = nodes.find((n) => n.cppRef)!.id;
  const open = () => {
    render(<Flow />);
    fireEvent.click(screen.getByTestId(`pipeline-node-${nodeId}`));
    return screen.getByTestId('pipeline-cpp-ref');
  };

  it('panel is a labelled region', () => {
    const panel = open();
    expect(panel.getAttribute('role')).toBe('region');
    expect(panel.getAttribute('aria-label') ?? '').toMatch(/C\+\+ reference/i);
  });

  it('Escape anywhere inside the flow closes the panel and returns focus to the node', () => {
    const panel = open();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByTestId('pipeline-cpp-ref')).toBeNull();
    const g = screen.getByTestId(`pipeline-node-${nodeId}`).closest('g[role="button"]') as SVGGElement;
    expect(document.activeElement).toBe(g);
  });

  it('a close button hides the panel and returns focus to the node', () => {
    open();
    const close = screen.queryByTestId('pipeline-cpp-ref-close');
    expect(close).not.toBeNull();
    fireEvent.click(close!);
    expect(screen.queryByTestId('pipeline-cpp-ref')).toBeNull();
    const g = screen.getByTestId(`pipeline-node-${nodeId}`).closest('g[role="button"]') as SVGGElement;
    expect(document.activeElement).toBe(g);
  });
});

describe('two mounted flows never share a panel id', () => {
  it('Heal panel ids are unique per instance', () => {
    render(<><HealPipelineFlow /><HealPipelineFlow /></>);
    const id = HEAL_PIPELINE.find((n) => n.cppRef)!.id;
    const nodes = screen.getAllByTestId(`pipeline-node-${id}`);
    nodes.forEach((n) => fireEvent.click(n));
    const ids = screen.getAllByTestId('pipeline-cpp-ref').map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });
});
