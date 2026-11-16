import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: () => ({ generate: () => {}, isRunning: false }),
}));

import { ScreenWorklistHeader } from '@/components/modules/core-engine/sub_ui/flow/ScreenLifecycle';
import { seedScreenEntries } from '@/lib/catalog/seed-screen-flow';

/**
 * scan-sweep night 2026-11-08 game-ui-hud: an empty (not yet loaded or never
 * seeded) screen catalog is not a finished one. 0/0 must not read as
 * "All screens verified".
 */
describe('ScreenWorklistHeader idle copy', () => {
  afterEach(cleanup);

  it('does not claim every screen is verified when the catalog is empty', () => {
    render(<ScreenWorklistHeader entries={[]} />);
    const text = screen.getByTestId('screen-worklist').textContent ?? '';
    expect(text).not.toContain('All screens verified');
    expect(text).toContain('No catalog screens');
  });

  it('still says All screens verified when every real screen is verified', () => {
    const done = seedScreenEntries().map((e) => ({ ...e, lifecycle: 'verified' as const }));
    render(<ScreenWorklistHeader entries={done} />);
    expect(screen.getByTestId('screen-worklist').textContent).toContain('All screens verified');
  });
});
