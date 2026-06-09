import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  SquadChoreographyEditor,
  SquadConfigErrorBanner,
} from '@/components/modules/game-systems/SquadChoreographyEditor';
import type { SquadConfigError } from '@/types/squad-tactics';

afterEach(cleanup);

describe('SquadChoreographyEditor', () => {
  it('renders the formation diagram for the default (valid) config', () => {
    render(<SquadChoreographyEditor />);
    // Happy path: the SVG and at least one member dot render, no error banner.
    expect(screen.getByTestId('squad-formation-svg')).toBeTruthy();
    expect(screen.queryByTestId('squad-config-error')).toBeNull();
  });
});

describe('SquadConfigErrorBanner', () => {
  it('surfaces the typed error message and field as an alert', () => {
    const error: SquadConfigError = {
      code: 'invalid-separation',
      message: 'Minimum separation must be greater than zero.',
      field: 'minSeparation',
    };
    render(<SquadConfigErrorBanner error={error} />);

    const banner = screen.getByTestId('squad-config-error');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('Invalid squad configuration');
    expect(banner.textContent).toContain('Minimum separation must be greater than zero.');
    expect(banner.textContent).toContain('minSeparation');
  });

  it('renders without a field suffix when none is attributable', () => {
    const error: SquadConfigError = {
      code: 'empty-formation',
      message: 'Formation has no roles to allocate.',
    };
    render(<SquadConfigErrorBanner error={error} />);
    const banner = screen.getByTestId('squad-config-error');
    expect(banner.textContent).toContain('Formation has no roles to allocate.');
    expect(banner.textContent).not.toContain('field:');
  });
});
