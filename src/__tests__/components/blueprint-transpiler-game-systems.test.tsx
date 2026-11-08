/**
 * scan-sweep 2026-11-08 — blueprint-transpiler-game-systems hardening.
 * One describe per landed finding; each was seen red before its fix.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/blueprint-transpiler/route';
import { resetBlueprintTranspilerSessions } from '@/hooks/useBlueprintTranspiler';
import { ReplicationScaffoldPanel } from '@/components/modules/game-systems/multiplayer/ReplicationScaffoldPanel';
import { useProjectStore } from '@/stores/projectStore';
import { ChangeCard } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/ChangeCard';
import type { SemanticChange } from '@/types/blueprint';

afterEach(() => cleanup());

function change(partial: Partial<SemanticChange> = {}): SemanticChange {
  return {
    id: 'c1',
    type: 'add',
    scope: 'variable',
    name: 'Health',
    description: 'Health exists in the Blueprint but not in C++',
    conflictLevel: 'compatible',
    ...partial,
  } as SemanticChange;
}

describe('ChangeCard — the expand toggle is reachable by keyboard', () => {
  it('renders the toggle as a button carrying aria-expanded', () => {
    const { container } = render(<ChangeCard change={change()} />);
    const toggle = container.querySelector('button[aria-expanded]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    // No click handler on a non-interactive wrapper (mouse-only door).
    expect(container.querySelector('div[class*="cursor-pointer"]')).toBeNull();
  });

  it('expands on activation and exposes the detail panel it controls', () => {
    const { container } = render(<ChangeCard change={change()} />);
    const toggle = container.querySelector('button[aria-expanded]') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = container.querySelector(`[id="${panelId}"]`);
    expect(panel?.textContent).toContain('Health exists in the Blueprint');
  });
});

describe('ReplicationScaffoldPanel - copy goes through the shared CopyButton', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a denied clipboard write neither rejects unhandled nor claims success', async () => {
    resetBlueprintTranspilerSessions();
    useProjectStore.setState({ projectName: 'P', projectPath: 'C:/proj' });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) =>
      POST(new NextRequest(`http://localhost${url}`, init as ConstructorParameters<typeof NextRequest>[1]))));
    const writeText = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const unhandled: unknown[] = [];
    const onUnhandled = (r: unknown) => { unhandled.push(r); };
    process.on('unhandledRejection', onUnhandled);
    try {
      render(<ReplicationScaffoldPanel />);
      fireEvent.click(screen.getByText('Load Sample'));
      await act(async () => { fireEvent.click(screen.getByText('Scan Replication')); });
      await screen.findByText('Generated replication boilerplate');
      const copy = screen.getByRole('button', { name: /copy/i });
      await act(async () => { fireEvent.click(copy); });
      await new Promise((r) => setTimeout(r, 0));
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(unhandled).toEqual([]);
      expect(screen.queryByText('Copied')).toBeNull();
      expect(screen.getByRole('button', { name: /copy/i }).getAttribute('aria-label')).not.toMatch(/copied/i);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
