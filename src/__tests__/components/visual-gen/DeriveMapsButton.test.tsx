/**
 * The derive button is inert without an albedo, runs only on click, and its
 * report names every slot's fate — the metallic refusal is a named absence.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DeriveMapsButton } from '@/components/modules/visual-gen/material-lab/DeriveMapsButton';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';
import { ok } from '@/types/result';

const derive = vi.fn(async () =>
  ok({
    filled: [{ channel: 'roughness' as const, provenance: 'heuristic' as const, method: 'inverted luminance' }],
    skipped: [{ channel: 'normal' as const, reason: 'a normal map is already loaded' }],
    refused: [{ channel: 'metallic' as const, reason: 'albedo carries no metalness signal' }],
  }),
);

beforeEach(() => {
  derive.mockClear();
  useMaterialStore.getState().reset();
  useMaterialStore.setState({ deriveMapsFromAlbedo: derive });
});
afterEach(() => cleanup());

describe('DeriveMapsButton', () => {
  it('is disabled without an albedo and never runs on its own', () => {
    render(<DeriveMapsButton />);
    expect((screen.getByRole('button', { name: /derive maps from albedo/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(derive).not.toHaveBeenCalled();
  });

  it('on click reports filled, skipped and refused channels', async () => {
    useMaterialStore.setState({ albedoTexture: 'blob:alb' });
    render(<DeriveMapsButton />);
    expect(derive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /derive maps from albedo/i }));
    await waitFor(() => expect(screen.queryByTestId('derive-maps-report')).not.toBeNull());
    expect(derive).toHaveBeenCalledTimes(1);
    const report = screen.getByTestId('derive-maps-report').textContent ?? '';
    expect(report).toMatch(/Filled roughness \(heuristic/);
    expect(report).toMatch(/Skipped normal/);
    expect(report).toMatch(/Not derived: metallic.*no metalness signal/);
  });
});
