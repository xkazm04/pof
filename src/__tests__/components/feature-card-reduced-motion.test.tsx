import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FeatureCard } from '@/components/shared/FeatureCard';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/**
 * Reduced-motion policy guard: scale-transform hovers must be gated behind the
 * Tailwind `motion-safe:` variant so motion-sensitive users get no size jump,
 * while the non-motion feedback (brightness) stays for everyone. CSS media-query
 * variants can't be exercised behaviorally in jsdom, so we assert the class
 * contract that encodes the policy.
 */
describe('FeatureCard honors prefers-reduced-motion', () => {
  function renderCard() {
    render(<FeatureCard name="Dash" active onToggle={() => {}} accent="#00ff88" />);
    return screen.getByRole('button', { name: /Dash/ });
  }

  it('gates the hover/active scale behind motion-safe:', () => {
    const cls = renderCard().className;
    expect(cls).toContain('motion-safe:hover:scale-[1.02]');
    expect(cls).toContain('motion-safe:active:scale-[0.98]');
  });

  it('never applies an ungated scale that would jump for reduced-motion users', () => {
    const cls = renderCard().className;
    // No bare `hover:scale-`/`active:scale-` token (only the motion-safe-prefixed ones).
    expect(/(^|\s)hover:scale-/.test(cls)).toBe(false);
    expect(/(^|\s)active:scale-/.test(cls)).toBe(false);
  });

  it('keeps a non-motion hover feedback (brightness) for all users', () => {
    expect(renderCard().className).toContain('hover:brightness-110');
  });
});
