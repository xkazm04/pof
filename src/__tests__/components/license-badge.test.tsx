import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LicenseBadge } from '@/components/modules/content/audio/LicenseBadge';

describe('LicenseBadge', () => {
  it('renders Commercial OK for yes', () => {
    render(<LicenseBadge license="yes" kind="sfx" />);
    expect(screen.getByText(/commercial/i)).toBeTruthy();
  });
  it('renders Extra license required for extra-license', () => {
    render(<LicenseBadge license="extra-license" kind="music" />);
    expect(screen.getByText(/extra license/i)).toBeTruthy();
  });
  it('renders Non-commercial for non-commercial', () => {
    render(<LicenseBadge license="non-commercial" kind="sfx" />);
    expect(screen.getByText(/non-commercial/i)).toBeTruthy();
  });
});
