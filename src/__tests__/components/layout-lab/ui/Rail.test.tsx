import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Rail } from '@/components/layout-lab/ui/Rail';

afterEach(cleanup);

describe('Rail', () => {
  it('is a complementary landmark NAMED by its visible title', () => {
    render(<Rail title="Catalogs"><p>body</p></Rail>);
    expect(screen.getByRole('complementary', { name: 'Catalogs' })).toBeTruthy();
  });
  it('two rails side by side are distinguishable landmarks (Baseline: Catalogs + Pipeline)', () => {
    render(<><Rail title="Catalogs"><p>a</p></Rail><Rail title="Pipeline · 2/5"><p>b</p></Rail></>);
    const names = screen.getAllByRole('complementary').map((el) => el.getAttribute('aria-labelledby'));
    expect(new Set(names).size).toBe(2);
    expect(screen.getByRole('complementary', { name: 'Pipeline · 2/5' })).toBeTruthy();
  });
  it('a dynamic title stays the name', () => {
    const { rerender } = render(<Rail title="Generated"><p>x</p></Rail>);
    rerender(<Rail title="Generated (3)"><p>x</p></Rail>);
    expect(screen.getByRole('complementary', { name: 'Generated (3)' })).toBeTruthy();
  });
});
