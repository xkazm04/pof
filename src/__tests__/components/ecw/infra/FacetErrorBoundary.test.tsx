import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FacetErrorBoundary } from '@/components/ecw/infra/FacetErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('FacetErrorBoundary', () => {
  afterEach(cleanup);

  it('renders children when they do not throw', () => {
    render(
      <FacetErrorBoundary facetLabel="Detail">
        <div>healthy facet</div>
      </FacetErrorBoundary>,
    );
    expect(screen.getByText('healthy facet')).toBeTruthy();
  });

  it('shows an inline fallback (not a crash) when a facet throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <FacetErrorBoundary facetLabel="Broken">
        <Boom />
      </FacetErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/failed to render/i)).toBeTruthy();
    expect(screen.getByText(/kaboom/)).toBeTruthy();
    spy.mockRestore();
  });
});
