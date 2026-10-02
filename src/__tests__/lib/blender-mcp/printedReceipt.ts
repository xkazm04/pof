/**
 * Test helper: what Python prints for a script's `pyReceipt` line.
 *
 * Tests never run Blender, so this evaluates the one receipt line the way
 * Python would: string literals are taken as written, and every other value is
 * a Python expression the test must supply (`{ n: 4 }`, `{ 'len(amt.bones)': 2 }`).
 * An expression it was not told about throws, so a test cannot silently pass
 * over a field it never evaluated.
 */
import { RECEIPT_MARKER } from '@/lib/blender-mcp/receipt';

const RECEIPT_LINE = /^print\('POF_RESULT=' \+ __import__\("json"\)\.dumps\((\{.*\})\)\)$/;
const PAIR = /"((?:[^"\\]|\\.)*)": ("(?:[^"\\]|\\.)*"|[^,}]+)/g;

export function printedReceipt(code: string, values: Record<string, unknown> = {}): string {
  const lines = code.split('\n').filter((l) => l.includes(RECEIPT_MARKER));
  if (lines.length !== 1) throw new Error(`expected exactly one receipt line, found ${lines.length}`);
  const dict = RECEIPT_LINE.exec(lines[0].trim());
  if (!dict) throw new Error(`not a pyReceipt line: ${lines[0]}`);
  const obj: Record<string, unknown> = {};
  for (const [, key, raw] of dict[1].matchAll(PAIR)) {
    const expr = raw.trim();
    const name = JSON.parse(`"${key}"`) as string;
    if (expr.startsWith('"')) obj[name] = JSON.parse(expr);
    else if (expr in values) obj[name] = values[expr];
    else throw new Error(`no value given for Python expression ${expr}`);
  }
  return `${RECEIPT_MARKER}${JSON.stringify(obj)}\n`;
}
