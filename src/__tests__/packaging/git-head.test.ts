import { describe, it, expect, vi } from 'vitest';
import { getGitHead, shortSha } from '@/lib/packaging/git-head';

describe('shortSha', () => {
  it('truncates to 8 chars by default', () => {
    expect(shortSha('abcdef1234567890')).toBe('abcdef12');
  });
  it('passes through short or empty input', () => {
    expect(shortSha('abc')).toBe('abc');
    expect(shortSha(null)).toBe('(none)');
  });
});

describe('getGitHead', () => {
  it('returns the trimmed sha from git rev-parse', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'a1b2c3d4e5f6\n', stderr: '' });
    const head = await getGitHead('C:\\proj', exec);
    expect(head).toBe('a1b2c3d4e5f6');
    expect(exec).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], expect.objectContaining({ cwd: 'C:\\proj' }));
  });

  it('returns null when the path is empty', async () => {
    const exec = vi.fn();
    expect(await getGitHead('', exec)).toBeNull();
    expect(exec).not.toHaveBeenCalled();
  });

  it('returns null when git fails (not a repo)', async () => {
    const exec = vi.fn().mockRejectedValue(new Error('fatal: not a git repository'));
    expect(await getGitHead('C:\\proj', exec)).toBeNull();
  });

  it('returns null when output is not a plausible sha', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '   \n', stderr: '' });
    expect(await getGitHead('C:\\proj', exec)).toBeNull();
  });
});
