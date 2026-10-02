/**
 * Test-only builder for `.npz` archives in the exact byte shape numpy writes — built
 * INDEPENDENTLY of `@/lib/motion-gate/npz` so the reader is checked against the format,
 * not against itself.
 *
 * numpy's `_savez` opens every member with `zipf.open(name, 'w', force_zip64=True)`
 * (gh-10776). On a seekable file, Python's zipfile then rewrites each LOCAL header with
 * compressed/uncompressed size = 0xFFFFFFFF plus a ZIP64 extra field (id 0x0001) holding
 * the real sizes; the CENTRAL DIRECTORY keeps the true 32-bit sizes and no extra field.
 * A reader that walks local headers on their 32-bit sizes, or that skips the local extra
 * using the central directory's (empty) extra length, fails on every real np.savez file —
 * this builder reproduces both traps. `dataDescriptor: true` writes the non-seekable shape
 * (flag bit 3, zero local sizes/crc, sizes after the data) for the same reason.
 */
import { crc32, deflateRawSync } from 'node:zlib';

export interface NpyMember {
  /** Member name WITHOUT `.npy`. */
  name: string;
  /** numpy descr as written, e.g. `<f4`, `<i8`, `<U12`, `|O`. */
  descr: string;
  shape: number[];
  /** Element values in C order (strings for `<U`). Ignored when `raw` is given. */
  values?: Array<number | string | boolean>;
  /** Pre-encoded payload (e.g. pickle bytes for an `|O` member). */
  raw?: Uint8Array;
  fortranOrder?: boolean;
  /** npy format major version (1 = u16 header length, 2/3 = u32). */
  npyVersion?: 1 | 2 | 3;
}

export interface NpzBuildOptions {
  method?: 'stored' | 'deflate';
  /** Write the streaming (non-seekable) shape: sizes in a trailing data descriptor. */
  dataDescriptor?: boolean;
}

function shapeLiteral(shape: number[]): string {
  if (shape.length === 0) return '()';
  if (shape.length === 1) return `(${shape[0]},)`;
  return `(${shape.join(', ')})`;
}

function encodeValues(m: NpyMember): Uint8Array {
  if (m.raw) return m.raw;
  const v = m.values ?? [];
  const kind = m.descr.slice(1);
  if (kind === 'f4') return new Uint8Array(Float32Array.from(v as number[]).buffer);
  if (kind === 'f8') return new Uint8Array(Float64Array.from(v as number[]).buffer);
  if (kind === 'i4') return new Uint8Array(Int32Array.from(v as number[]).buffer);
  if (kind === 'i8') return new Uint8Array(BigInt64Array.from((v as number[]).map((n) => BigInt(n))).buffer);
  if (kind === 'b1') return Uint8Array.from((v as boolean[]).map((b) => (b ? 1 : 0)));
  if (kind.startsWith('U')) {
    const n = Number(kind.slice(1));
    const out = new Uint8Array(v.length * n * 4);
    const dv = new DataView(out.buffer);
    (v as string[]).forEach((s, i) => {
      const cps = Array.from(s);
      cps.forEach((c, j) => dv.setUint32((i * n + j) * 4, c.codePointAt(0)!, true));
    });
    return out;
  }
  throw new Error(`fixture cannot encode descr ${m.descr}`);
}

/** One `.npy` file: magic, version, padded header dict, payload. */
export function buildNpy(m: NpyMember): Uint8Array {
  const version = m.npyVersion ?? 1;
  const dict = `{'descr': '${m.descr}', 'fortran_order': ${m.fortranOrder ? 'True' : 'False'}, 'shape': ${shapeLiteral(m.shape)}, }`;
  const prefix = version === 1 ? 10 : 12;
  let header = dict;
  while ((prefix + header.length + 1) % 64 !== 0) header += ' ';
  header += '\n';
  const head = new Uint8Array(prefix + header.length);
  head.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, version, 0]);
  const dv = new DataView(head.buffer);
  if (version === 1) dv.setUint16(8, header.length, true);
  else dv.setUint32(8, header.length, true);
  head.set(Buffer.from(header, 'latin1'), prefix);
  return Buffer.concat([head, encodeValues(m)]);
}

