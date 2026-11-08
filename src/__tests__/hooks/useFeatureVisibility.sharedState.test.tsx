/**
 * One visibility state per module: a toggle made through one hook instance (the
 * Feature Map) reaches every already-mounted reader (each VisibleSection), and so
 * does a write made by another browser tab (storage event).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';
import { VisibleSection } from '@/components/modules/core-engine/unique-tabs/VisibleSection';

const KEY = 'pof-feature-vis-arpg-combat';

beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

function MapToggler() {
  const v = useFeatureVisibility('arpg-combat');
  return <button data-testid="map-toggle" onClick={() => v.toggle('dps')}>toggle</button>;
}

function Tree() {
  return (
    <>
      <MapToggler />
      <VisibleSection moduleId="arpg-combat" sectionId={'dps' as never}>
        <span data-testid="dps-body">body</span>
      </VisibleSection>
    </>
  );
}

describe('useFeatureVisibility - shared per-module state', () => {
  it('a toggle from the map unmounts a co-mounted VisibleSection', () => {
    const { container } = render(<Tree />);
    expect(container.querySelector('[data-testid="dps-body"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-testid="map-toggle"]')!);

    expect(container.querySelector('[data-testid="dps-body"]')).toBeNull();
  });

  it('a write from another browser tab reaches mounted readers', () => {
    const { container } = render(<Tree />);
    expect(container.querySelector('[data-testid="dps-body"]')).not.toBeNull();

    act(() => {
      localStorage.setItem(KEY, JSON.stringify({ dps: false }));
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect(container.querySelector('[data-testid="dps-body"]')).toBeNull();
  });
});
