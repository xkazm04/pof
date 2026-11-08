import { StrictMode } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const animateSpy = vi.hoisted(() => vi.fn(() => ({ stop: () => {} })));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, animate: animateSpy, useReducedMotion: () => false };
});

import { RipplePulse } from '@/components/modules/core-engine/sub_world/_shared/RipplePulse';

afterEach(() => { cleanup(); animateSpy.mockClear(); });

const tree = (trigger: string) => (
  <StrictMode><RipplePulse trigger={trigger} color="red"><div /></RipplePulse></StrictMode>
);

describe('RipplePulse under StrictMode', () => {
  it('does not pulse on mount', () => {
    render(tree('a'));
    expect(animateSpy).not.toHaveBeenCalled();
  });
  it('[control] pulses when the trigger changes', () => {
    const { rerender } = render(tree('a'));
    rerender(tree('b'));
    expect(animateSpy).toHaveBeenCalled();
  });
});
