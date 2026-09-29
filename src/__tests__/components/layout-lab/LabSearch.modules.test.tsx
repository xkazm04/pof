import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LabSearch } from '@/components/layout-lab/LabSearch';

/**
 * The lab is where users land, and it could not reach any legacy module: 40 destinations
 * sat behind Legacy shell -> L1 category -> L2 item. Each module now has an address, and
 * lab search offers it as one hit.
 */

/** Stub `window.location` so a full-page jump is observable (jsdom will not navigate). */
function captureNavigation() {
  const real = window.location;
  const stub = { ...real, href: '' } as unknown as Location;
  Object.defineProperty(window, 'location', { value: stub, writable: true, configurable: true });
  return {
    href: () => stub.href,
    restore: () => Object.defineProperty(window, 'location', { value: real, writable: true, configurable: true }),
  };
}

let nav: ReturnType<typeof captureNavigation>;
beforeEach(() => { nav = captureNavigation(); });
afterEach(() => { nav.restore(); cleanup(); });

describe('<LabSearch /> - legacy modules are one hit away', () => {
  it('"packag" finds the Packaging module, and selecting it opens its address', () => {
    const onClose = vi.fn();
    const onSelectCatalog = vi.fn();
    const onNavigate = vi.fn();
    render(<LabSearch open onClose={onClose} currentEntityId={null} onSelectCatalog={onSelectCatalog} onNavigate={onNavigate} />);
    fireEvent.change(screen.getByTestId('lab-search-input'), { target: { value: 'packag' } });
    const hit = screen.queryAllByTestId('lab-search-option').find((o) => within(o).queryByText('module'));
    expect(hit, 'no module hit for "packag"').toBeTruthy();
    fireEvent.click(hit!);
    expect(nav.href()).toBe('/?legacy=1&module=packaging');
    expect(onClose).toHaveBeenCalled();
    expect(onSelectCatalog).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
