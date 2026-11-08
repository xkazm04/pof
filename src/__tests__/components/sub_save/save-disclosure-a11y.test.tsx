import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { VersionHistory } from '@/components/modules/core-engine/sub_save/versions/VersionHistory';
import { MigrationPathGraph } from '@/components/modules/core-engine/sub_save/versions/MigrationPathGraph';

afterEach(cleanup);

function assertDisclosure(button: HTMLButtonElement) {
  expect(button.getAttribute('type')).toBe('button');
  const before = button.getAttribute('aria-expanded');
  expect(before === 'true' || before === 'false').toBe(true);
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe(before === 'true' ? 'false' : 'true');
}

describe('save version disclosures expose their state', () => {
  it('VersionHistory rows announce expanded state', () => {
    const { container } = render(<VersionHistory />);
    assertDisclosure(container.querySelector('button') as HTMLButtonElement);
  });

  it('MigrationPathGraph nodes announce expanded state', () => {
    const { container } = render(<MigrationPathGraph />);
    assertDisclosure(container.querySelector('button') as HTMLButtonElement);
  });
});
