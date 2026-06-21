import { describe, it, expect } from 'vitest';
import { POF_READY_TESTID, pofNotDetectedMessage } from './pof-identity';

describe('pofNotDetectedMessage', () => {
  it('is actionable: names the URL, timeout, the marker, the likely cause, and the fix', () => {
    const m = pofNotDetectedMessage('http://localhost:3000', 90_000);
    expect(m).toContain('http://localhost:3000');
    expect(m).toContain('90000');
    expect(m).toContain(POF_READY_TESTID);
    expect(m).toMatch(/non-pof/i);
    expect(m).toContain('PLAYWRIGHT_PORT');
  });
});
