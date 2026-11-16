import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DeriveMapsButton } from '@/components/modules/visual-gen/material-lab/DeriveMapsButton';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';
import { ok } from '@/types/result';

const derive = vi.fn(async () =>
  ok({
    filled: [{ channel: 'roughness' as const, provenance: 'heuristic' as const, method: 'inverted luminance' }],
    skipped: [],
    refused: [],
  }),
);

beforeEach(() => {
  derive.mockClear();
  useMaterialStore.setState({ deriveMapsFromAlbedo: derive, albedoTexture: '/maps/albedo.png' });
});
afterEach(() => { cleanup(); useMaterialStore.setState({ albedoTexture: null }); });

describe('DeriveMapsButton — the outcome is announced', () => {
  it('renders the report into a polite live region that exists before the click', async () => {
    render(<DeriveMapsButton />);
    // A live region only announces changes made AFTER it is in the tree.
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /derive maps from albedo/i }));
    await waitFor(() => expect(screen.queryByTestId('derive-maps-report')).not.toBeNull());
    expect(region.contains(screen.getByTestId('derive-maps-report'))).toBe(true);
  });
});
