import { readFileSync, existsSync } from 'node:fs';
import schema from './ue-schema.generated.json';

export type UeSchema = Record<string, string[]>; // structName → field names

/** Parse one .h file's `USTRUCT ... FTableRowBase` blocks → { StructName: [fields] }. */
export function parseRowStructs(headerPath: string): UeSchema {
  if (!existsSync(headerPath)) return {};
  const src = readFileSync(headerPath, 'utf8');
  const out: UeSchema = {};
  const structRe = /struct\s+(\w*Row\w*|F\w*Def)\s*:\s*public\s+FTableRowBase\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = structRe.exec(src))) {
    const fields = [...m[2].matchAll(/UPROPERTY\([^)]*\)\s*\n?\s*[\w:<>*\s]+?\s+(\w+)\s*;/g)].map((f) => f[1]);
    out[m[1]] = fields;
  }
  return out;
}

/** The committed snapshot of UE row-struct shapes (schema-down source for validation). */
export function ueSchema(): UeSchema {
  return schema as UeSchema;
}
