/** Escape a string for safe embedding in a Python double-quoted string literal. */
export function py(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/** A finite number as a Python numeric literal. NaN and +-Infinity are not Python literals, so they throw. */
export function pyNum(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`pyNum: ${String(n)} is not a finite number`);
  return String(n);
}

/**
 * A Python expression that evaluates to `value`: `json.loads` of the JSON text held in an
 * escaped double-quoted literal. `py` handles backslash, quote and line breaks, so the JSON
 * escapes survive as data and no user text can leave the literal.
 */
export function pyJson(value: unknown): string {
  return `__import__("json").loads("${py(JSON.stringify(value))}")`;
}
