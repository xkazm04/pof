import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  revoke = vi.fn();
  vi.stubGlobal('URL', Object.assign(Object.create(URL), URL, { revokeObjectURL: revoke }));
  useMaterialStore.setState({ albedoTexture: null, normalTexture: null, metallicTexture: null, roughnessTexture: null, aoTexture: null });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('useMaterialStore — uploaded blob URLs are released', () => {
  it('replacing an uploaded map revokes the superseded blob URL', () => {
    const { setTexture } = useMaterialStore.getState();
    setTexture('albedo', 'blob:http://x/one');
    setTexture('albedo', 'blob:http://x/two');
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:http://x/one');
  });

  it('clearing a slot revokes its blob URL', () => {
    const { setTexture } = useMaterialStore.getState();
    setTexture('normal', 'blob:http://x/n');
    setTexture('normal', null);
    expect(revoke).toHaveBeenCalledWith('blob:http://x/n');
  });

  it('reset revokes every uploaded blob URL', () => {
    const { setTexture } = useMaterialStore.getState();
    setTexture('albedo', 'blob:http://x/a');
    setTexture('ao', 'blob:http://x/ao');
    useMaterialStore.getState().reset();
    expect(revoke.mock.calls.map((c) => c[0]).sort()).toEqual(['blob:http://x/a', 'blob:http://x/ao']);
  });

  it('never revokes a served URL, nor a blob that is set again unchanged', () => {
    const { setTexture } = useMaterialStore.getState();
    setTexture('roughness', '/api/texture-maps/files/r.png');
    setTexture('roughness', null);
    setTexture('metallic', 'blob:http://x/m');
    setTexture('metallic', 'blob:http://x/m');
    expect(revoke).not.toHaveBeenCalled();
  });
});
