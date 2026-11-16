/**
 * scan-sweep (cross-module-features): child views hand the Evaluator shell a tab
 * id as a plain `string` (`onNavigateTab(tab: string)`, fed by e.g.
 * `SubsystemSignal.linkTab?: string` in src/types/project-health.ts). The shell
 * cast it straight to TabId, so one stale or misspelt id made
 * `EVALUATOR_TAB_INFO[activeTab].plain` throw and took down the whole evaluator.
 * An unknown id must be refused and the current tab kept.
 */
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';

vi.mock('@/components/modules/evaluator/DependencyGraph', () => ({
  DependencyGraph: ({ onNavigateTab }: { onNavigateTab: (t: string) => void }) => (
    <div>
      <button type="button" onClick={() => onNavigateTab('no-such-tab')}>go-bogus</button>
      <button type="button" onClick={() => onNavigateTab('features')}>go-features</button>
    </div>
  ),
}));
vi.mock('@/components/modules/evaluator/CrossModuleFeatureDashboard', () => ({
  CrossModuleFeatureDashboard: () => <div>features-view</div>,
}));

import { EvaluatorModule } from '@/components/modules/evaluator/EvaluatorModule';
import { EVALUATOR_TAB_INFO } from '@/lib/evaluator/tab-glossary';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);
beforeEach(() => { mockFetch({ body: { success: true, data: {} } }); });

function openDependencies() {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(EVALUATOR_TAB_INFO.dependencies.label, 'i') }));
}

describe('EvaluatorModule — a child naming an unknown tab', () => {
  it('keeps the current tab instead of crashing', () => {
    render(<EvaluatorModule />);
    openDependencies();
    expect(() => fireEvent.click(screen.getByText('go-bogus'))).not.toThrow();
    expect(screen.getByText('go-bogus')).toBeTruthy();
    expect(screen.getByTestId('evaluator-active-tab-desc').textContent)
      .toContain(EVALUATOR_TAB_INFO.dependencies.plain);
  });

  it('still navigates to a real tab id (control)', () => {
    render(<EvaluatorModule />);
    openDependencies();
    fireEvent.click(screen.getByText('go-features'));
    expect(screen.getByText('features-view')).toBeTruthy();
  });
});
