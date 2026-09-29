/**
 * Overwrite review — what a whole-file "Write to Project" DELETES, named in UE
 * vocabulary instead of a line count.
 *
 * `planWrite` holds the on-disk `before` and the generated `after` for the
 * header and the source; the write replaces both files whole. This compares
 * MEMBERSHIP, never location (ai-registry
 * `game-production/visual-script-to-code-transpilation#structural-round-trip-diff`):
 * a reordered or re-commented header is `no-loss` even when the line diff
 * shows red, and a hand-added `UFUNCTION(Server, Reliable)` is named even when
 * the line diff buries it in six red lines. The on-disk side is authoritative
 * for what it holds and the generated side does not.
 *
 * Pure — no fs, no React. Headers are read with the repo's single UE header
 * parser (`parseHeader`); the .cpp with a qualified-definition scan.
 */
import { parseHeader, type HeaderParseResult } from '@/lib/cpp-semantic-parser';

export interface OverwriteFile { before: string; after: string }

export interface LostMember {
  kind: 'property' | 'function';
  /** Class/struct that declared it on disk. */
  owner: string;
  name: string;
  /** `int32 Ammo` / `void ServerFire(FVector Aim)` — as declared on disk. */
  signature: string;
  /** Macro specifiers as written, e.g. `['ReplicatedUsing = OnRep_Ammo']`. */
  specifiers: string[];
}

export interface ChangedMember {
  kind: 'property' | 'function';
  owner: string;
  name: string;
  /** Specifier NAMES present on disk and absent from the generated code. */
  droppedSpecifiers: string[];
}

export type OverwriteVerdict = 'new-file' | 'no-loss' | 'loses-members';

export interface OverwriteReview {
  verdict: OverwriteVerdict;
  lost: LostMember[];
  changed: ChangedMember[];
  /** `<Class>::Name` definitions in the on-disk .cpp the generated .cpp lacks. */
  lostDefinitions: string[];
  /** What the review does NOT compare — stated, never implied. */
  boundary: string;
}

export const OVERWRITE_REVIEW_BOUNDARY =
  'Compared: UPROPERTY / UFUNCTION declarations (by name and specifier names) and <Class>:: definitions in the .cpp. '
  + 'Not compared: plain (non-UFUNCTION) declarations, member types, specifier values and function bodies.';

interface Member { kind: LostMember['kind']; owner: string; name: string; signature: string; specifiers: string[] }

function members(parsed: HeaderParseResult): Map<string, Member> {
  const out = new Map<string, Member>();
  for (const cls of parsed.classes) {
    for (const p of cls.properties) {
      out.set(`${cls.name}::p:${p.name}`, { kind: 'property', owner: cls.name, name: p.name, signature: `${p.type} ${p.name}`, specifiers: p.specifiers });
    }
    for (const f of cls.functionSignatures) {
      const params = f.params.map((x) => (x.name ? `${x.type} ${x.name}` : x.type)).join(', ');
      out.set(`${cls.name}::f:${f.name}`, { kind: 'function', owner: cls.name, name: f.name, signature: `${f.returnType} ${f.name}(${params})`, specifiers: f.specifiers });
    }
  }
  return out;
}

const specName = (s: string) => s.split('=')[0].trim();

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Qualifiers allowed between a definition's `)` and its body / init list. */
const TRAILING = /^\s*(?:(?:const|noexcept|override|final)\b\s*)*/;

/**
 * Names defined as `<className>::Name(...) {` (or a constructor's `: init`).
 * A qualified CALL (`AHero::StaticClass();`) is followed by `;`/`)`/`.`, so it
 * is not a definition. The class name is escaped: it is matched literally.
 */
