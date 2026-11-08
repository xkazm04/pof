// @vitest-environment node
/**
 * scripts/visual-gen/pof_leonardo.mjs, driven in a real child with a stubbed fetch.
 * FAKES ONLY: nothing here reaches Leonardo.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { runVisualGenCli, type StubRule } from '@/__tests__/scripts/visualGenCliHarness';

const ID = 'gen-123';
const complete = { body: { generations_by_pk: { status: 'COMPLETE', generated_images: [{ url: 'https://cdn.test/img.png' }] } } };
const rules = (over: Partial<Record<'poll' | 'image', StubRule['responses']>> = {}): StubRule[] => [
  { method: 'POST', match: '/v2/generations', responses: [{ body: { generate: { generationId: ID, apiCreditCost: 1 } } }] },
  { method: 'GET', match: `/generations/${ID}`, responses: over.poll ?? [complete] },
  { method: 'DELETE', match: `/generations/${ID}`, responses: [{ body: {} }] },
  { method: 'GET', match: 'cdn.test', responses: over.image ?? [{ body: 'PNGBYTES' }] },
];
const run = (r: StubRule[], args = ['--prompt', 'p', '--output', '{dir}/o.png']) =>
  runVisualGenCli('pof_leonardo.mjs', args, r, { LEONARDO_API_KEY: 'fake' });
const deletes = (calls: string[]) => calls.filter((c) => c.startsWith('DELETE'));

describe('pof_leonardo.mjs', () => {
  it('control: a good run writes the file, says DONE and deletes once', () => {
    const r = run(rules());
    expect(r.stdout).toContain('POF_LEO_DONE=');
    expect(existsSync(join(r.dir, 'o.png'))).toBe(true);
    expect(deletes(r.calls)).toHaveLength(1);
  });

  it('a refused image download is an error, not a PNG made of the error body', () => {
    const r = run(rules({ image: [{ status: 403, body: '<Error>AccessDenied</Error>' }] }));
    expect(r.stdout).not.toContain('POF_LEO_DONE=');
    expect(r.stdout).toContain('POF_LEO_ERROR=');
    expect(existsSync(join(r.dir, 'o.png'))).toBe(false);
    expect(deletes(r.calls)).toHaveLength(1);
  });

  it('one 5xx poll does not throw away a paid generation', () => {
    const r = run(rules({ poll: [{ status: 502, body: 'bad gateway' }, complete] }));
    expect(r.stdout).toContain('POF_LEO_DONE=');
    expect(deletes(r.calls)).toHaveLength(1);
  });

  it('a 4xx poll is not retried for four minutes', () => {
    const r = run(rules({ poll: [{ status: 401, body: 'nope' }] }));
    expect(r.calls.filter((c) => c.startsWith(`GET`) && c.includes(ID))).toHaveLength(1);
    expect(r.stdout).toContain('POF_LEO_ERROR=401');
    expect(deletes(r.calls)).toHaveLength(1);
  });

  it('an error exits non-zero, the same as the sibling Tripo CLI', () => {
    expect(run(rules({ image: [{ status: 500, body: 'x' }] })).status).toBe(1);
  });

  it.each([
    ['a bare --output', ['--prompt', 'p', '--output']],
    ['a bare --prompt', ['--output', '{dir}/o.png', '--prompt']],
    ['a non-numeric --width', ['--prompt', 'p', '--output', '{dir}/o.png', '--width', 'wide']],
  ])('%s is refused before anything is bought', (_name, args) => {
    const r = run(rules(), args);
    expect(r.stdout).toContain('POF_LEO_ERROR=');
    expect(r.status).toBe(1);
    expect(r.calls).toEqual([]);
  });

  it('an interrupt while polling still deletes the generation, once', () => {
    const r = run(rules({ poll: [{ emit: 'SIGINT', body: { generations_by_pk: { status: 'PENDING' } } }] }));
    expect(r.status).toBe(130);
    expect(r.stdout).toContain('POF_LEO_ERROR=interrupted');
    expect(deletes(r.calls)).toHaveLength(1);
  });
});