/** A whole `.npz` in numpy's force_zip64 member shape. */
export function buildNpz(members: NpyMember[], opts: NpzBuildOptions = {}): Buffer {
  const method = opts.method === 'deflate' ? 8 : 0;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const m of members) {
    const name = Buffer.from(`${m.name}.npy`, 'utf8');
    const npy = buildNpy(m);
    const body = method === 8 ? deflateRawSync(npy) : Buffer.from(npy);
    const crc = crc32(npy) >>> 0;
    const dd = opts.dataDescriptor === true;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(45, 4); // version needed: ZIP64
    local.writeUInt16LE(dd ? 0x0008 : 0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(dd ? 0 : crc, 14);
    local.writeUInt32LE(dd ? 0 : 0xffffffff, 18); // compressed size -> in ZIP64 extra
    local.writeUInt32LE(dd ? 0 : 0xffffffff, 22); // uncompressed size -> in ZIP64 extra
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(20, 28);
    const extra = Buffer.alloc(20);
    extra.writeUInt16LE(0x0001, 0);
    extra.writeUInt16LE(16, 2);
    extra.writeBigUInt64LE(BigInt(dd ? 0 : npy.length), 4);
    extra.writeBigUInt64LE(BigInt(dd ? 0 : body.length), 12);
    const parts = [local, name, extra, body];
    if (dd) {
      const desc = Buffer.alloc(24);
      desc.writeUInt32LE(0x08074b50, 0);
      desc.writeUInt32LE(crc, 4);
      desc.writeBigUInt64LE(BigInt(body.length), 8);
      desc.writeBigUInt64LE(BigInt(npy.length), 16);
      parts.push(desc);
    }
    const localAll = Buffer.concat(parts);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(45, 4);
    central.writeUInt16LE(45, 6);
    central.writeUInt16LE(dd ? 0x0008 : 0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20); // TRUE sizes live only here
    central.writeUInt32LE(npy.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // no extra: differs from the local header's 20 bytes
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));

    locals.push(localAll);
    offset += localAll.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(members.length, 8);
  eocd.writeUInt16LE(members.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

/**
 * A motion clip as ARDY/np.savez writes it: `posed_joints` [T,J,3] and `root_positions`
 * [T,3] in metres (float32), `fps` int64 scalar, plus optional contract members.
 */
export interface ClipSpec {
  joints: number[][][];
  root?: number[][];
  fps?: number;
  skeleton?: string;
  appliedOps?: string[];
  omit?: string[];
}

export function buildClipNpz(spec: ClipSpec, opts: NpzBuildOptions = {}): Buffer {
  const T = spec.joints.length;
  const J = T > 0 ? spec.joints[0].length : 0;
  const members: NpyMember[] = [
    { name: 'posed_joints', descr: '<f4', shape: [T, J, 3], values: spec.joints.flat(2) },
  ];
  if (spec.root) members.push({ name: 'root_positions', descr: '<f4', shape: [T, 3], values: spec.root.flat() });
  members.push({ name: 'fps', descr: '<i8', shape: [], values: [spec.fps ?? 30] });
  if (spec.skeleton !== undefined) {
    members.push({ name: 'skeleton', descr: `<U${Math.max(1, spec.skeleton.length)}`, shape: [], values: [spec.skeleton] });
  }
  if (spec.appliedOps) {
    const n = Math.max(1, ...spec.appliedOps.map((s) => s.length));
    members.push({ name: 'applied_ops', descr: `<U${n}`, shape: [spec.appliedOps.length], values: spec.appliedOps });
  }
  return buildNpz(members.filter((m) => !(spec.omit ?? []).includes(m.name)), opts);
}

/**
 * A synthetic loop: `T` frames of `J` joints; every joint of the LAST frame sits `gapM`
 * metres further along x than frame 0 (root-relative), and the root travels `travelM`
 * along x across the clip, carrying the joints with it.
 */
export function seamClip(T: number, J: number, gapM: number, travelM = 0): { joints: number[][][]; root: number[][] } {
  const joints: number[][][] = [];
  const root: number[][] = [];
  for (let t = 0; t < T; t++) {
    const rx = T > 1 ? (travelM * t) / (T - 1) : 0;
    root.push([rx, 0.875, 0]);
    const pose: number[][] = [];
    for (let j = 0; j < J; j++) {
      const base = [0.0625 * (j % 4), 0.875 + 0.03125 * j, 0.015625 * (j % 3)];
      const seam = t === T - 1 ? gapM : 0;
      pose.push([rx + base[0] + seam, base[1], base[2]]);
    }
    joints.push(pose);
  }
  return { joints, root };
}
