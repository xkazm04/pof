// @vitest-environment node
/** A batch gate must not finish "ok" over nothing, or lose its tail to one failed item. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { pythonAvailable, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';
import { drive, pyStr } from '@/__tests__/scripts/visualGenQualityDriver';

function batch(manifest: unknown, setup: string[] = []) {
  const file = join(mkdtempSync(join(tmpdir(), 'pof-vlm-')), 'm.json');
  writeFileSync(file, JSON.stringify(manifest));
  return drive([
    'model, auto = fake_vlm("SCORE=6; DEFECTS=x; VERDICT=y")',
    ...setup,
    `run(${pyStr(scriptPath('pof_vlm_batch.py'))}, ["--manifest", ${pyStr(file)}, "--model", "m"])`,
    'print("LOADS=%d" % auto.from_pretrained.call_count)',
  ].join('\n'));
}

describe.skipIf(!pythonAvailable)('pof_vlm_batch manifest', () => {
  it.each([[[]], [{ id: 'a' }], [[{ id: 'a', file: 'a.png' }]]])('refuses %j before loading the model', (manifest) => {
    const r = batch(manifest);
    expect(r.stdout).not.toContain('POF_VLM_BATCH_DONE=ok');
    expect(r.stdout).toContain('POF_VLM_BATCH_ERROR=');
    expect(r.stdout).toContain('LOADS=0');
  });

  it('one failed inference costs that item, not the rest of the batch', () => {
    const r = batch(
      [{ id: 'a', file: 'a.png', subject: 's' }, { id: 'b', file: 'b.png', subject: 's' }],
      ['model.generate.side_effect = [RuntimeError("CUDA out of memory"), m.MagicMock()]'],
    );
    const items = r.stdout.split(/\r?\n/)
      .filter((l) => l.startsWith('POF_VLM_ITEM='))
      .map((l) => JSON.parse(l.slice('POF_VLM_ITEM='.length)) as { id: string; score: number | null; error?: string });
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(items[0].score).toBeNull();
    expect(items[0].error).toContain('CUDA');
    expect(items[1].score).toBe(6);
  });
});
