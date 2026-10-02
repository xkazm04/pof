/**
 * A pure-Node reader for numpy `.npz` archives (`np.savez` / `np.savez_compressed`), so the
 * Tier-1 motion gate can measure a clip in-process instead of trusting a pasted transcript
 * of `pof_loop_closure.py`'s stdout. No python, no venv, no model.
 *
 * An `.npz` is a ZIP of `.npy` members. Two format facts are load-bearing:
 *  - numpy opens every member with `force_zip64=True` (gh-10776), so each LOCAL header says
 *    0xFFFFFFFF for both sizes and carries a ZIP64 extra field; a streamed write puts the
 *    sizes in a trailing data descriptor instead. Members are therefore resolved through the
 *    CENTRAL DIRECTORY (true sizes + the local header offset), and the local header is read
 *    only for its OWN name/extra lengths to find where the payload starts.
 *  - `np.load(..., allow_pickle=False)` is the repo's rule (applied.jsonl row 4). Object
 *    (`|O`) members, Fortran-ordered and big-endian arrays are refused BY NAME; a refusal is
 *    the whole result — no partially-read archive is returned.
 *
 * Server-only (node:zlib). Host byte order is assumed little-endian (every platform PoF runs).
 */
import { crc32, inflateRawSync } from 'node:zlib';
import { err, ok, type Result } from '@/types/result';

export type NpyDtype = 'float32' | 'float64' | 'int32' | 'int64' | 'bool' | 'unicode';

export interface NpyArray {
  /** The descr exactly as written in the npy header, e.g. `<f4`, `<U12`. */
  descr: string;
  dtype: NpyDtype;
  /** `[]` for a 0-d (scalar) array. */
  shape: number[];
  /** C-order elements. `<U` arrays decode to strings (trailing NULs stripped). */
  data: Float32Array | Float64Array | Int32Array | BigInt64Array | Uint8Array | string[];
}

export interface NpzArchive {
  /** Member names (without `.npy`) in central-directory order. */
  names: string[];
  arrays: Map<string, NpyArray>;
}

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOC = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const U32_MAX = 0xffffffff;

const DTYPES: Record<string, { dtype: NpyDtype; size: number }> = {
  '<f4': { dtype: 'float32', size: 4 }, '<f8': { dtype: 'float64', size: 8 },
  '<i4': { dtype: 'int32', size: 4 }, '<i8': { dtype: 'int64', size: 8 },
  '|b1': { dtype: 'bool', size: 1 },
};

interface CentralEntry { name: string; method: number; crc: number; csize: number; usize: number; offset: number }

function findEocd(dv: DataView): number {
  const min = Math.max(0, dv.byteLength - 22 - 0xffff);
  for (let i = dv.byteLength - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) return i;
  }
  return -1;
}

function readCentralDirectory(dv: DataView): Result<CentralEntry[]> {
  const eocd = findEocd(dv);
  if (eocd < 0) return err('not a zip archive: no end of central directory record');
  let count = dv.getUint16(eocd + 10, true);
  let cdOffset = dv.getUint32(eocd + 16, true);
  const loc = eocd - 20;
  if ((count === 0xffff || cdOffset === U32_MAX) && loc >= 0 && dv.getUint32(loc, true) === SIG_EOCD64_LOC) {
    const rec = Number(dv.getBigUint64(loc + 8, true));
    if (rec + 56 > dv.byteLength || dv.getUint32(rec, true) !== SIG_EOCD64) return err('corrupt zip64 end of central directory');
    count = Number(dv.getBigUint64(rec + 32, true));
    cdOffset = Number(dv.getBigUint64(rec + 48, true));
  }
  const entries: CentralEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > dv.byteLength || dv.getUint32(p, true) !== SIG_CENTRAL) return err(`corrupt central directory at entry ${n}`);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const name = Buffer.from(dv.buffer, dv.byteOffset + p + 46, nameLen).toString('utf8');
    const e: CentralEntry = {
      name, method: dv.getUint16(p + 10, true), crc: dv.getUint32(p + 16, true),
      csize: dv.getUint32(p + 20, true), usize: dv.getUint32(p + 24, true), offset: dv.getUint32(p + 42, true),
    };
    // ZIP64 extra (0x0001) holds, in order, only the fields whose 32-bit slot is saturated.
    let x = p + 46 + nameLen;
    const xEnd = x + extraLen;
    while (x + 4 <= xEnd) {
      const id = dv.getUint16(x, true);
      const size = dv.getUint16(x + 2, true);
      if (id === 0x0001) {
        let f = x + 4;
        const next = () => { const v = Number(dv.getBigUint64(f, true)); f += 8; return v; };
        if (e.usize === U32_MAX) e.usize = next();
        if (e.csize === U32_MAX) e.csize = next();
        if (e.offset === U32_MAX) e.offset = next();
      }
      x += 4 + size;
    }
    entries.push(e);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return ok(entries);
}

