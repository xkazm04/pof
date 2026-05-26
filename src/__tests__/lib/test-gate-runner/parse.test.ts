import { describe, it, expect } from 'vitest';
import { parseTestName } from '@/lib/test-gate-runner/parse';

describe('parseTestName', () => {
  it('recovers the test name from a runtimeDeferred reason', () => {
    expect(parseTestName('live-UE runner not yet run: VSItemsDefinitionsTest')).toBe('VSItemsDefinitionsTest');
  });
  it('trims surrounding whitespace', () => {
    expect(parseTestName('live-UE runner not yet run:   VSFooTest  ')).toBe('VSFooTest');
  });
  it('returns null when the prefix is absent', () => {
    expect(parseTestName('RHI+Gemini visual check not yet run')).toBeNull();
    expect(parseTestName('some other reason')).toBeNull();
  });
  it('returns null for empty/undefined', () => {
    expect(parseTestName(undefined)).toBeNull();
    expect(parseTestName('live-UE runner not yet run:')).toBeNull();
  });
});
