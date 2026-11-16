import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { DamagePipelineFlow } from '@/components/modules/core-engine/sub_combat/damage-pipeline/DamagePipelineFlow';
import { DAMAGE_PIPELINE } from '@/components/modules/core-engine/sub_combat/damage-pipeline/pipeline-data';

// scan-sweep night 2026-11-08, combat-damage-pipeline: the diagram's placement switch must not
// silently drop a node that DAMAGE_PIPELINE (the UE ground truth) gains.

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

describe('DamagePipelineFlow draws every DAMAGE_PIPELINE node', () => {
  it('renders pipeline-node-<id> for each id, matching the aria-label step count', () => {
    render(<DamagePipelineFlow />);
    const missing = DAMAGE_PIPELINE.filter((n) => screen.queryByTestId(`pipeline-node-${n.id}`) === null).map((n) => n.id);
    expect(missing).toEqual([]);
    const svg = screen.getByTestId('damage-pipeline-svg');
    expect(svg.getAttribute('aria-label')).toContain(`${DAMAGE_PIPELINE.length} steps`);
    expect(svg.querySelectorAll('[data-testid^="pipeline-node-"]').length).toBe(DAMAGE_PIPELINE.length);
  });
});
