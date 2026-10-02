/* ------------------------------------------------------------------ */
/*  Localization Pipeline — C++ string extractor (pure)                */
/* ------------------------------------------------------------------ */
/*                                                                     */
/*  Turns one UE C++ file's text into RawStringUnits with their real   */
/*  line/column. Every string literal outside comments is counted      */
/*  independently (`literalsSeen`) and given exactly one disposition:  */
/*  a unit (user-facing text in a known shape) or an excluded literal  */
/*  with a class (UE_LOG text is 'log', never counted as UI text).     */
/*  So literalsSeen === units.length + excluded.length always holds —  */
/*  a shape that claimed a literal twice would break it.               */
/*                                                                     */
/*  Line-based: a call split across lines leaves its literal           */
/*  'unclassified' rather than guessing.                               */
/* ------------------------------------------------------------------ */

import type { ExcludedLiteralClass, RawStringUnit, StringUsage } from '@/types/localization-pipeline';

export interface ExcludedLiteral {
  class: ExcludedLiteralClass;
  line: number;
  text: string;
}

export interface ExtractResult {
  units: RawStringUnit[];
  excluded: ExcludedLiteral[];
  literalsSeen: number;
}

const LIT = String.raw`"(?:[^"\\]|\\.)*"`;
const LITERAL_RE = new RegExp(LIT, 'g');

