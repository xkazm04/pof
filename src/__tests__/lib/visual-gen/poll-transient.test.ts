import { describe, expect, it, vi } from 'vitest';
import { pollUntilReady } from '@/lib/visual-gen/poll';

const base = {
  isDone: (s: string) => s === 'done',
  isFailed: (s: string) => s === 'failed',
  intervalMs: 0,
  onFailed: () => new Error('failed'),
  onTimeout: () => new Error('timed out'),
};

describe('pollUntilReady: a rejected status read is a transient failure', () => {
  it('keeps polling after fetchStatus rejects', async () => {
    const fetchStatus = vi.fn<() => Promise<string | undefined>>()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('done');
    await expect(pollUntilReady({ ...base, fetchStatus, maxAttempts: 3 })).resolves.toBe('done');
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });

  it('ends on the timeout, not the transport error, when every read rejects', async () => {
    const fetchStatus = vi.fn<() => Promise<string | undefined>>().mockRejectedValue(new Error('ECONNRESET'));
    await expect(pollUntilReady({ ...base, fetchStatus, maxAttempts: 2 })).rejects.toThrow('timed out');
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });
});
