import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ModuleRow } from '@/components/modules/evaluator/BatchReviewPanel/ModuleRow';
import type { ModuleProgress, ModuleReviewStatus } from '@/types/batch-review';

afterEach(cleanup);

const STATUSES: ModuleReviewStatus[] = ['pending', 'running', 'completed', 'error', 'skipped'];

function mod(status: ModuleReviewStatus, error: string | null = null): ModuleProgress {
  return {
    moduleId: 'arpg-combat', label: 'Combat', featureCount: 3, status,
    executionId: null, startedAt: null, completedAt: null, error,
  } as unknown as ModuleProgress;
}

/** A hex alpha suffix glued onto a CSS var() is not a colour — the declaration is dropped. */
const VAR_WITH_HEX_SUFFIX = /var\([^)]*\)[0-9a-f]{2}/i;

describe('BatchReview ModuleRow status badge tint', () => {
  it.each(STATUSES)('%s badge background and border are valid colours', (status) => {
    const { container } = render(<ModuleRow mod={mod(status)} />);
    const badge = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === status);
    expect(badge).toBeTruthy();
    const style = badge!.getAttribute('style') ?? '';
    expect(style).not.toMatch(VAR_WITH_HEX_SUFFIX);
  });
});
