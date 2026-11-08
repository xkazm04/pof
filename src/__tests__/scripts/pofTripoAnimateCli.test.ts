// @vitest-environment node
/**
 * scripts/visual-gen/pof_tripo_animate.mjs, driven in a real child with a stubbed fetch.
 * FAKES ONLY: nothing here reaches Tripo.
 */
import { describe, it, expect } from 'vitest';
import { runVisualGenCli, type StubRule } from '@/__tests__/scripts/visualGenCliHarness';

const task = (id: string) => ({ body: { code: 0, data: { task_id: id } } });
const done = (output: unknown) => ({ body: { code: 0, data: { status: 'success', output } } });
const rules = (prerig: unknown): StubRule[] => [
  { method: 'POST', match: '/task', responses: [task('pre'), task('rig'), task('anim')] },
  { method: 'GET', match: '/task/pre', responses: [done(prerig)] },
  { method: 'GET', match: '/task/rig', responses: [done({})] },
  { method: 'GET', match: '/task/anim', responses: [done({ model: 'https://cdn.test/o.fbx' })] },
  { method: 'GET', match: 'cdn.test', responses: [{ body: 'FBX' }] },
];
const run = (args: string[], r: StubRule[] = rules({ riggable: true, rig_type: 'biped' })) =>
  runVisualGenCli('pof_tripo_animate.mjs', args, r, { TRIPO_API_KEY: 'fake' });
const OK = ['--model-task', 'm1', '--output', '{dir}/o.fbx'];

describe('pof_tripo_animate.mjs', () => {
  it('control: a riggable biped goes prerig -> rig -> anim -> file', () => {
    const r = run(OK);
    expect(r.stdout).toContain('POF_TRIPO_DONE=');
    expect(r.calls.filter((c) => c.startsWith('POST'))).toHaveLength(3);
  });

  it.each([
    ['a bare --output', ['--model-task', 'm1', '--output']],
    ['a bare --model-task', ['--output', '{dir}/o.fbx', '--model-task']],
  ])('%s is refused before any paid task', (_name, args) => {
    const r = run(args);
    expect(r.stdout).toContain('POF_TRIPO_ERROR=');
    expect(r.status).toBe(1);
    expect(r.calls).toEqual([]);
  });
});
