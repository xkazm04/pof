import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { IntegrityValidator } from '@/components/modules/core-engine/sub_save/slots/IntegrityValidator';
import { VALIDATION_CHECKS } from '@/components/modules/core-engine/sub_save/_shared/data-panels';

afterEach(cleanup);

describe('IntegrityValidator rows', () => {
  it('shows every check detail without needing a pointer hover', () => {
    const { container } = render(<IntegrityValidator />);
    for (const check of VALIDATION_CHECKS) {
      const span = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === check.detail);
      expect(span, check.id).toBeTruthy();
      expect(span?.className).not.toContain('opacity-0');
    }
  });

  it('names each status for assistive tech', () => {
    const { container } = render(<IntegrityValidator />);
    const labelled = container.querySelectorAll('svg[aria-label="warn"], svg[aria-label="pass"], svg[aria-label="fail"]');
    expect(labelled.length).toBe(VALIDATION_CHECKS.length);
  });
});
