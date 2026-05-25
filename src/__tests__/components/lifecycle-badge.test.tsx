import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';

describe('LifecycleBadge', () => {
  it('renders the planned label', () => {
    const { getByText } = render(<LifecycleBadge state="planned" />);
    expect(getByText(/planned/i)).toBeTruthy();
  });

  it('renders the verified label', () => {
    const { getByText } = render(<LifecycleBadge state="verified" />);
    expect(getByText(/verified/i)).toBeTruthy();
  });

  it('renders a leading icon for each state', () => {
    const { container } = render(<LifecycleBadge state="generated" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('adds a pulsing ::before dot for in-flight states', () => {
    for (const state of ['scaffolded', 'generated', 'wired'] as const) {
      const { container } = render(<LifecycleBadge state={state} />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('before:animate-pulse');
    }
  });

  it('does not pulse for terminal states', () => {
    for (const state of ['planned', 'verified', 'failed'] as const) {
      const { container } = render(<LifecycleBadge state={state} />);
      const badge = container.querySelector('span');
      expect(badge?.className).not.toContain('before:animate-pulse');
    }
  });
});
