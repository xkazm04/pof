import { readFileSync, existsSync } from 'node:fs';
import schema from './ue-schema.generated.json';

export type UeSchema = Record<string, string[]>; // type name → UPROPERTY field names

/** A table row (`: public FTableRowBase`) or a data asset (`: public U…DataAsset`), with or without an export macro. */
const TYPE_RE = /\b(?:struct|class)\s+(?:[A-Z][A-Z0-9_]*_API\s+)?(\w+)\s*:\s*public\s+(FTableRowBase|U\w*DataAsset)\s*\{/g;

/** Index just past the `)` that closes the `(` at `open` (UPROPERTY meta nests parentheses). */
function closeParen(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i + 1;
  }
  return src.length;
}

/** Index of the `}` that closes the `{` at `open`. */
function closeBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  return src.length;
}

/**
 * Parse header TEXT → { TypeName: [UPROPERTY field names] } for table rows and data assets (/diablo W10, D6).
 * The old regex matched 2 of 9 row structs: it could not skip `POF_API`, dropped every field with a default
 * (`float X = 1.f;`) and never read a data-asset class. A declaration runs from the end of its `UPROPERTY(...)`
 * (balanced parentheses) to the next `;`; its name is the last identifier before an optional `= default`.
 */
export function parseUeTypes(src: string): UeSchema {
  const out: UeSchema = {};
  for (const m of src.matchAll(TYPE_RE)) {
    const bodyStart = (m.index ?? 0) + m[0].length - 1;
    const body = src.slice(bodyStart, closeBrace(src, bodyStart));
    const fields: string[] = [];
    let at = body.indexOf('UPROPERTY(');
    while (at >= 0) {
      const after = closeParen(body, at + 'UPROPERTY'.length);
      const decl = body.slice(after, body.indexOf(';', after)).split('=')[0].trim();
      const name = /(\w+)\s*(?::\s*\d+)?\s*$/.exec(decl)?.[1];
      if (name) fields.push(name);
      at = body.indexOf('UPROPERTY(', after);
    }
    out[m[1]] = fields;
  }
  return out;
}

/** Parse one header file (see {@link parseUeTypes}). */
export function parseRowStructs(headerPath: string): UeSchema {
  return existsSync(headerPath) ? parseUeTypes(readFileSync(headerPath, 'utf8')) : {};
}

/** The committed snapshot of UE row-struct and data-asset shapes (schema-down source for validation). */
export function ueSchema(): UeSchema {
  return schema as UeSchema;
}
