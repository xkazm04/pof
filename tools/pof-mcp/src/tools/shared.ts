import type { PofClient } from '../pofClient.js';

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, pof: PofClient) => Promise<unknown>;
  /**
   * A safe, read-only example invocation. The contract test records it to
   * `examples/<tool>.json` (→ TOOLS-REFERENCE.md) and asserts its shape. Omit for
   * write/expensive/live tools — those get bespoke recorded cases or an EXAMPLE_SKIP reason.
   */
  example?: { args: Record<string, unknown>; note?: string };
}

export function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || v.length === 0) throw new Error(`"${key}" (non-empty string) is required`);
  return v;
}
export function optStr(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.length ? v : undefined;
}
export function optNum(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  return typeof v === 'number' ? v : undefined;
}
export function reqObj(args: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = args[key];
  if (v == null || typeof v !== 'object' || Array.isArray(v)) throw new Error(`"${key}" (object) is required`);
  return v as Record<string, unknown>;
}
export function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const STR = { type: 'string' } as const;
export const NUM = { type: 'number' } as const;
export const BOOL = { type: 'boolean' } as const;
export const OBJ = { type: 'object' } as const;

export function obj(properties: Record<string, unknown>, required: string[] = []) {
  return { type: 'object', properties, required, additionalProperties: false };
}
