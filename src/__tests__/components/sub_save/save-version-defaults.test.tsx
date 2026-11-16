import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { VersionHistory } from '@/components/modules/core-engine/sub_save/versions/VersionHistory';
import { MigrationPathGraph } from '@/components/modules/core-engine/sub_save/versions/MigrationPathGraph';

afterEach(cleanup);

// The default-open row must be the version that exists; a literal 'V2.0' opens nothing.
describe('save version panels open the current version', () => {
  it('VersionHistory shows the current version changes on mount', () => {
    const { container } = render(<VersionHistory />);
    expect(container.textContent).toContain('SchemaVersion');
  });

  it('MigrationPathGraph shows the current version details on mount', () => {
    const { container } = render(<MigrationPathGraph />);
    expect(container.textContent).toContain('migration details');
  });
});