function memberBytes(buf: Uint8Array, dv: DataView, e: CentralEntry): Result<Uint8Array> {
  if (e.offset + 30 > dv.byteLength || dv.getUint32(e.offset, true) !== SIG_LOCAL) {
    return err(`member '${e.name}': no local header at offset ${e.offset}`);
  }
  // The LOCAL name/extra lengths, not the central ones: numpy's local extra is 20 bytes of
  // ZIP64 sizes while its central entry has none.
  const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  if (start + e.csize > buf.byteLength) return err(`member '${e.name}': truncated (${e.csize} bytes declared)`);
  const raw = buf.subarray(start, start + e.csize);
  let out: Uint8Array;
  if (e.method === 0) out = raw;
  else if (e.method === 8) {
    try {
      out = inflateRawSync(raw);
    } catch (x) {
      return err(`member '${e.name}': deflate stream is corrupt (${x instanceof Error ? x.message : 'unknown'})`);
    }
  } else return err(`member '${e.name}': unsupported zip compression method ${e.method}`);
  if (out.byteLength !== e.usize) return err(`member '${e.name}': size ${out.byteLength} != declared ${e.usize}`);
  if ((crc32(out) >>> 0) !== e.crc) return err(`member '${e.name}': crc mismatch — the archive is corrupt`);
  return ok(out);
}

function parseNpy(name: string, b: Uint8Array): Result<NpyArray> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.byteLength < 10 || b[0] !== 0x93 || Buffer.from(b.subarray(1, 6)).toString('latin1') !== 'NUMPY') {
    return err(`member '${name}' is not an .npy array`);
  }
  const major = b[6];
  if (major < 1 || major > 3) return err(`member '${name}': unsupported npy format version ${major}`);
  const prefix = major === 1 ? 10 : 12;
  const hlen = major === 1 ? dv.getUint16(8, true) : dv.getUint32(8, true);
  const header = Buffer.from(b.subarray(prefix, prefix + hlen)).toString(major === 3 ? 'utf8' : 'latin1');
  const descr = header.match(/'descr'\s*:\s*'([^']*)'/)?.[1];
  const fortran = header.match(/'fortran_order'\s*:\s*(True|False)/)?.[1];
  const shapeText = header.match(/'shape'\s*:\s*\(([^)]*)\)/)?.[1];
  if (descr === undefined || fortran === undefined || shapeText === undefined) {
    return err(`member '${name}': unreadable npy header`);
  }
  if (fortran === 'True') return err(`member '${name}' is fortran_order=True — only C-order arrays are read`);
  const shape = shapeText.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  if (shape.some((n) => !Number.isInteger(n) || n < 0)) return err(`member '${name}': bad shape (${shapeText})`);
  const count = shape.reduce((a, n) => a * n, 1);
  const body = b.subarray(prefix + hlen);

  const uni = descr.match(/^<U(\d+)$/);
  const known = DTYPES[descr];
  if (!known && !uni) {
    return err(`member '${name}' has refused dtype '${descr}' (read: <f4 <f8 <i4 <i8 |b1 <U; object/pickle arrays are never loaded — allow_pickle=False)`);
  }
  const size = uni ? Number(uni[1]) * 4 : known.size;
  if (body.byteLength < count * size) return err(`member '${name}': ${body.byteLength} data bytes, shape needs ${count * size}`);
  // An owned, aligned copy. NOT `body.slice`: on a Buffer that is a view of the shared pool.
  const owned = new Uint8Array(count * size);
  owned.set(body.subarray(0, count * size));
  const copy = owned.buffer;
  if (uni) {
    const n = Number(uni[1]);
    const cps = new Uint32Array(copy);
    const strings: string[] = [];
    for (let i = 0; i < count; i++) {
      let s = '';
      for (let j = 0; j < n; j++) {
        const c = cps[i * n + j];
        if (c === 0) break;
        s += String.fromCodePoint(c);
      }
      strings.push(s);
    }
    return ok({ descr, dtype: 'unicode', shape, data: strings });
  }
  const data =
    known.dtype === 'float32' ? new Float32Array(copy)
      : known.dtype === 'float64' ? new Float64Array(copy)
        : known.dtype === 'int32' ? new Int32Array(copy)
          : known.dtype === 'int64' ? new BigInt64Array(copy)
            : new Uint8Array(copy);
  return ok({ descr, dtype: known.dtype, shape, data });
}

/** Read every member of an `.npz`. All-or-nothing: any refused member fails the archive. */
export function readNpz(bytes: Uint8Array): Result<NpzArchive> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 22) return err('not a zip archive: no end of central directory record');
  const cd = readCentralDirectory(dv);
  if (!cd.ok) return cd;
  const names: string[] = [];
  const arrays = new Map<string, NpyArray>();
  for (const e of cd.data) {
    if (e.name.endsWith('/')) continue;
    const name = e.name.endsWith('.npy') ? e.name.slice(0, -4) : e.name;
    const raw = memberBytes(bytes, dv, e);
    if (!raw.ok) return raw;
    const arr = parseNpy(name, raw.data);
    if (!arr.ok) return arr;
    names.push(name);
    arrays.set(name, arr.data);
  }
  return ok({ names, arrays });
}

/** Numeric members as float64 (int64 via Number); null for strings. */
export function npyNumbers(a: NpyArray): Float64Array | null {
  if (a.dtype === 'unicode') return null;
  if (a.dtype === 'int64') return Float64Array.from(a.data as BigInt64Array, (v) => Number(v));
  return Float64Array.from(a.data as ArrayLike<number>);
}
