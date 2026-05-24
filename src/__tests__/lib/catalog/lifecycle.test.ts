import { describe, it, expect } from 'vitest';
import { canTransition, resolveTransition } from '@/lib/catalog/lifecycle';

describe('canTransition', () => {
  it('allows a single forward step', () => {
    expect(canTransition('planned', 'scaffolded')).toBe(true);
    expect(canTransition('generated', 'wired')).toBe(true);
  });
  it('forbids skipping steps', () => {
    expect(canTransition('planned', 'generated')).toBe(false);
    expect(canTransition('scaffolded', 'verified')).toBe(false);
  });
  it('forbids moving backward', () => {
    expect(canTransition('wired', 'scaffolded')).toBe(false);
  });
  it('allows any state to fail', () => {
    expect(canTransition('planned', 'failed')).toBe(true);
    expect(canTransition('wired', 'failed')).toBe(true);
  });
  it('allows a failed entity to reset to planned for retry', () => {
    expect(canTransition('failed', 'planned')).toBe(true);
    expect(canTransition('failed', 'verified')).toBe(false);
  });
});

describe('resolveTransition', () => {
  it('promotes to verified only when the test passed', () => {
    expect(resolveTransition('wired', 'verified', 'pass')).toBe('verified');
    expect(resolveTransition('wired', 'verified', 'fail')).toBeNull();
    expect(resolveTransition('wired', 'verified', undefined)).toBeNull();
  });
  it('returns the next state for a legal non-verify transition', () => {
    expect(resolveTransition('planned', 'scaffolded')).toBe('scaffolded');
  });
  it('returns null for an illegal transition', () => {
    expect(resolveTransition('planned', 'verified', 'pass')).toBeNull();
  });
  it('returns failed for any-state → failed', () => {
    expect(resolveTransition('scaffolded', 'failed')).toBe('failed');
  });
});
