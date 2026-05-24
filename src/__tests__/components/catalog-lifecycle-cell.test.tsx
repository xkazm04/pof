import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';

afterEach(cleanup);

describe('CatalogLifecycleCell', () => {
  it('renders the lifecycle label and asset count', () => {
    const { getByText } = render(<CatalogLifecycleCell lifecycle="generated" ueAssetCount={3} />);
    expect(getByText(/generated/i)).toBeTruthy();
    expect(getByText(/3 assets/i)).toBeTruthy();
  });
  it('shows no regenerate button when onRegenerate is omitted', () => {
    const { queryByText } = render(<CatalogLifecycleCell lifecycle="planned" ueAssetCount={0} />);
    expect(queryByText(/generate/i)).toBeNull();
  });
  it('fires onRegenerate when the button is clicked', () => {
    const onRegen = vi.fn();
    const { getByText } = render(
      <CatalogLifecycleCell lifecycle="planned" ueAssetCount={0} onRegenerate={onRegen} />,
    );
    fireEvent.click(getByText(/generate/i));
    expect(onRegen).toHaveBeenCalledTimes(1);
  });
});
