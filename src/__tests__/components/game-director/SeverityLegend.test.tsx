import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SeverityLegend } from '@/components/modules/game-director/SeverityLegend';
import { SEVERITY_ORDER, SEVERITY_TOKENS, SEVERITY_DESCRIPTIONS } from '@/lib/game-director-styles';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

describe('SeverityLegend', () => {
  it('renders every severity with its label and plain-language description', () => {
    render(<SeverityLegend />);
    expect(screen.getByRole('note', { name: 'Severity legend' })).toBeTruthy();
    for (const sev of SEVERITY_ORDER) {
      expect(screen.getByText(SEVERITY_TOKENS[sev].label)).toBeTruthy();
      expect(screen.getByText(SEVERITY_DESCRIPTIONS[sev])).toBeTruthy();
    }
  });

  it('is dismissible and can be reopened', () => {
    render(<SeverityLegend />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide severity legend' }));
    expect(screen.queryByRole('note', { name: 'Severity legend' })).toBeNull();
    // Collapses to a small reopen affordance.
    fireEvent.click(screen.getByRole('button', { name: 'Severity legend' }));
    expect(screen.getByRole('note', { name: 'Severity legend' })).toBeTruthy();
  });
});
