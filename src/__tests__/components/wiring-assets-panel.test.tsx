import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WiringAssetsPanel } from '@/components/modules/shared/WiringAssetsPanel';
import type { WiringAsset } from '@/lib/feature-definitions';

afterEach(() => cleanup());

const assets: WiringAsset[] = [
  { name: 'WBP_ARPGHUD', kind: 'WidgetBlueprint', note: 'UMG widget bound via BindWidget' },
  { name: 'DT_LootTable', kind: 'DataTable', note: 'Weighted loot entries' },
];

describe('WiringAssetsPanel', () => {
  it('renders a row per asset with name, kind, and note', () => {
    render(<WiringAssetsPanel assets={assets} />);
    expect(screen.getByText('WBP_ARPGHUD')).toBeTruthy();
    expect(screen.getByText('WidgetBlueprint')).toBeTruthy();
    expect(screen.getByText('UMG widget bound via BindWidget')).toBeTruthy();
    expect(screen.getByText('DT_LootTable')).toBeTruthy();
  });

  it('renders nothing when there are no assets', () => {
    const { container } = render(<WiringAssetsPanel assets={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
