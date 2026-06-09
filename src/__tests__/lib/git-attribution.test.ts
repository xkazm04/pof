import { describe, it, expect } from 'vitest';
import { parseAttributionLog, ATTRIBUTION_FORMAT } from '@/lib/evaluator/git-attribution';

const SEP = '\x1f';
const line = (hash: string, subject: string, author: string, date: string) =>
  [hash, subject, author, date].join(SEP);

describe('parseAttributionLog', () => {
  it('parses git log records into commit attributions', () => {
    const stdout = [
      line('abc1234', 'Fix null deref in combat', 'Ada', '2026-06-01T10:00:00+00:00'),
      line('def5678', 'Refactor loot tables', 'Linus', '2026-05-20T09:00:00+00:00'),
    ].join('\n');

    const commits = parseAttributionLog(stdout);

    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({
      hash: 'abc1234',
      subject: 'Fix null deref in combat',
      author: 'Ada',
      date: '2026-06-01T10:00:00+00:00',
    });
    expect(commits[1].hash).toBe('def5678');
  });

  it('returns an empty array for empty output', () => {
    expect(parseAttributionLog('')).toEqual([]);
    expect(parseAttributionLog('\n  \n')).toEqual([]);
  });

  it('keeps subjects that contain pipe characters (uses a unit-separator delimiter)', () => {
    const stdout = line('aaa1111', 'feat: add A|B test toggle', 'Grace', '2026-06-02T00:00:00Z');
    const commits = parseAttributionLog(stdout);
    expect(commits).toHaveLength(1);
    expect(commits[0].subject).toBe('feat: add A|B test toggle');
  });

  it('skips malformed records missing fields', () => {
    const stdout = ['just-a-hash', line('bbb2222', 'ok', 'Dev', '2026-06-03T00:00:00Z')].join('\n');
    const commits = parseAttributionLog(stdout);
    expect(commits).toHaveLength(1);
    expect(commits[0].hash).toBe('bbb2222');
  });

  it('exposes a pretty-format string that uses %x1f field separators', () => {
    expect(ATTRIBUTION_FORMAT).toContain('%x1f');
    expect(ATTRIBUTION_FORMAT).toContain('%h');
    expect(ATTRIBUTION_FORMAT).toContain('%s');
  });
});
