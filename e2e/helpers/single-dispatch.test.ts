import { describe, it, expect, vi } from 'vitest';
import { singleDispatch, type DispatchStep } from './single-dispatch';

describe('singleDispatch', () => {
  it('registers one isolated test per step, preserving names and order', () => {
    const calls: string[] = [];
    const testFn = vi.fn((name: string) => { calls.push(name); }) as unknown as Parameters<typeof singleDispatch>[1];

    const steps: DispatchStep[] = [
      { name: 'step a', run: async () => {} },
      { name: 'step b', run: async () => {} },
      { name: 'step c', run: async () => {} },
    ];
    singleDispatch(steps, testFn);

    expect(calls).toEqual(['step a', 'step b', 'step c']);
  });

  it('passes a body that invokes the step run with the page', async () => {
    const ran: string[] = [];
    let captured: ((args: { page: unknown }) => Promise<void>) | null = null;
    const testFn = ((_name: string, body: (args: { page: unknown }) => Promise<void>) => {
      captured = body;
    }) as unknown as Parameters<typeof singleDispatch>[1];

    singleDispatch([{ name: 'only', run: async () => { ran.push('ran'); } }], testFn);
    expect(captured).not.toBeNull();
    await captured!({ page: {} });
    expect(ran).toEqual(['ran']);
  });
});
