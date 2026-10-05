import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SoundForgePanel } from '@/components/modules/content/audio/SoundForgePanel';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

describe('SoundForgePanel — every Field control has a real accessible name', () => {
  it('Provider, Duration, Event key, Surface and Prompt resolve by label (not just Kind/Variations/Target set/Set name)', () => {
    render(<SoundForgePanel />);
    expect(screen.getByLabelText(/^provider$/i)).toBeTruthy();
    expect(screen.getByLabelText(/duration/i)).toBeTruthy();
    expect(screen.getByLabelText(/^event key$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^surface$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^prompt$/i)).toBeTruthy();
  });
});
