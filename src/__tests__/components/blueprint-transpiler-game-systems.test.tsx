/**
 * scan-sweep 2026-11-08 — blueprint-transpiler-game-systems hardening.
 * One describe per landed finding; each was seen red before its fix.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
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
