/**
 * Asset Inventory leaf components (models-asset-inventory, night 2026-11-08).
 *
 * BridgeManifestCard: "Last updated" rendered toLocaleTimeString() only, so a
 * manifest generated days ago read as if it were written today.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BridgeManifestCard } from '@/components/modules/content/models/AssetInventory/BridgeManifestCard';

afterEach(cleanup);

const SUMMARY = {
  blueprints: 1, materials: 2, animations: 0, dataTables: 1, other: 0,
  total: 4, checksum: 'a3f2c91d', generatedAt: '2026-02-21T14:30:22Z',
};

describe('BridgeManifestCard last-updated stamp', () => {
  it('names the day the manifest was generated, not only a time of day', () => {
    const { container } = render(<BridgeManifestCard summary={SUMMARY} />);
    const day = new Date(SUMMARY.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    expect(container.textContent).toContain(`Last updated ${day}`);
  });

  it('[guard] an unparseable stamp says unknown, never "Invalid Date"', () => {
    const { container } = render(<BridgeManifestCard summary={{ ...SUMMARY, generatedAt: 'not-a-date' }} />);
    expect(container.textContent).not.toContain('Invalid Date');
    expect(container.textContent).toContain('Last updated unknown');
  });
});
