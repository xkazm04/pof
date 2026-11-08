/**
 * BlueprintInspector — the Inspect button and the Enter key are two doors into
 * one fetch, and only the button carried the disconnected / in-flight guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

const calls: { url: string; resolve: (v: unknown) => void }[] = [];
vi.mock('@/lib/api-utils', () => ({
  tryApiFetch: (url: string) => new Promise((resolve) => { calls.push({ url, resolve }); }),
}));

import { BlueprintInspector } from '@/components/modules/project-setup/BlueprintInspector';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

function bp(path: string) {
  return {
    ok: true,
    data: {
      path, parentCppClass: 'ACharacter', parentCppModule: 'Engine', parentBlueprintClass: null,
      overriddenFunctions: [], addedComponents: [], variables: [], eventGraphEntryPoints: [],
      interfaces: [], crossReferences: [], contentHash: 'abc',
    },
  };
}

function setup() {
  const view = render(<BlueprintInspector />);
  const input = view.getByTestId('blueprint-inspector-path-input') as HTMLInputElement;
  const type = (v: string) => fireEvent.change(input, { target: { value: v } });
  const enter = () => fireEvent.keyDown(input, { key: 'Enter' });
  return { view, input, type, enter };
}

beforeEach(() => {
  calls.length = 0;
  usePofBridgeStore.setState({ connectionStatus: 'connected' } as never);
});
afterEach(cleanup);

describe('BlueprintInspector — Enter honours the button guard', () => {
  it('Enter does not fetch while the bridge is disconnected', () => {
    usePofBridgeStore.setState({ connectionStatus: 'disconnected' } as never);
    const { type, enter } = setup();
    type('/Game/BP_A');
    enter();
    expect(calls).toHaveLength(0);
  });

  it('Enter does not start a second fetch while one is in flight', () => {
    const { type, enter } = setup();
    type('/Game/BP_A');
    enter();
    enter();
    expect(calls).toHaveLength(1);
  });

  it('Enter fetches when connected and idle', async () => {
    const { type, enter } = setup();
    type('/Game/BP_A');
    enter();
    expect(calls).toHaveLength(1);
    await act(async () => { calls[0].resolve(bp('/Game/BP_A')); });
  });
});
