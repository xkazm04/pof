import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DRCodeGenerator } from '@/components/modules/core-engine/sub_progression/_internals/DRCodeGenerator';
import { XpTableGenerator } from '@/components/modules/core-engine/sub_progression/_internals/XpTableGenerator';
import { DR_CONFIGS } from '@/components/modules/core-engine/sub_progression/_shared/diminishingReturns';

afterEach(cleanup);

const unnamed = (root: HTMLElement) =>
  [...root.querySelectorAll('input[type="number"]')].filter((i) => !i.getAttribute('aria-label')).length;

describe('generator number inputs have accessible names', () => {
  it('DRCodeGenerator names each per-attribute field', () => {
    const { container } = render(<DRCodeGenerator configs={DR_CONFIGS} onConfigsChange={() => {}} />);
    expect(container.querySelectorAll('input[type="number"]').length).toBe(9);
    expect(unnamed(container)).toBe(0);
    expect(container.querySelector('input[aria-label="Strength soft cap"]')).toBeTruthy();
  });

  it('XpTableGenerator names each per-level field', () => {
    const { container } = render(<XpTableGenerator baseXp={100} curveExp={1.5} />);
    expect(container.querySelectorAll('input[type="number"]').length).toBe(3);
    expect(unnamed(container)).toBe(0);
  });
});
