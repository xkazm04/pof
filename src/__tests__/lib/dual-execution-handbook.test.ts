import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const doc = readFileSync(join(root, 'docs/dual-execution-program.md'), 'utf8');
const facts = JSON.parse(
  readFileSync(join(root, 'src/lib/preview/realization-facts.json'), 'utf8'),
) as {
  reviewedAt: string;
  pipelines: Record<string, { reviewedAt: string; steps: Record<string, { browser?: string; ue?: string }> }>;
};

const VERDICTS = new Set(['proven', 'probable', 'no']);

function section3(): { headingCount: number; rows: number } {
  const lines = doc.split(/\r?\n/);
  const start = lines.findIndex((l) => /^## 3\. Reviewed pipelines \(\d+\)/.test(l));
  expect(start).toBeGreaterThanOrEqual(0);
  const headingCount = Number(/\((\d+)\)/.exec(lines[start])![1]);
  let rows = 0;
  for (const l of lines.slice(start + 1)) {
    if (/^## /.test(l)) break;
    if (/^\|\s*\d+\s*\|/.test(l)) rows++;
  }
  return { headingCount, rows };
}

describe('dual-execution handbook vs realization registry', () => {
  it('§3 heading count equals the numbered pipeline rows', () => {
    const { headingCount, rows } = section3();
    expect(rows).toBe(headingCount);
  });

  it('§3 heading count equals the registry pipeline count', () => {
    expect(Object.keys(facts.pipelines).length).toBe(section3().headingCount);
  });

  it('every step of every pipeline has browser and ue verdicts', () => {
    for (const [pid, p] of Object.entries(facts.pipelines)) {
      expect(Object.keys(p.steps).length, pid).toBeGreaterThan(0);
      for (const [step, s] of Object.entries(p.steps)) {
        expect(VERDICTS.has(s.browser ?? ''), `${pid}/${step} browser`).toBe(true);
        expect(VERDICTS.has(s.ue ?? ''), `${pid}/${step} ue`).toBe(true);
      }
    }
  });
});
