// @vitest-environment node
/** On Windows a piped python stdout is cp1252; a marker must survive any character. */
import { describe, it, expect } from 'vitest';
import { pythonAvailable, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';
import { drive, pyStr } from '@/__tests__/scripts/visualGenQualityDriver';

const CJK = '\\u5f62\\u72b6'; // python escapes: not encodable in cp1252

describe.skipIf(!pythonAvailable)('critique markers on a cp1252 stdout', () => {
  it('pof_vlm_critique reports a reply outside cp1252 instead of crashing after inference', () => {
    const r = drive([
      `fake_vlm("SCORE=7; DEFECTS=${CJK}; VERDICT=ok")`,
      `run(${pyStr(scriptPath('pof_vlm_critique.py'))}, ["--render", "a.png", "--model", "m"], encoding="cp1252")`,
    ].join('\n'));
    expect(r.stdout).toContain('POF_VLM_SCORE=7');
    expect(r.stdout).toContain('POF_VLM_DONE=ok');
    expect(r.stdout).toContain('EXIT=0');
  });

  it('pof_vlm_batch still prints its error marker for a manifest outside cp1252', () => {
    const r = drive([
      'fake_vlm("SCORE=7; DEFECTS=x; VERDICT=y")',
      `run(${pyStr(scriptPath('pof_vlm_batch.py'))}, ["--manifest", "missing${CJK}.json", "--model", "m"], encoding="cp1252")`,
    ].join('\n'));
    expect(r.stdout).toContain('POF_VLM_BATCH_ERROR=');
    expect(r.stdout).toContain('EXIT=1');
  });

  it('pof_mesh_critique still prints its error marker for a path outside cp1252', () => {
    const r = drive([
      'fake("numpy")',
      `def load(p, force=None): raise RuntimeError("cannot read ${CJK}")`,
      'fake("trimesh", load=load)',
      `run(${pyStr(scriptPath('pof_mesh_critique.py'))}, ["--mesh", "x.glb"], encoding="cp1252")`,
    ].join('\n'));
    expect(r.stdout).toContain('POF_CRITIQUE_ERROR=');
    expect(r.stdout).toContain('EXIT=1');
  });
});
