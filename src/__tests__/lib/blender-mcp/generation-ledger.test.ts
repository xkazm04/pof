/**
 * The Blender-MCP generation ledger — server custody of paid, in-flight provider jobs.
 *
 * A Hyper3D / Hunyuan3D generation is paid at submit and runs for minutes. Before this
 * ledger the provider's job id lived ONLY on the browser's in-memory forge job, so a page
 * reload lost it and the only recovery (Retry) paid again. The ledger remembers the ids the
 * server already needs (`pollJobStatus` / `importGeneratedAsset` take nothing else), and its
 * `ownerEpoch` is the restart oracle: an in-process store that forgets on restart must SAY
 * it restarted rather than read as "nothing in flight".
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ledger, resetLedgerForTest } from '@/lib/blender-mcp/generation-ledger';

beforeEach(() => resetLedgerForTest());

describe('generation ledger', () => {
  it('lists a recorded job as resumable, generating, with a per-process ownerEpoch', () => {
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'crate' });
    const list = ledger.listResumable();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ jobId: 'j1', provider: 'hyper3d', prompt: 'crate', state: 'generating' });
    expect(typeof list[0].createdAt).toBe('number');

    const epoch = ledger.ownerEpoch;
    expect(typeof epoch).toBe('string');
    expect(epoch.length).toBeGreaterThan(0);
    resetLedgerForTest();
    expect(ledger.ownerEpoch).not.toBe(epoch);
    // and a fresh process remembers nothing — which is exactly why the epoch exists
    expect(ledger.listResumable()).toEqual([]);
  });

  it('drops failed and imported jobs from the resumable list, keeps completed-not-imported', () => {
    ledger.record({ jobId: 'a', provider: 'hyper3d', prompt: 'a' });
    ledger.record({ jobId: 'b', provider: 'hunyuan3d', prompt: 'b' });
    ledger.record({ jobId: 'c', provider: 'hyper3d', prompt: 'c' });
    ledger.markState('a', 'failed');
    ledger.markImported('b', 'hunyuan3d', 'Barrel');
    ledger.markState('c', 'completed');
    expect(ledger.listResumable().map((e) => e.jobId)).toEqual(['c']);
    expect(ledger.get('b')).toMatchObject({ state: 'imported', objectName: 'Barrel' });
  });

  it('never regresses an imported job back to completed on a late status poll', () => {
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'crate' });
    ledger.markImported('j1', 'hyper3d', 'Crate');
    ledger.markState('j1', 'completed');
    expect(ledger.get('j1')?.state).toBe('imported');
  });

  it('ignores state updates for a job it never recorded', () => {
    ledger.markState('ghost', 'completed');
    expect(ledger.get('ghost')).toBeUndefined();
  });
});
