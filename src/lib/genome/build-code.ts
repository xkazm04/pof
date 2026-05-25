/** ── Shareable Genome Build Codes ─────────────────────────────────────────── *
 * Compact, copy-paste codes for sharing character / item genomes as a single
 * string (think Path of Building pob-codes or Pokémon Showdown paste-import).
 *
 * Format:  <tag>.<payload>
 *   tag      — short human-readable kind+version marker (e.g. "pofc1")
 *   payload  — url-safe base64 of the raw-DEFLATE-compressed genome JSON
 *
 * Compression uses the platform-native CompressionStream ("deflate-raw"),
 * available in modern browsers and Node 18+, so no extra dependency is needed.
 * Encoding/decoding is therefore async.
 * ────────────────────────────────────────────────────────────────────────── */

import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';

/** Which editor a build code came from. */
export type GenomeCodeKind = 'character' | 'item';

/** Tag prefixes — bump the trailing version digit on a breaking schema change. */
const TAG: Record<GenomeCodeKind, string> = {
  character: 'pofc1',
  item: 'pofi1',
};
const KIND_BY_TAG: Record<string, GenomeCodeKind> = {
  pofc1: 'character',
  pofi1: 'item',
};

/** Result of decoding a build code — the detected kind plus the parsed payload. */
export interface DecodedBuildCode {
  kind: GenomeCodeKind;
  /** Raw parsed JSON — caller must sanitize/validate before use. */
  data: unknown;
}

/* ── base64url helpers ─────────────────────────────────────────────────────── */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000; // avoid call-stack overflow on String.fromCharCode spread
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(code: string): Uint8Array {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ── deflate / inflate via Web Streams ─────────────────────────────────────── */

async function pumpThroughStream(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // Fire-and-forget the write; payloads are tiny (a genome is a few hundred
  // bytes) so they fit comfortably inside the stream's internal buffer.
  // Cast: Uint8Array<ArrayBufferLike> is a valid BufferSource at runtime; the
  // cast bridges TS's stricter typed-array buffer generic.
  void writer.write(input as BufferSource);
  void writer.close();

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return pumpThroughStream(bytes, new CompressionStream('deflate-raw'));
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return pumpThroughStream(bytes, new DecompressionStream('deflate-raw'));
}

/* ── Public API ────────────────────────────────────────────────────────────── */

/**
 * Encode any genome-like object into a shareable build code.
 * The object is JSON-serialised, raw-deflated, then url-safe base64-encoded.
 */
export async function encodeBuildCode(kind: GenomeCodeKind, genome: unknown): Promise<string> {
  const json = JSON.stringify(genome);
  const bytes = new TextEncoder().encode(json);
  const compressed = await deflateRaw(bytes);
  return `${TAG[kind]}.${bytesToBase64Url(compressed)}`;
}

/**
 * Decode a build code back into its parsed JSON payload and detected kind.
 * Returns a Result — invalid tags, malformed base64, corrupt deflate streams,
 * and non-JSON payloads all surface as a descriptive error string instead of
 * throwing. Whitespace around the code is tolerated (copy-paste friendly).
 */
export async function decodeBuildCode(code: string): Promise<Result<DecodedBuildCode>> {
  const trimmed = code.trim();
  if (!trimmed) return err('Build code is empty');

  const dot = trimmed.indexOf('.');
  if (dot <= 0) return err('Not a valid build code (missing "<tag>." prefix)');

  const tag = trimmed.slice(0, dot);
  const payload = trimmed.slice(dot + 1);
  const kind = KIND_BY_TAG[tag];
  if (!kind) return err(`Unknown build code type "${tag}"`);
  if (!payload) return err('Build code has no payload');

  let parsed: unknown;
  try {
    const bytes = base64UrlToBytes(payload);
    const inflated = await inflateRaw(bytes);
    const json = new TextDecoder().decode(inflated);
    parsed = JSON.parse(json);
  } catch {
    return err('Build code is corrupt or was copied incompletely');
  }

  return ok({ kind, data: parsed });
}

/** Peek at a code's declared kind without fully decoding it (cheap, sync). */
export function peekBuildCodeKind(code: string): GenomeCodeKind | null {
  const trimmed = code.trim();
  const dot = trimmed.indexOf('.');
  if (dot <= 0) return null;
  return KIND_BY_TAG[trimmed.slice(0, dot)] ?? null;
}

/** True if the string looks like a PoF genome build code (any kind). */
export function looksLikeBuildCode(text: string): boolean {
  return peekBuildCodeKind(text) !== null;
}
