/**
 * The canonical form of a storygraph — what `contentHash` (§1) is computed over.
 *
 * The standard says the hash is "over the canonical form" without defining that form; two
 * producers must compute the same bytes or `contentHash` identifies nothing. This module uses the
 * one definition another tool can reproduce without reading our code: **RFC 8785 (JCS)** —
 *   - object keys sorted by UTF-16 code unit (the JS default string sort),
 *   - no insignificant whitespace,
 *   - strings and numbers serialised exactly as ECMAScript `JSON.stringify` does,
 *   - array order preserved (in a storygraph, order is meaningful: `entries`, `witness`, paths).
 * Object properties whose value is `undefined` are omitted (as JSON does); a non-finite number is
 * refused rather than silently turned into `null`.
 *
 * `contentHash` is excluded from its own input, so the hash of a document is the same whether or
 * not the document already carries it.
 */

import type { StoryGraph } from '@/lib/story/types';

/** RFC 8785 serialisation of any JSON value. Throws on a value JSON cannot represent. */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new Error(`canonicalize: non-finite number ${value}`);
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((v) => (v === undefined ? 'null' : canonicalize(v))).join(',')}]`;
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
    }
    default:
      throw new Error(`canonicalize: ${typeof value} is not a JSON value`);
  }
}

/** The canonical text of a graph, `contentHash` included if the graph carries one. */
export function canonicalStoryGraph(graph: StoryGraph): string {
  return canonicalize(graph);
}

/** The bytes `contentHash` is computed over: the canonical form without `contentHash`. */
export function contentHashInput(graph: StoryGraph): string {
  const rest: Record<string, unknown> = { ...graph };
  delete rest.contentHash;
  return canonicalize(rest);
}

/**
 * `sha256:<hex>` over `contentHashInput(graph)`. Web Crypto, so it runs on the server and in the
 * browser alike.
 */
export async function storyContentHash(graph: StoryGraph): Promise<string> {
  const bytes = new TextEncoder().encode(contentHashInput(graph));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}
