import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CollapsibleGroup } from '@/components/modules/core-engine/sub_world/_shared/CollapsibleGroup';
import { PlaytimeTopologyOverlay } from '@/components/modules/core-engine/sub_world/playtime/PlaytimeTopologyOverlay';
import { STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';

afterEach(cleanup);

describe('world module toggle state is exposed', () => {
  it('CollapsibleGroup reports expanded', () => {
    const { rerender } = render(<CollapsibleGroup title="G" accent="red" sectionCount={1} isOpen={false} onToggle={vi.fn()}>x</CollapsibleGroup>);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
    rerender(<CollapsibleGroup title="G" accent="red" sectionCount={1} isOpen onToggle={vi.fn()}>x</CollapsibleGroup>);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });
  it('the playtime path mode toggle reports which mode is pressed', () => {
    render(<PlaytimeTopologyOverlay mode="all" onModeChange={vi.fn()} world={STATIC_WORLD} />);
    expect(screen.getByRole('button', { name: 'All Paths' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Critical Path' }).getAttribute('aria-pressed')).toBe('false');
  });
});
