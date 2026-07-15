import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GASBlueprintEditor } from '@/components/modules/core-engine/sub_ability/blueprint';
import { GASBalanceSimulator } from '@/components/modules/core-engine/sub_ability/gas-balance';
import { AbilityForge } from '@/components/modules/core-engine/sub_ability/forge';

// jsdom lacks these; the editor SVGs / scroll affordances call them.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

/**
 * Direction 1 acceptance: each of the three dark GAS engines now has a JSX
 * importer (mounted as a Spellbook tab) and renders standalone with zero props.
 */
describe('Ability engine tabs — render smoke', () => {
  it('GASBlueprintEditor renders its header', () => {
    render(<GASBlueprintEditor />);
    expect(screen.getByText('GAS Blueprint Editor')).toBeTruthy();
  });

  it('GASBalanceSimulator renders its Monte-Carlo header + run affordance', () => {
    render(<GASBalanceSimulator />);
    expect(screen.getByText('Monte Carlo Balance Simulator')).toBeTruthy();
    // The empty-state prompt before any run.
    expect(screen.getByText(/Configure a scenario and run/i)).toBeTruthy();
  });

  it('AbilityForge renders its plain-language input face', () => {
    render(<AbilityForge />);
    expect(screen.getByText('Ability Forge')).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/A dashing slash that chains/i),
    ).toBeTruthy();
  });
});