const INCLUDE_RE = /^\s*#\s*include\b/;
const NS_DEFINE_RE = new RegExp(String.raw`^\s*#\s*define\s+LOCTEXT_NAMESPACE\s+(${LIT})`);
const NS_UNDEF_RE = /^\s*#\s*undef\s+LOCTEXT_NAMESPACE\b/;
const LOG_RE = /\b(?:UE_LOG|UE_CLOG|UE_LOGFMT|ensureMsgf|ensureAlwaysMsgf|checkf|verifyf|AddOnScreenDebugMessage|DrawDebugString)\s*\(/;
/** String-table references (table id + key) are already localized; their literals are keys. */
const STRING_TABLE_RE = /\b(?:FText::FromStringTable|LOCTABLE)\s*\(/;
/** Reflection specifiers (Category = "Combat", meta = (...)) are editor metadata, not game text. */
const METADATA_RE = /^\s*(?:UPROPERTY|UFUNCTION|UCLASS|USTRUCT|UENUM|UINTERFACE|UPARAM)\s*\(|\bUMETA\s*\(/;

type Role = { kind: 'unit'; usage: StringUsage } | { kind: 'excluded'; class: ExcludedLiteralClass };

/** Shapes, tried in order; each assigns a role to the literals inside its match, by ordinal. */
const SHAPES: { re: RegExp; roles: Role[] }[] = [
  {
    re: new RegExp(String.raw`\bNSLOCTEXT\s*\(\s*${LIT}\s*,\s*${LIT}\s*,\s*${LIT}\s*\)`, 'g'),
    roles: [{ kind: 'excluded', class: 'loc-key' }, { kind: 'excluded', class: 'loc-key' }, { kind: 'unit', usage: 'nsloctext' }],
  },
  {
    re: new RegExp(String.raw`\bLOCTEXT\s*\(\s*${LIT}\s*,\s*${LIT}\s*\)`, 'g'),
    roles: [{ kind: 'excluded', class: 'loc-key' }, { kind: 'unit', usage: 'loctext' }],
  },
  {
    re: new RegExp(String.raw`\bFText::FromString\s*\(\s*(?:TEXT\s*\(\s*)?${LIT}`, 'g'),
    roles: [{ kind: 'unit', usage: 'ftext_fromstring' }],
  },
  {
    re: new RegExp(String.raw`\bFString\s+[A-Za-z_]\w*\s*(?:=\s*|\(\s*)(?:TEXT\s*\(\s*)?${LIT}`, 'g'),
    roles: [{ kind: 'unit', usage: 'hardcoded' }],
  },
];

/** Blanks comments (keeping columns) so literals in them are neither seen nor claimed. */
function stripComments(line: string, state: { inBlock: boolean }): string {
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (state.inBlock) {
      const end = line.indexOf('*/', i);
      if (end < 0) return out + ' '.repeat(line.length - i);
      out += ' '.repeat(end + 2 - i);
      i = end + 2;
      state.inBlock = false;
      continue;
    }
    const ch = line[i];
    // A quote after an alphanumeric is a digit separator (1'000), not a char literal.
    if (ch === '"' || (ch === '\'' && !/\w/.test(line[i - 1] ?? ''))) {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      // Char literals ('"') are blanked so their quote is not read as a string.
      out += ch === '"' ? line.slice(i, j + 1) : ' '.repeat(Math.min(j + 1, line.length) - i);
      i = j + 1;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') return out + ' '.repeat(line.length - i);
    if (ch === '/' && line[i + 1] === '*') {
      state.inBlock = true;
      out += '  ';
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

const unquote = (lit: string) => lit.slice(1, -1);

export function extractStrings(filePath: string, content: string): ExtractResult {
  const units: RawStringUnit[] = [];
  const excluded: ExcludedLiteral[] = [];
  let literalsSeen = 0;
  let namespace: string | undefined;
  const comment = { inBlock: false };
  const lines = content.split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const code = stripComments(raw, comment);
    const literals = [...code.matchAll(LITERAL_RE)].map((m) => ({ start: m.index ?? 0, lit: m[0] }));
    literalsSeen += literals.length;
    if (literals.length === 0) {
      if (NS_UNDEF_RE.test(code)) namespace = undefined;
      return;
    }

    const roles = new Map<number, Role & { ns?: string; key?: string; hint?: string }>();
    const claimAll = (from: number, cls: ExcludedLiteralClass) => {
      for (const l of literals) if (l.start >= from && !roles.has(l.start)) roles.set(l.start, { kind: 'excluded', class: cls });
    };

    const nsDef = NS_DEFINE_RE.exec(code);
    if (INCLUDE_RE.test(code)) claimAll(0, 'include');
    else if (METADATA_RE.test(code)) claimAll(0, 'metadata');
    else if (nsDef) {
      namespace = unquote(nsDef[1]);
      claimAll(0, 'loc-key');
    }
    const table = STRING_TABLE_RE.exec(code);
    if (table) claimAll(table.index, 'loc-key');
    const log = LOG_RE.exec(code);
    if (log) claimAll(log.index, 'log');

    for (const shape of SHAPES) {
      for (const m of code.matchAll(shape.re)) {
        const at = m.index ?? 0;
        const inner = [...m[0].matchAll(LITERAL_RE)];
        if (inner.some((l) => roles.has(at + (l.index ?? 0)))) continue;
        const lits = inner.map((l) => unquote(l[0]));
        inner.forEach((l, k) => {
          const role = shape.roles[k];
          if (!role) return;
          const extra = role.kind === 'unit' && role.usage === 'nsloctext'
            ? { ns: lits[0], key: lits[1] }
            : role.kind === 'unit' && role.usage === 'loctext' ? { ns: namespace, key: lits[0] } : {};
          roles.set(at + (l.index ?? 0), { ...role, ...extra, hint: code.slice(0, at + (l.index ?? 0)).trim() });
        });
        // Literals joined onto a hardcoded FString after its first piece are concatenation fragments.
        if (shape.roles[0].kind === 'unit' && shape.roles[0].usage === 'hardcoded') claimAll(at + m[0].length, 'fragment');
      }
    }

    for (const { start, lit } of literals) {
      const role = roles.get(start) ?? { kind: 'excluded' as const, class: 'unclassified' as const };
      if (role.kind === 'excluded') {
        excluded.push({ class: role.class, line: lineNo, text: unquote(lit) });
        continue;
      }
      const unit: RawStringUnit = {
        text: unquote(lit),
        usage: role.usage,
        filePath,
        line: lineNo,
        column: start + 1,
        snippet: raw.trim(),
        identifierHint: role.hint ?? '',
      };
      if (role.ns !== undefined) unit.namespace = role.ns;
      if (role.key !== undefined) unit.key = role.key;
      units.push(unit);
    }
    if (NS_UNDEF_RE.test(code)) namespace = undefined;
  });

  return { units, excluded, literalsSeen };
}
