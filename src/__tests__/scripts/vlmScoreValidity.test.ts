// @vitest-environment node
/** The prompt asks for 0-10: anything else is no verdict, in both VLM entry points. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { pythonAvailable, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';
import { drive, pyStr } from '@/__tests__/scripts/visualGenQualityDriver';

function single(reply: string) {
  return drive([
    `fake_vlm(${pyStr(reply)})`,
    `run(${pyStr(scriptPath('pof_vlm_critique.py'))}, ["--render", "a.png", "--model", "m"])`,
  ].join('\n'));
}

function batch(reply: string) {
  const manifest = join(mkdtempSync(join(tmpdir(), 'pof-vlm-')), 'm.json');
  writeFileSync(manifest, JSON.stringify([{ id: 'a', file: 'a.png', subject: 's' }]));
  const r = drive([
    `fake_vlm(${pyStr(reply)})`,
    `run(${pyStr(scriptPath('pof_vlm_batch.py'))}, ["--manifest", ${pyStr(manifest)}, "--model", "m"])`,
  ].join('\n'));
  const line = r.stdout.split(/\r?\n/).find((l) => l.startsWith('POF_VLM_ITEM='));
  return JSON.parse(line?.slice('POF_VLM_ITEM='.length) ?? '{}') as { score?: number | null; error?: string };
}

const INVALID = ['SCORE=85; DEFECTS=none; VERDICT=great', 'SCORE=<0-10 integer>; DEFECTS=x; VERDICT=y', 'DEFECTS=x; VERDICT=no score given'];

describe.skipIf(!pythonAvailable)('VLM score validity', () => {
  it.each(INVALID)('critique refuses %s', (reply) => {
    const r = single(reply);
    expect(r.stdout).not.toMatch(/^POF_VLM_SCORE=/m);
    expect(r.stdout).not.toContain('POF_VLM_DONE=ok');
    expect(r.stdout).toContain('POF_VLM_ERROR=');
    expect(r.stdout).toContain('EXIT=1');
  });

  it.each(INVALID)('batch records no score for %s', (reply) => {
    const item = batch(reply);
    expect(item.score).toBeNull();
    expect(item.error).toBeTruthy();
  });

  it.each([
    ['SCORE=7; DEFECTS=x; VERDICT=y', 7],
    ['SCORE=8/10; DEFECTS=x; VERDICT=y', 8],
    ['SCORE=0; DEFECTS=x; VERDICT=y', 0],
  ])('accepts %s', (reply, want) => {
    expect(single(reply).stdout).toContain(`POF_VLM_SCORE=${want}`);
    expect(batch(reply).score).toBe(want);
  });
});
