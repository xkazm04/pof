import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useLabPipelineStore, setLabSync } from '@/components/layout-lab/labPipelineStore';

const step = (entityId: string, name: string) => useLabPipelineStore.getState().byEntity[entityId]?.[name];

describe('labPipelineStore — produce failures are recorded (Rule 4)', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); });
  afterEach(() => { setLabSync(null); });

  it('records the reason on the artifact when the write-through sink throws, and re-raises', () => {
    setLabSync(() => { throw new Error('grader exploded'); });
    expect(() => useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 10 } })).toThrow('grader exploded');
    const art = step('e1', 'Economy')!;
    expect(art.error).toBe('grader exploded');
    // The content that DID land locally is not destroyed by recording the failure.
    expect(art.data).toEqual({ price: 10 });
  });

  it('records the reason when a produceFrom build callback throws, leaving no fake artifact', () => {
    expect(() => useLabPipelineStore.getState().produceFrom('e1', 'Icon 2D Art', () => { throw new Error('no candidates'); }))
      .toThrow('no candidates');
    const art = step('e1', 'Icon 2D Art')!;
    expect(art.error).toBe('no candidates');
    expect(art.done).toBe(false);
    expect(art.data).toEqual({});
  });

  it('a failure NEVER erases a previously produced artifact', () => {
    useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 10 }, ueAssets: ['/Game/X'] });
    expect(() => useLabPipelineStore.getState().produceFrom('e1', 'Economy', () => { throw new Error('boom'); })).toThrow();
    const art = step('e1', 'Economy')!;
    expect(art.done).toBe(true);
    expect(art.data).toEqual({ price: 10 });
    expect(art.ueAssets).toEqual(['/Game/X']);
    expect(art.error).toBe('boom');
  });

  it('a later successful produce clears the recorded error', () => {
    useLabPipelineStore.getState().fail('e1', 'Economy', 'earlier failure');
    useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 3 } });
    expect(step('e1', 'Economy')!.error).toBeUndefined();
  });

  it('a non-Error throw still records a reason (never an empty message)', () => {
    expect(() => useLabPipelineStore.getState().produceFrom('e1', 'Gate', () => { throw ''; })).toThrow();
    expect(step('e1', 'Gate')!.error).toBe('Produce failed');
  });

  describe('clearError', () => {
    it('drops a failure-marker-only step entirely (back to honest unproduced)', () => {
      useLabPipelineStore.getState().fail('e1', 'Economy', 'boom');
      useLabPipelineStore.getState().clearError('e1', 'Economy');
      expect(step('e1', 'Economy')).toBeUndefined();
    });

    it('keeps produced content and only removes the error', () => {
      useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 10 } });
      useLabPipelineStore.getState().fail('e1', 'Economy', 'boom');
      useLabPipelineStore.getState().clearError('e1', 'Economy');
      const art = step('e1', 'Economy')!;
      expect(art.error).toBeUndefined();
      expect(art.data).toEqual({ price: 10 });
    });

    it('is a no-op (same state object) when there is no recorded error', () => {
      useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 10 } });
      const before = useLabPipelineStore.getState().byEntity;
      useLabPipelineStore.getState().clearError('e1', 'Economy');
      expect(useLabPipelineStore.getState().byEntity).toBe(before);
    });
  });
});
