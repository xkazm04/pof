import { py } from '@/lib/blender-mcp/escape';
import type { ExecuteOutput, Receipt } from '@/lib/blender-mcp/types';

export type { Receipt };

/**
 * One receipt envelope for every Blender script PoF sends.
 *
 * A 200 from `/api/blender-mcp/execute` only means the addon accepted the code —
 * the bridge may be on another machine, so PoF cannot stat a file or count a
 * scene. The honest ceiling is what Blender itself printed, so a generator ends
 * with ONE machine-readable line:
 *
 *     POF_RESULT={"kind": "export", "path": "C:/a.fbx"}
 *
 * emitted by `pyReceipt` (json.dumps, so it always parses), parsed ONCE at the
 * service edge (`service.executeCode` returns `{ output, receipts }`), and read by
 * a caller with `readReceipt(result, kind, expect)` → confirmed | unconfirmed |
 * mismatch. Only `confirmed` may render as success; a script that printed prose
 * and no receipt is `unconfirmed`, never a pass.
 *
 * Emit the receipt as the script's LAST statement, after any `raise`, so a
 * failed operation can never print one.
 */
export const RECEIPT_MARKER = 'POF_RESULT=';

export type ReceiptRead =
  | { state: 'confirmed'; data: Receipt }
  | { state: 'unconfirmed'; reason: string }
  | { state: 'mismatch'; data: Receipt; reason: string };

/** A Python string literal for a TS string — the usual way to pass a known value as a field. */
export function pyStr(s: string): string {
  return `"${py(s)}"`;
}

/**
 * The Python line that prints a receipt. `fields` values are Python EXPRESSIONS
 * evaluated in Blender (`'n'`, `'len(amt.bones)'`, or `pyStr(path)` for a literal);
 * the kind and field names are escaped here.
 */
export function pyReceipt(kind: string, fields: Record<string, string> = {}): string {
  const pairs = [`"kind": ${pyStr(kind)}`, ...Object.entries(fields).map(([k, v]) => `${pyStr(k)}: ${v}`)];
  return `print('${RECEIPT_MARKER}' + __import__("json").dumps({${pairs.join(', ')}}))`;
}

function isReceipt(v: unknown): v is Receipt {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as Receipt).kind === 'string';
}

/**
 * Every receipt line in `output`, in print order. Line-anchored and tolerant of
 * surrounding prose; a malformed or kind-less line is skipped, not thrown.
 *
 * If there is none and `output` is itself a stringified addon reply (what an
 * un-normalised `{executed, result}` answer looks like), the printed text inside
 * it is read instead — a receipt escaped into a JSON blob is still a receipt.
 */
export function parseReceipts(output: string): Receipt[] {
  const found: Receipt[] = [];
  for (const line of output.split(/\r?\n/)) {
    const at = line.trimStart();
    if (!at.startsWith(RECEIPT_MARKER)) continue;
    try {
      const value: unknown = JSON.parse(at.slice(RECEIPT_MARKER.length));
      if (isReceipt(value)) found.push(value);
    } catch {
      // Not JSON: a truncated or hand-written line is not a receipt.
    }
  }
  if (found.length > 0) return found;
  const inner = unwrapAddonReply(output);
  return inner === null ? found : parseReceipts(inner);
}

/** The printed text inside a stringified addon reply, or null when `output` is not one. */
function unwrapAddonReply(output: string): string | null {
  const t = output.trim();
  if (!t.startsWith('{')) return null;
  try {
    const obj = JSON.parse(t) as Record<string, unknown>;
    return printedText(obj) ?? null;
  } catch {
    return null;
  }
}

/**
 * What the script printed, from an addon reply: `output` (PoF's own shape) or
 * `result` (the ahujasid addon's `{executed, result}`). Undefined when neither is text.
 */
export function printedText(reply: Record<string, unknown> | null | undefined): string | undefined {
  if (typeof reply?.output === 'string') return reply.output;
  if (typeof reply?.result === 'string') return reply.result;
  return undefined;
}

function mismatchReason(key: string, got: unknown, want: unknown): string {
  if (typeof got === 'number' && typeof want === 'number') {
    return `Blender reported ${key} ${got} of ${want}`;
  }
  return `Blender reported ${key} ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`;
}

/**
 * Read the receipt of `kind` from what a dispatch returned. `source` is the raw
 * output, the `{ output, receipts }` the service returns (its parsed receipts are
 * preferred; the output is the fallback for a caller that only has text), or a
 * receipt list. The LAST receipt of that kind wins; every `expect` field must
 * match it exactly for `confirmed`.
 */
export function readReceipt(
  source: string | Partial<ExecuteOutput> | readonly Receipt[],
  kind: string,
  expect: Record<string, unknown> = {},
): ReceiptRead {
  const receipts =
    typeof source === 'string'
      ? parseReceipts(source)
      : Array.isArray(source)
        ? source
        : Array.isArray((source as Partial<ExecuteOutput>).receipts)
          ? (source as ExecuteOutput).receipts
          : parseReceipts((source as Partial<ExecuteOutput>).output ?? '');
  const data = [...receipts].reverse().find((r) => r.kind === kind);
  if (!data) {
    return {
      state: 'unconfirmed',
      reason: `the script ran but Blender printed no '${kind}' receipt, so the outcome could not be confirmed`,
    };
  }
  const off = Object.entries(expect).filter(([k, v]) => data[k] !== v);
  if (off.length === 0) return { state: 'confirmed', data };
  return { state: 'mismatch', data, reason: off.map(([k, v]) => mismatchReason(k, data[k], v)).join('; ') };
}
