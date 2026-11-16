import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

import { useMaterialStyleTransfer } from '@/components/modules/content/materials/MaterialStyleTransfer/useMaterialStyleTransfer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * acceptFile starts a FileReader per pick. Reads finishing out of order (a 9 MB PNG
 * picked first, a 200 KB JPG second) must not let the older read replace the newer
 * reference - a latest-wins token guards onload and onerror.
 */

class ControlledReader {
  static instances: ControlledReader[] = [];
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { ControlledReader.instances.push(this); }
  readAsDataURL() { /* completion is fired by the test */ }
  finish(result: string) { this.result = result; this.onload?.(); }
  fail() { this.error = new Error('read failed'); this.onerror?.(); }
}

function file(name: string) {
  return new File(['x'], name, { type: 'image/png' });
}

function setup() {
  ControlledReader.instances = [];
  vi.stubGlobal('FileReader', ControlledReader);
  const { result } = renderHook(() => useMaterialStyleTransfer(() => {}));
  act(() => result.current.handleDrop({ preventDefault() {}, dataTransfer: { files: [file('big.png')] } } as never));
  act(() => result.current.handleDrop({ preventDefault() {}, dataTransfer: { files: [file('small.png')] } } as never));
  const [big, small] = ControlledReader.instances;
  return { result, big, small };
}

describe('useMaterialStyleTransfer - a superseded file read is inert', () => {
  it('the newer pick wins when the older read finishes last', () => {
    const { result, big, small } = setup();
    act(() => small.finish('data:small'));
    act(() => big.finish('data:big'));
    expect(result.current.imageDataUrl).toBe('data:small');
  });

  it('a superseded read that fails does not report an upload error', () => {
    const { result, big, small } = setup();
    act(() => small.finish('data:small'));
    act(() => big.fail());
    expect(result.current.uploadError).toBeNull();
    expect(result.current.imageDataUrl).toBe('data:small');
  });

  it('control: a lone read still lands and a lone failure still reports', () => {
    ControlledReader.instances = [];
    vi.stubGlobal('FileReader', ControlledReader);
    const { result } = renderHook(() => useMaterialStyleTransfer(() => {}));
    act(() => result.current.handleDrop({ preventDefault() {}, dataTransfer: { files: [file('a.png')] } } as never));
    act(() => ControlledReader.instances[0].finish('data:a'));
    expect(result.current.imageDataUrl).toBe('data:a');
    act(() => result.current.handleDrop({ preventDefault() {}, dataTransfer: { files: [file('b.png')] } } as never));
    act(() => ControlledReader.instances[1].fail());
    expect(result.current.uploadError).toMatch(/could not be read/);
  });
});