export function definedNames(cpp: string, className: string): string[] {
  const src = stripComments(cpp);
  const re = new RegExp(`(?<![\\w:])${escapeRegExp(className)}\\s*::\\s*(~?[A-Za-z_]\\w*)\\s*\\(`, 'g');
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let depth = 0;
    let close = -1;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')' && --depth === 0) { close = i; break; }
    }
    if (close < 0) break;
    const rest = src.slice(close + 1).replace(TRAILING, '');
    if ((rest.startsWith('{') || (rest.startsWith(':') && !rest.startsWith('::'))) && !names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

export function reviewOverwrite(header: OverwriteFile, source: OverwriteFile, className: string): OverwriteReview {
  const nothingOnDisk = header.before.trim() === '' && source.before.trim() === '';
  const lost: LostMember[] = [];
  const changed: ChangedMember[] = [];
  const onDisk = members(parseHeader(header.before));
  const generated = members(parseHeader(header.after));
  for (const [key, m] of onDisk) {
    const next = generated.get(key);
    if (!next) { lost.push({ ...m }); continue; }
    const kept = new Set(next.specifiers.map((s) => specName(s).toLowerCase()));
    const dropped = m.specifiers.map(specName).filter((s) => !kept.has(s.toLowerCase()));
    if (dropped.length) changed.push({ kind: m.kind, owner: m.owner, name: m.name, droppedSpecifiers: dropped });
  }
  const keptDefs = new Set(definedNames(source.after, className));
  const lostDefinitions = definedNames(source.before, className).filter((n) => !keptDefs.has(n));
  const loses = lost.length + changed.length + lostDefinitions.length > 0;
  return {
    verdict: nothingOnDisk ? 'new-file' : loses ? 'loses-members' : 'no-loss',
    lost, changed, lostDefinitions, boundary: OVERWRITE_REVIEW_BOUNDARY,
  };
}

/** Everything the overwrite takes away, counted once per member/definition. */
export function lossCount(review: OverwriteReview): number {
  return review.lost.length + review.changed.length + review.lostDefinitions.length;
}

/** A loss is confirmable only with an explicit acknowledgement. */
export function overwriteConfirmGate(review: OverwriteReview, acknowledged: boolean): 'confirm' | 'needs-ack' {
  return review.verdict === 'loses-members' && !acknowledged ? 'needs-ack' : 'confirm';
}

export interface MergeTarget {
  className: string;
  moduleName: string;
  relPaths: { header: string; source: string };
  /** The generated code to fold in. */
  header: string;
  source: string;
}

/** The CLI prompt for the non-destructive path: fold the generated members
 *  into the existing files and keep every hand-written one. */
export function buildOverwriteMergePrompt(review: OverwriteReview, t: MergeTarget): string {
  const keep = review.lost.map((m) => `- ${m.kind === 'property' ? 'UPROPERTY' : 'UFUNCTION'}(${m.specifiers.join(', ')}) ${m.signature};  (in ${m.owner})`);
  const specs = review.changed.map((c) => `- ${c.name}: keep ${c.droppedSpecifiers.join(', ')}`);
  const defs = review.lostDefinitions.map((d) => `- ${t.className}::${d}(...)`);
  return [
    `Merge freshly transpiled Blueprint code into the EXISTING ${t.className} in module ${t.moduleName}.`,
    `Edit these two files in place: ${t.relPaths.header} and ${t.relPaths.source}.`,
    'Do not overwrite them whole and do not delete or remove any hand-written member: add what the generated code declares and keep everything listed below.',
    '',
    'KEEP these hand-written header members (the generated header does not declare them):',
    ...(keep.length ? keep : ['- (none)']),
    '',
    'KEEP these specifiers on members the generated code also declares:',
    ...(specs.length ? specs : ['- (none)']),
    '',
    `KEEP these ${t.relPaths.source} definitions (the generated source does not define them):`,
    ...(defs.length ? defs : ['- (none)']),
    '',
    `Generated header (${t.relPaths.header}):`,
    '```cpp', t.header.trim(), '```',
    '',
    `Generated source (${t.relPaths.source}):`,
    '```cpp', t.source.trim(), '```',
    '',
    'Where a generated member and a hand-written one share a name, keep the hand-written declaration and report the conflict. Build afterwards and report the result.',
  ].join('\n');
}
