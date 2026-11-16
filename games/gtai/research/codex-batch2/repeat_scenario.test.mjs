import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstError, repeat } from './repeat_scenario.mjs';

const seq = (runs) => { let i = 0; return async () => runs[i++]; };
const fail = (msg) => ({ code: 1, out: `[INFO] x\nERROR: ${msg}\n   at: where (a.cpp:1)\n` });
const ok = { code: 0, out: '[INFO] fine\n' };

test('firstError finds the first engine or script error line', () => {
  assert.equal(firstError('a\nERROR: one\nERROR: two\n'), 'one');
  assert.equal(firstError('SCRIPT ERROR: bad call\r\n'), 'bad call');
  assert.equal(firstError('all good\n'), null);
});

test('counts passes and failures over n runs', async () => {
  const r = await repeat({ n: 3, run: seq([ok, fail('x'), ok]) });
  assert.equal(r.runs, 3);
  assert.equal(r.failed, 1);
  assert.equal(r.passed, 2);
});

test('groups failures by their first error', async () => {
  const r = await repeat({ n: 3, run: seq([fail('a'), fail('b'), fail('a')]) });
  assert.deepEqual(r.errors, [{ error: 'a', count: 2 }, { error: 'b', count: 1 }]);
});

test('a nonzero exit with no error line still counts, under a stable label', async () => {
  const r = await repeat({ n: 1, run: seq([{ code: 139, out: 'crash' }]) });
  assert.equal(r.failed, 1);
  assert.match(r.errors[0].error, /139/);
});

test('stopOnFail ends at the first failure', async () => {
  let calls = 0;
  const r = await repeat({ n: 5, stopOnFail: true, run: async () => { calls += 1; return calls === 2 ? fail('x') : ok; } });
  assert.equal(calls, 2);
  assert.equal(r.runs, 2);
});

test('n below one is refused', async () => {
  await assert.rejects(() => repeat({ n: 0, run: seq([]) }), RangeError);
});
