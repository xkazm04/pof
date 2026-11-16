/**
 * SyncDot and SyncStatusPanel must give one verdict for "what is this document's
 * sync state": the dot consumes `resolveSyncPresentation`, it does not re-implement
 * the "synced without a hash is Never checked" rule.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SyncDot } from '@/components/modules/content/level-design/LevelDesignView/SyncDot';
import { resolveSyncPresentation } from '@/components/modules/content/level-design/SyncStatusPanel';
import type { SyncStatus } from '@/types/level-design';

afterEach(cleanup);

const STATUSES: SyncStatus[] = ['synced', 'doc-ahead', 'code-ahead', 'diverged', 'unlinked'];

describe('SyncDot label === resolveSyncPresentation label', () => {
  for (const status of STATUSES) {
    for (const hash of [null, 'abc123']) {
      it(`${status} / ${hash === null ? 'no hash' : 'hash'}`, () => {
        const { container } = render(<SyncDot status={status} lastCodeHash={hash} />);
        const label = container.querySelector('[role="img"]')?.getAttribute('aria-label');
        expect(label).toBe(`Sync status: ${resolveSyncPresentation(status, hash).label}`);
      });
    }
  }
});
