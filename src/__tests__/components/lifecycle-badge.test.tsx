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
});
