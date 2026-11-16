import { describe, expect, it } from 'vitest';
import { parseV3TaskStatus } from '@/lib/visual-gen/tripo-runner';

describe('parseV3TaskStatus: an unreadable poll is not a verdict', () => {
  it.each([[undefined], [{ code: 2000, message: 'rate limited' }], [{ code: 0 }]])('%j is transient', (body) => {
    expect(parseV3TaskStatus(body).state).toBe('transient');
  });
});
