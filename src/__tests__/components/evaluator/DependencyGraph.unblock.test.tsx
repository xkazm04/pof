/**
 * scan-sweep --challenge (module-topology-graph/B): a blocked feature row in the
 * Dependencies tab names what to build first (its cross-module build frontier)
 * and builds it in one click through the standard useModuleCLI + planItemToTask
 * dispatch path. Statuses mocked as in DependencyGraph.a11y.test.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MODULE_LABELS } from '@/lib/module-registry';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));
vi.mock('@/lib/api-utils', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    tryApiFetch: vi.fn().mockResolvedValue({
      ok: true,
      data: { statuses: [{ moduleId: 'arpg-character', featureName: 'core', status: 'implemented' }] },
    }),
  };
});
const execute = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { DependencyGraph } from '@/components/modules/evaluator/DependencyGraph';

afterEach(cleanup);

describe('DependencyGraph — build what unblocks a feature, in one click', () => {
  it("activating 'Build AARPGCharacterBase' on Combat's Hit detection row dispatches one feature-fix task", async () => {
    const utils = render(<DependencyGraph />);
    const combatLabel = MODULE_LABELS['arpg-combat'];
    const combat = await waitFor(() => {
      const node = [...utils.container.querySelectorAll('g[role="button"]')]
        .find((g) => (g.getAttribute('aria-label') ?? '').startsWith(`${combatLabel}:`));
      expect(node).toBeTruthy();
      return node as SVGGElement;
    }, { timeout: 3000 });
    fireEvent.click(combat);

    const row = await utils.findByRole('group', { name: 'Hit detection' });
    fireEvent.click(within(row).getByRole('button', { name: 'Build AARPGCharacterBase' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    const task = execute.mock.calls[0][0];
    expect(task.type).toBe('feature-fix');
    expect(task.moduleId).toBe('arpg-character');
    expect(task.featureName).toBe('AARPGCharacterBase');
    expect(task.label).toMatch(/AARPGCharacterBase/);
  });
});
