/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, onboarding-designer):
 * PlanningGlossary declares itself "surfaced across ImplementationPlan and
 * PlanMatrixMap" but had zero importers in src/ and e2e/ — the plain-language
 * definitions of Ready / Unblocks / Critical path / Impact were unreachable from
 * the plan that uses those words. The plan header now mounts it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(async () => undefined), sendPrompt: vi.fn(), isRunning: false }),
}));
vi.mock('@/hooks/useFeatureStatuses', () => ({
  useFeatureStatuses: () => ({
    statusMap: new Map<string, string>(), statuses: [], isLoading: false, loaded: true,
    failed: false, error: null, scope: null, refresh: () => {},
  }),
}));
vi.mock('@/components/modules/core-engine/PlanMatrixMap', () => ({ PlanMatrixMap: () => null }));

import { ImplementationPlan } from '@/components/modules/core-engine/ImplementationPlan';
import { PLANNING_GLOSSARY } from '@/components/modules/core-engine/PlanningGlossary';

afterEach(cleanup);

describe('ImplementationPlan surfaces the planning glossary', () => {
  it('the header opens the glossary listing every planning term', () => {
    render(<ImplementationPlan />);
    fireEvent.click(screen.getByRole('button', { name: /glossary for planning terms/i }));
    const dialog = screen.getByRole('dialog', { name: 'Planning glossary' });
    for (const entry of PLANNING_GLOSSARY) {
      expect(dialog.textContent).toContain(entry.definition);
    }
  });
});
