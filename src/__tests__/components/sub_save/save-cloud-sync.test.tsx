import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CloudSyncSection } from '@/components/modules/core-engine/sub_save/advanced/CloudSyncStatus';
import { CLOUD_SYNC } from '@/components/modules/core-engine/sub_save/_shared/data-panels';

afterEach(cleanup);

describe('CloudSyncSection', () => {
  it('shows the date of the last sync, not a bare time of day', () => {
    const { container } = render(<CloudSyncSection />);
    expect(container.textContent).toContain(String(new Date(CLOUD_SYNC.lastSync).getFullYear()));
  });
});
