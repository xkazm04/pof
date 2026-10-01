// @vitest-environment node
/**
 * readNpz — the in-process `.npz` reader the Tier-1 gate measures clips with.
 *
 * The archives are built by `@/__tests__/fixtures/npz` in numpy's real member shape
 * (force_zip64: local sizes 0xFFFFFFFF + a ZIP64 extra; true sizes only in the central
 * directory), so a reader that trusts local headers fails here exactly as it would fail on
 * every real ARDY / np.savez file.
 */
import { describe, it, expect } from 'vitest';
import { readNpz } from '@/lib/motion-gate';
import { buildNpz, type NpyMember } from '@/__tests__/fixtures/npz';

const JOINTS = [0.1, 0.2, 0.3, 1.5, -2.25, 3, 0.11, 0.21, 0.31, 1.51, -2.24, 3.01, 0.12, 0.22, 0.32, 1.52, -2.23, 3.02];
const ROOT = [0, 0.9, 0, 0.05, 0.9, 0, 0.1, 0.9, 0];

const MEMBERS: NpyMember[] = [
  { name: 'posed_joints', descr: '<f4', shape: [3, 2, 3], values: JOINTS },
  { name: 'root_positions', descr: '<f4', shape: [3, 3], values: ROOT },
  { name: 'fps', descr: '<i8', shape: [], values: [30] },
  { name: 'text', descr: '<U12', shape: [], values: ['a person run'] },
];

function expectMembers(buf: Uint8Array) {
  const r = readNpz(buf);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  const a = r.data;
  expect(a.names).toEqual(['posed_joints', 'root_positions', 'fps', 'text']);

  const pj = a.arrays.get('posed_joints')!;
  expect(pj.descr).toBe('<f4');
  expect(pj.shape).toEqual([3, 2, 3]);
  expect(Array.from(pj.data as Float32Array)).toEqual(Array.from(Float32Array.from(JOINTS)));

  const rp = a.arrays.get('root_positions')!;
  expect(rp.descr).toBe('<f4');
  expect(rp.shape).toEqual([3, 3]);
  expect(Array.from(rp.data as Float32Array)).toEqual(Array.from(Float32Array.from(ROOT)));

  const fps = a.arrays.get('fps')!;
  expect(fps.descr).toBe('<i8');
  expect(fps.shape).toEqual([]);
  expect(Array.from(fps.data as BigInt64Array)).toEqual([BigInt(30)]);

  const text = a.arrays.get('text')!;
  expect(text.descr).toBe('<U12');
  expect(text.shape).toEqual([]);
  expect(text.data).toEqual(['a person run']);
  return a;
}

describe('readNpz reads numpy archives through the central directory', () => {
  it('np.savez shape (ZIP_STORED, force_zip64 local headers) -> every member as written', () => {
    const buf = buildNpz(MEMBERS, { method: 'stored' });
    // The trap is really in the fixture: the first local header claims 0xFFFFFFFF sizes.
    expect(buf.readUInt32LE(18)).toBe(0xffffffff);
    expect(buf.readUInt32LE(22)).toBe(0xffffffff);
    expectMembers(buf);
  });

  it('np.savez_compressed shape (DEFLATE) -> identical members', () => {
    expectMembers(buildNpz(MEMBERS, { method: 'deflate' }));
  });

  it('a streamed archive (sizes in a trailing data descriptor) -> identical members', () => {
    expectMembers(buildNpz(MEMBERS, { method: 'deflate', dataDescriptor: true }));
  });

  it('reads npy v2 headers (u32 header length)', () => {
    const r = readNpz(buildNpz([{ ...MEMBERS[0], npyVersion: 2 }]));
    expect(r.ok && Array.from(r.data.arrays.get('posed_joints')!.data as Float32Array)).toEqual(
      Array.from(Float32Array.from(JOINTS)),
    );
  });
});

describe('readNpz refuses what np.load(allow_pickle=False) refuses', () => {
  it('an object (pickle) member is refused by name and dtype; nothing partial is returned', () => {
    const bad: NpyMember = { name: 'posed_joints', descr: '|O', shape: [3], raw: Uint8Array.from([0x80, 0x04, 0x95, 0x2e]) };
    const r = readNpz(buildNpz([MEMBERS[1], bad, MEMBERS[2]]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("'posed_joints'");
    expect(r.error).toContain('|O');
    expect((r as unknown as { data?: unknown }).data).toBeUndefined();
  });

  it('a fortran_order member is refused by name and order', () => {
    const r = readNpz(buildNpz([{ ...MEMBERS[0], fortranOrder: true }]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("'posed_joints'");
    expect(r.error).toMatch(/fortran_order/);
  });

  it('a big-endian member is refused rather than misread', () => {
    const r = readNpz(buildNpz([{ ...MEMBERS[0], descr: '>f4', raw: new Uint8Array(72) }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('>f4');
  });

  it('a corrupted member fails its CRC instead of returning wrong numbers', () => {
    const buf = buildNpz([MEMBERS[0]], { method: 'stored' });
    // EOCD (22) + central entry (46 + 16-byte name) sit after the payload; step 20 into it.
    buf[buf.length - 22 - 62 - 20] ^= 0xff;
    const r = readNpz(buf);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/crc/i);
  });

  it('bytes that are not a ZIP at all -> an error, never an empty archive', () => {
    const r = readNpz(Buffer.from('POF_LOOP_POSE_GAP_MM=3.2\n'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a zip|end of central directory/i);
  });
});
