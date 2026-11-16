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

  it('a prerigcheck that answers nothing stops before the paid rig', () => {
    const r = run(OK, rules({}));
    expect(r.stdout).toContain('POF_TRIPO_ERROR=');
    expect(r.status).toBe(1);
    expect(r.calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
  });

  it('--force-rig still overrides an unanswered prerigcheck', () => {
    const r = run([...OK, '--force-rig'], rules({}));
    expect(r.stdout).toContain('POF_TRIPO_DONE=');
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

  describe('a retarget that is already paid for can be collected', () => {
    const POLL = { POF_TRIPO_ANIM_POLL_MS: '40' };
    const stuck = (): StubRule[] => [
      { method: 'POST', match: '/task', responses: [task('pre'), task('rig'), task('anim')] },
      { method: 'GET', match: '/task/pre', responses: [done({ riggable: true, rig_type: 'biped' })] },
      { method: 'GET', match: '/task/rig', responses: [done({})] },
      { method: 'GET', match: '/task/anim', responses: [{ body: { code: 0, data: { status: 'running', progress: 10 } } }] },
    ];
    const runEnv = (args: string[], r: StubRule[]) =>
      runVisualGenCli('pof_tripo_animate.mjs', args, r, { TRIPO_API_KEY: 'fake', ...POLL });
    const resumeFlags = (stdout: string) => (/POF_TRIPO_RESUME=(.*)/.exec(stdout)?.[1] ?? '').trim();

    it('a poll window spent prints the resume flags', () => {
      const r = runEnv(OK, stuck());
      expect(r.stdout).toContain('POF_TRIPO_ERROR=anim timed out');
      expect(resumeFlags(r.stdout)).toContain('--anim-task anim');
    });

    it('a failed download prints the resume flags', () => {
      const r = run(OK, [...rules({ riggable: true, rig_type: 'biped' }).slice(0, 4), { method: 'GET', match: 'cdn.test', responses: [{ status: 500, body: 'x' }] }]);
      expect(r.stdout).toContain('POF_TRIPO_ERROR=download 500');
      expect(resumeFlags(r.stdout)).toContain('--anim-task anim');
    });

    it('--anim-task collects the file with 0 POST', () => {
      const r = run(['--anim-task', 'anim', '--output', '{dir}/o.fbx']);
      expect(r.stdout).toContain('POF_TRIPO_DONE=');
      expect(r.calls.filter((c) => c.startsWith('POST'))).toHaveLength(0);
    });

    it('the printed resume flags, replayed, issue 0 POST and collect the file', () => {
      const first = run(OK, [...rules({ riggable: true, rig_type: 'biped' }).slice(0, 4), { method: 'GET', match: 'cdn.test', responses: [{ status: 500, body: 'x' }] }]);
      const [head, outJson] = resumeFlags(first.stdout).split(' --output ');
      const flags = [...head.split(' '), '--output', JSON.parse(outJson) as string];
      const again = run(flags);
      expect(again.stdout).toContain('POF_TRIPO_DONE=');
      expect(again.calls.filter((c) => c.startsWith('POST'))).toHaveLength(0);
    });
  });
});
