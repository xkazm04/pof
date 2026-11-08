import { describe, expect, it } from 'vitest';
import { parseArdyOutput } from '@/lib/visual-gen/ardy-runner';

describe('parseArdyOutput names a module-qualified exception', () => {
  it('reports torch.cuda.OutOfMemoryError by name', () => {
    const out = 'Traceback (most recent call last):\n  File "x.py", line 1\ntorch.cuda.OutOfMemoryError: CUDA out of memory.';
    expect(parseArdyOutput(out).error).toBe('torch.cuda.OutOfMemoryError: CUDA out of memory.');
  });

  it('still reads a bare exception', () => {
    expect(parseArdyOutput('Traceback (most recent call last):\nValueError: bad').error).toBe('ValueError: bad');
  });
});
