import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGDDComplianceStore } from '@/stores/gddComplianceStore';
import type { ComplianceReport, ModuleCompliance, ComplianceGap, ReconciliationSuggestion } from '@/types/gdd-compliance';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const gap: ComplianceGap = {
  id: 'gap-1', moduleId: 'arpg-combat', moduleName: 'Combat', category: 'systems',
  title: 'Dodge missing', description: 'Design specifies dodge; code lacks it.',
  direction: 'design-ahead', severity: 'major', effort: 'medium',
  designState: 'Dodge with i-frames', codeState: 'No dodge', suggestion: 'Implement dodge', resolved: false,
};
const moduleFixture: ModuleCompliance = {
  moduleId: 'arpg-combat', moduleName: 'Combat', score: 64,
  totalFeatures: 10, implemented: 6, partial: 2, missing: 2,
  checklistTotal: 8, checklistDone: 5, gaps: [gap],
};
const suggestions: ReconciliationSuggestion[] = [
  { id: 's1', moduleId: 'arpg-combat', type: 'update-gdd', title: 'Update combat GDD', description: 'Sync dodge spec', effort: 'small', priority: 1 },
];
const report: ComplianceReport = {
  generatedAt: '2026-05-28T10:00:00.000Z', overallScore: 82,
  modules: [moduleFixture], totalGaps: 1, criticalGaps: 0, suggestions,
};

import { GDDComplianceView } from '@/components/modules/evaluator/GDDComplianceView';

describe('GDDComplianceView accessibility', () => {
  beforeEach(() => {
    useGDDComplianceStore.setState({
      report, modules: [moduleFixture], suggestions,
      selectedModuleId: null, isAuditing: false, error: null,
    });
  });

  it('labels the score ring as an image with the compliance score', () => {
    render(<GDDComplianceView />);
    expect(screen.getByRole('img', { name: /Compliance score 82 out of 100/i })).toBeTruthy();
  });

  it('marks the suggestions disclosure with aria-expanded + aria-controls', () => {
    render(<GDDComplianceView />);
    const btn = screen.getByRole('button', { name: /Reconciliation Suggestions/i });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-controls')).toBeTruthy();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('marks the module card as a disclosure that expands on select', () => {
    render(<GDDComplianceView />);
    const card = screen.getByRole('button', { name: /Combat/i });
    expect(card.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
    expect(card.getAttribute('aria-controls')).toBe('gdd-module-detail-arpg-combat');
  });

  it('exposes each gap as a collapsible disclosure that flips aria-expanded', () => {
    render(<GDDComplianceView />);
    fireEvent.click(screen.getByRole('button', { name: /Combat/i })); // reveal gaps
    const gapBtn = screen.getByRole('button', { name: /Dodge missing/i });
    expect(gapBtn.getAttribute('aria-expanded')).toBe('false');
    expect(gapBtn.getAttribute('aria-controls')).toBeTruthy();
    fireEvent.click(gapBtn);
    expect(gapBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('labels the gap direction split with a directional aria-label (not color-only)', () => {
    render(<GDDComplianceView />);
    fireEvent.click(screen.getByRole('button', { name: /Combat/i })); // reveal gaps
    // The collapsed row carries the split indicator as a labeled image.
    expect(screen.getAllByRole('img', { name: /Design is ahead of code/i }).length).toBeGreaterThan(0);
    // Expanding adds the full-size split in the panel banner too.
    fireEvent.click(screen.getByRole('button', { name: /Dodge missing/i }));
    expect(screen.getAllByRole('img', { name: /Design is ahead of code/i }).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the full suggestion on its own line instead of truncating it behind a tooltip', () => {
    render(<GDDComplianceView />);
    fireEvent.click(screen.getByRole('button', { name: /Combat/i })); // reveal gaps
    fireEvent.click(screen.getByRole('button', { name: /Dodge missing/i })); // expand gap
    const suggestion = screen.getByText('Implement dodge');
    expect(suggestion.className).not.toContain('truncate');
    // No truncation tooltip — the text stands on its own full-width line.
    expect(suggestion.closest('[title]')).toBeNull();
  });
});
