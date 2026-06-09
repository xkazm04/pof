/**
 * Regression guard for "Restore visible focus rings on bestiary controls".
 * Several interactive controls in the sub_bestiary AI-logic / archetype UIs used
 * `focus:outline-none` with no visible replacement (a WCAG 2.4.7 failure). They
 * must now use the shared `.focus-ring-inset` utility (reads `--focus-accent`,
 * falling back to a visible blue) so keyboard / screen-reader users can see focus.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { FeatureRow } from '@/types/feature-matrix';
import { AILogicTab } from '@/components/modules/core-engine/sub_bestiary/ai-logic/AILogicTab';
import { DecisionDebugger } from '@/components/modules/core-engine/sub_bestiary/ai-logic/DecisionDebugger';
import { ArchetypeBuilder } from '@/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeBuilder';
import { DECISION_LOG } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { STATUS_INFO } from '@/lib/chart-colors';

afterEach(cleanup);

/** Class strings the requirement explicitly removes from these controls. */
const BANNED = ['focus:outline-none', 'focus:border-[var(--accent)]'];

function expectNoStrippedFocus(html: string) {
  for (const token of BANNED) expect(html).not.toContain(token);
}

describe('bestiary controls restore a visible focus ring on .focus-ring-inset', () => {
  it('AILogicTab: the Wave Spawner Configurator toggle uses focus-ring-inset, not focus:outline-none', () => {
    // Scope to the toggle itself — the rest of the AI-logic subtree (BTFlowchart
    // search, etc.) carries its own, in-scope-elsewhere focus styling.
    const { getByText } = render(
      <AILogicTab featureMap={new Map<string, FeatureRow>()} accent={STATUS_INFO} />,
    );
    const toggle = getByText('Wave Spawner Configurator').closest('button');
    expect(toggle).not.toBeNull();
    expect(toggle!.className).toContain('focus-ring-inset');
    expect(toggle!.className).not.toContain('focus:outline-none');
  });

  it('DecisionDebugger: every decision-row expander uses focus-ring-inset', () => {
    const { container } = render(<DecisionDebugger />);
    // One expander button per decision entry — each carries the focus token.
    const rings = container.querySelectorAll('button.focus-ring-inset');
    expect(rings.length).toBe(DECISION_LOG.length);
    expectNoStrippedFocus(container.innerHTML);
  });

  it('ArchetypeBuilder: the name input and behaviour-tree select use focus-ring-inset', () => {
    const { container } = render(<ArchetypeBuilder />);
    // 1 text input + 1 select = 2 unified fields.
    expect(container.querySelectorAll('.focus-ring-inset').length).toBe(2);
    expect(container.querySelector('input[type="text"]')!.className).toContain('focus-ring-inset');
    expect(container.querySelector('select')!.className).toContain('focus-ring-inset');
    expectNoStrippedFocus(container.innerHTML);
  });
});
