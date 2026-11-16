/**
 * The Record form's Config options are CONFIG_OPTIONS (the typed BuildConfig list the
 * profile editor uses), not a second hand-kept literal list.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

const constants = vi.hoisted(() => ({ extra: false }));
vi.mock('@/components/modules/game-systems/BuildConfigSelector/constants', async () => {
  const actual = await vi.importActual<typeof import('@/components/modules/game-systems/BuildConfigSelector/constants')>(
    '@/components/modules/game-systems/BuildConfigSelector/constants',
  );
  return {
    ...actual,
    get CONFIG_OPTIONS() {
      return constants.extra
        ? [...actual.CONFIG_OPTIONS, { value: 'Profile', label: 'Profile', description: 'x' }]
        : actual.CONFIG_OPTIONS;
    },
  };
});

import { RecordBuildForm } from '@/components/modules/game-systems/BuildHistoryDashboard/RecordBuildForm';
import { CONFIG_OPTIONS } from '@/components/modules/game-systems/BuildConfigSelector/constants';

afterEach(() => {
  cleanup();
  constants.extra = false;
});

function optionValues(): string[] {
  const select = screen.getByLabelText('Config') as HTMLSelectElement;
  return Array.from(select.options).map((o) => o.value);
}

describe('Record form config options', () => {
  it('equal CONFIG_OPTIONS values', () => {
    render(<RecordBuildForm onSubmit={() => {}} nextVersion="0.1.1" />);
    expect(optionValues()).toEqual(CONFIG_OPTIONS.map((o) => o.value));
  });

  it('follow a config added to CONFIG_OPTIONS', () => {
    constants.extra = true;
    render(<RecordBuildForm onSubmit={() => {}} nextVersion="0.1.1" />);
    expect(optionValues()).toContain('Profile');
  });
});
