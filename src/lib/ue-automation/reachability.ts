/**
 * Test reachability audit - which declared UE test classes can the engine actually reach?
 *
 * The incident: `VSCombatDamageFormulaTest` "had never been placed in any map, so it had never
 * run" (docs/superpowers/specs/2026-09-22-combat-attackpower-adds-zero.md). The class compiled, the
 * source tree looked covered, and nothing ever ran it. The runner cannot see that: a name the engine
 * does not list is "planned, not registered" (`ZERO_MATCH_DETAIL`), so a class that EXISTS and is
 * unreachable reads exactly like a test nobody has written yet.
 *
 * This module is pure and dependency-free (no fs, no engine, no `test-gate-runner` import). It takes
 * file contents and a captured `Automation List` log and answers, per declared class, one of five
 * things (`ReachabilityClass`). It is NOT wired into the drain write path or `parse.ts`; a caller reads
 * the report and decides.
 *
 * What registration actually is (verified in the engine source, UE 5.8):
 *  - `IMPLEMENT_SIMPLE_AUTOMATION_TEST(Class, "Name", flags)` registers the literal string `"Name"`.
 *    The C++ alone proves the name, so a simple test is judged by an exact lookup in the list.
 *  - A functional-test ACTOR (a `UCLASS` deriving from `AFunctionalTest`) registers nothing by being
 *    compiled. The engine reads the map asset's `TestNames` tag (`FFunctionalTestingModule::
 *    OnGetAssetTagsForWorld`) and registers `Project.Functional Tests.<map package path>.<ACTOR LABEL>`
 *    (`GetMapTests`, `MapPackageToAutomationPath`). So a class is reachable only when some SAVED map
 *    holds an ENABLED actor of it, and the registered name carries the actor's label, not the class.
 *  - Complex tests and specs register `<name>.<generated suffix>`, so they are matched by prefix.
 *
 * What can be known WITHOUT the engine: a map is a binary asset and cannot be read here. The only
 * placement evidence available is a placement script under `Content/Python` that names the class and
 * spawns actors. That is evidence a placement was ATTEMPTED, never that it was saved, so this module
 * has no `placed` outcome at all. Where placement cannot be known it says so.
 *
 * Per the registry law "an instrument proves it had input before it reports a verdict": the report
 * carries how many classes and registered names it examined, an empty or missing list is a LOUD status
 * (`no-list` / `empty-list`), a list whose own `Found N` header disagrees with the names that follow
 * it is `truncated-list`, and `clean` is reachable only when every input is proven and nothing is flagged.
 */

export interface SourceFile {
  path: string;
  text: string;
}

// ---------------------------------------------------------------------------------------------
// (i) `Automation List` parser
// ---------------------------------------------------------------------------------------------

// The engine prints `LogAutomationCommandLine: Display: Found N Automation Tests` and then one
// `LogAutomationCommandLine: Display: \t'<name>'` per test (AutomationCommandline.cpp, the ListAllTests
// branch). Names can hold spaces ("Project.Functional Tests...") and a prefix timestamp is optional.
// `Automation RunTests` prints its matches WITHOUT quotes and says "automation tests based on", so a
// run log is never mistaken for a list.
const LIST_HEADER_RE = /LogAutomationCommandLine:\s*(?:Display:\s*)?Found (\d+) Automation Tests\b/;
const LIST_NAME_RE = /LogAutomationCommandLine:\s*(?:Display:\s*)?'(.*)'\s*$/;

export interface ParsedAutomationList {
  /** Distinct registered names, first-seen order. */
  names: string[];
  /** Quoted name lines read, duplicates included. */
  nameLines: number;
  duplicates: number;
  /** Every `Found N Automation Tests` header, in order. */
  declaredCounts: number[];
  /** A header's N differs from the quoted names after it: the capture was cut, or is not one list. */
  truncated: boolean;
}

export function parseAutomationList(text: string | null | undefined): ParsedAutomationList {
  const names: string[] = [];
  const seen = new Set<string>();
  const declaredCounts: number[] = [];
  let nameLines = 0;
  let duplicates = 0;
  let truncated = false;
  let block: { declared: number; read: number } | null = null;
  const close = () => {
    if (block && block.read !== block.declared) truncated = true;
    block = null;
  };
  for (const line of (text ?? '').split(/\r?\n/)) {
    const h = LIST_HEADER_RE.exec(line);
    if (h) {
      close();
      const declared = Number(h[1]);
      declaredCounts.push(declared);
      block = { declared, read: 0 };
      continue;
    }
    const m = LIST_NAME_RE.exec(line);
    if (!m) continue;
    nameLines++;
    if (block) block.read++;
    if (seen.has(m[1])) duplicates++;
    else {
      seen.add(m[1]);
      names.push(m[1]);
    }
  }
  close();
  return { names, nameLines, duplicates, declaredCounts, truncated };
}

// ---------------------------------------------------------------------------------------------
// (ii) C++ scanner
// ---------------------------------------------------------------------------------------------

export type DeclaredKind = 'simple' | 'complex' | 'spec' | 'functional-actor';

export interface DeclaredTest {
  kind: DeclaredKind;
  /** The C++ class as declared (`FVSFooTest` for a macro test, `AVSFooTest` for an actor). */
  className: string;
  file: string;
  /** simple / complex / spec: the literal registered name (a PREFIX for complex and spec). */
  registeredName?: string;
  /** functional-actor: the direct base class. */
  base?: string;
}

export interface DeclaredScan {
  /** Auditable tests: macro tests plus non-abstract functional-test actors. */
  tests: DeclaredTest[];
  filesScanned: number;
  /** Functional-test actors that cannot be placed (`UCLASS(Abstract)`), counted not audited. */
  abstractSkipped: string[];
  /** `UCLASS` declarations that are not functional tests (fixtures, widgets), examined and ignored. */
  otherClasses: number;
  /** A test macro was seen but its class/name could not be read: examined, NOT silently dropped. */
  unparsedMacros: { file: string; snippet: string }[];
  /** The same registered name declared by two classes. */
  duplicateNames: string[];
}

/** Engine bases a functional-test actor derives from. Injectable: a project may add its own roots. */
export const DEFAULT_FUNCTIONAL_ROOTS: readonly string[] = ['AFunctionalTest'];

/** Blank comments (C and C++), keeping strings and newlines, so a macro named in prose is not a test. */
function stripCppComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        j++;
      }
      out += src.slice(i, Math.min(j + 1, n));
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  // A `#define` body that mentions the macro is a definition, not a declaration.
  return out.replace(/^[ \t]*#[ \t]*define[^\n]*(?:\\\r?\n[^\n]*)*/gm, (m) => m.replace(/[^\n]/g, ' '));
}

const TEST_MACRO_ANY_RE = /\b(?:IMPLEMENT_(?:CUSTOM_)?(?:SIMPLE|COMPLEX)_AUTOMATION_TEST(?:_PRIVATE)?|BEGIN_DEFINE_SPEC|DEFINE_SPEC)\s*\(/g;
// (Class, "Name", flags) or, for the CUSTOM forms, (Class, Base, "Name", flags).
const TEST_MACRO_RE = /\b(IMPLEMENT_(?:CUSTOM_)?(SIMPLE|COMPLEX)_AUTOMATION_TEST(?:_PRIVATE)?|BEGIN_DEFINE_SPEC|DEFINE_SPEC)\s*\(\s*(\w+)\s*,\s*(?:(\w+)\s*,\s*)?"((?:[^"\\]|\\.)*)"/g;

function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      i++;
      while (i < text.length && text[i] !== c && text[i] !== '\n') {
        if (text[i] === '\\') i++;
        i++;
      }
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return -1;
}

export function scanDeclaredTests(
  files: readonly SourceFile[],
  opts: { functionalRoots?: readonly string[] } = {},
): DeclaredScan {
  const roots = new Set(opts.functionalRoots ?? DEFAULT_FUNCTIONAL_ROOTS);
  const tests: DeclaredTest[] = [];
  const unparsedMacros: DeclaredScan['unparsedMacros'] = [];
  const decls: { name: string; base: string; abstract: boolean; file: string }[] = [];

  for (const f of files) {
    const code = stripCppComments(f.text);

    const parsedAt = new Set<number>();
    for (const m of code.matchAll(TEST_MACRO_RE)) {
      parsedAt.add(m.index ?? -1);
      const macro = m[1];
      const kind: DeclaredKind = macro.startsWith('IMPLEMENT_')
        ? m[2] === 'COMPLEX' ? 'complex' : 'simple'
        : 'spec';
      tests.push({ kind, className: m[3], file: f.path, registeredName: m[5] });
    }
    for (const m of code.matchAll(TEST_MACRO_ANY_RE)) {
      if (parsedAt.has(m.index ?? -1)) continue;
      const at = m.index ?? 0;
      unparsedMacros.push({ file: f.path, snippet: code.slice(at, at + 80).replace(/\s+/g, ' ') });
    }

    let from = 0;
    for (;;) {
      const u = code.indexOf('UCLASS', from);
      if (u < 0) break;
      from = u + 6;
      if (!/\bUCLASS\s*\(/.test(code.slice(u, u + 12)) || /\w/.test(code[u - 1] ?? ' ')) continue;
      const open = code.indexOf('(', u);
      const close = matchingParen(code, open);
      if (close < 0) continue;
      const decl = /^\s*class\s+(?:\w+_API\s+)?(\w+)\s*(?:final\s*)?:\s*(?:public\s+|protected\s+|private\s+)?(\w+)/.exec(code.slice(close + 1, close + 400));
      if (!decl) continue;
      decls.push({ name: decl[1], base: decl[2], abstract: /\bAbstract\b/.test(code.slice(open, close)), file: f.path });
    }
  }

  const baseOf = new Map(decls.map((d) => [d.name, d.base]));
  const isFunctional = (name: string): boolean => {
    const seen = new Set<string>();
    for (let c: string | undefined = baseOf.get(name); c && !seen.has(c); c = baseOf.get(c)) {
      if (roots.has(c)) return true;
      seen.add(c);
    }
    return false;
  };

  const abstractSkipped: string[] = [];
  let otherClasses = 0;
  const seenActor = new Set<string>();
  for (const d of decls) {
    if (!isFunctional(d.name)) {
      otherClasses++;
    } else if (d.abstract) {
      if (!abstractSkipped.includes(d.name)) abstractSkipped.push(d.name);
    } else if (!seenActor.has(d.name)) {
      seenActor.add(d.name);
      tests.push({ kind: 'functional-actor', className: d.name, file: d.file, base: d.base });
    }
  }

  const byName = new Map<string, number>();
  for (const t of tests) if (t.registeredName) byName.set(t.registeredName, (byName.get(t.registeredName) ?? 0) + 1);
  const duplicateNames = [...byName].filter(([, n]) => n > 1).map(([name]) => name);

  return { tests, filesScanned: files.length, abstractSkipped, otherClasses, unparsedMacros, duplicateNames };
}

// ---------------------------------------------------------------------------------------------
// (iii) Placement evidence - exactly what a script can show, and no more
// ---------------------------------------------------------------------------------------------

/**
 * `spawn-call`            a script passes the class straight to `spawn_actor_from_class`.
 * `named-in-spawning-script`  a script that spawns actors names the class (a table row, a helper) but
 *                         the spawn argument could not be traced to it.
 * Neither says the script ran, that the map was saved, or that the actor is enabled. There is no
 * `placed` strength: that fact lives in a binary map this module cannot read.
 */
export type PlacementStrength = 'spawn-call' | 'named-in-spawning-script';

export interface PlacementEvidence {
  strength: PlacementStrength;
  scripts: string[];
  /** Actor labels a script gives this class (the registered name's last segment). Heuristic binding. */
  labels: string[];
}

/** Blank Python comments and triple-quoted strings (docstrings), keep one-line strings and newlines. */
function stripPython(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '#') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (c === '"' || c === "'") {
      if (src.startsWith(c.repeat(3), i)) {
        const end = src.indexOf(c.repeat(3), i + 3);
        const stop = end < 0 ? n : end + 3;
        out += src.slice(i, stop).replace(/[^\n]/g, ' ');
        i = stop;
      } else {
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== '\n') {
          if (src[j] === '\\') j++;
          j++;
        }
        out += src.slice(i, Math.min(j + 1, n));
        i = j + 1;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** UE's Python exposes `AVSFooTest` as `unreal.VSFooTest`: the one leading `A` is dropped. */
export function stripActorPrefix(className: string): string {
  return /^A[A-Z]/.test(className) ? className.slice(1) : className;
}

export function scanPlacementEvidence(
  scripts: readonly SourceFile[],
  tests: readonly DeclaredTest[],
): Map<string, PlacementEvidence> {
  const actors = tests.filter((t) => t.kind === 'functional-actor');
  const out = new Map<string, PlacementEvidence>();
  const refs = actors.map((t) => {
    const py = stripActorPrefix(t.className);
    const ref = `(?:unreal\\.${escapeRe(py)}\\b|["']/Script/\\w+\\.(?:${escapeRe(py)}|${escapeRe(t.className)})["'])`;
    return { t, py, ref, refRe: new RegExp(ref) };
  });

  for (const s of scripts) {
    const code = stripPython(s.text);
    const spawnRe = /spawn_actor_from_class\s*\(\s*([\w.]+)/g;
    const hasSpawn = /\bspawn_actor_from_class\s*\(/.test(code);
    if (!hasSpawn) continue;

    // One level of aliasing is enough for the shapes the placement scripts use:
    //   CLS = "/Script/PoF.X"      cls = unreal.load_class(None, CLS)
    const aliases = new Map<string, string>();
    for (let pass = 0; pass < 3; pass++) {
      for (const line of code.split('\n')) {
        const a = /^\s*(\w+)\s*=\s*(.+)$/.exec(line);
        if (!a || aliases.has(a[1])) continue;
        const direct = refs.find((r) => r.refRe.test(a[2]));
        if (direct) aliases.set(a[1], direct.t.className);
        else {
          const via = [...aliases.keys()].find((k) => new RegExp(`\\b${escapeRe(k)}\\b`).test(a[2]));
          if (via) aliases.set(a[1], aliases.get(via)!);
        }
      }
    }

    const hit = new Map<string, { strength: PlacementStrength; labels: Set<string> }>();
    const note = (cls: string, strength: PlacementStrength, label?: string) => {
      const cur = hit.get(cls) ?? { strength, labels: new Set<string>() };
      if (strength === 'spawn-call') cur.strength = 'spawn-call';
      if (label) cur.labels.add(label);
      hit.set(cls, cur);
    };

    for (const r of refs) if (r.refRe.test(code)) note(r.t.className, 'named-in-spawning-script');

    for (const m of code.matchAll(spawnRe)) {
      const arg = m[1];
      const direct = refs.find((r) => arg === `unreal.${r.py}`);
      const cls = direct ? direct.t.className : aliases.get(arg);
      if (!cls) continue;
      note(cls, 'spawn-call');
      const open = (m.index ?? 0) + m[0].indexOf('(');
      const close = matchingParen(code, open);
      const chained = close < 0 ? null : /^\s*\.set_actor_label\(\s*["']([^"']+)["']/.exec(code.slice(close + 1, close + 120));
      if (chained) note(cls, 'spawn-call', chained[1]);
      const lineStart = code.lastIndexOf('\n', m.index ?? 0) + 1;
      const assigned = /(\w+)\s*=\s*[\w.]*$/.exec(code.slice(lineStart, m.index ?? 0));
      if (assigned && close >= 0) {
        const lbl = new RegExp(`\\b${escapeRe(assigned[1])}\\.set_actor_label\\(\\s*["']([^"']+)["']`).exec(code.slice(close));
        if (lbl) note(cls, 'spawn-call', lbl[1]);
      }
    }

    // A table row `(<class ref>, "Label", ...)` binds the label to the class on the same row.
    for (const r of refs) {
      for (const row of code.matchAll(new RegExp(`${r.ref}\\s*,\\s*["']([A-Za-z_]\\w*)["']`, 'g'))) {
        if (hit.has(r.t.className)) note(r.t.className, 'named-in-spawning-script', row[1]);
      }
    }

    for (const [cls, h] of hit) {
      const cur = out.get(cls);
      if (!cur) out.set(cls, { strength: h.strength, scripts: [s.path], labels: [...h.labels] });
      else {
        if (h.strength === 'spawn-call') cur.strength = 'spawn-call';
        cur.scripts.push(s.path);
        for (const l of h.labels) if (!cur.labels.includes(l)) cur.labels.push(l);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// (iv) Classifier
// ---------------------------------------------------------------------------------------------

export type ReachabilityClass =
  | 'reachable'
  | 'class-without-registered-name'
  | 'registered-name-without-class'
  | 'functional-test-with-no-placement-evidence'
  | 'unknown-no-list-supplied';

export type ReachableVia =
  | 'verdict-in-last-drain'
  | 'registered-name'
  | 'registered-label-from-script'
  | 'registered-label-equals-class-name';

export interface Finding {
  classification: ReachabilityClass;
  /** Absent for `registered-name-without-class`. */
  className?: string;
  kind?: DeclaredKind;
  file?: string;
  /** The registered name, for `registered-name-without-class`. */
  registeredName?: string;
  via?: ReachableVia;
  /** Registered names that matched this class. */
  matched?: string[];
  placement?: PlacementEvidence;
  detail: string;
}

/** The shape of `DrainSummary.results` this audit reads. Structural, so no runner import is needed. */
export interface LastDrain {
  results: { job: { testName?: string }; verdict?: { status: string } }[];
}

export type AuditStatus =
  | 'clean'
  | 'findings'
  | 'no-list'
  | 'empty-list'
  | 'truncated-list'
  | 'no-classes';

export interface ReachabilityInput {
  /** C++ sources (`.h` and `.cpp`) under the test tree. */
  sources: readonly SourceFile[];
  /** Placement scripts (`.py`). */
  scripts?: readonly SourceFile[];
  /** The captured log of `Automation List`. Missing or blank is a loud `no-list`, never a clean pass. */
  listText?: string | null;
  /** The last drain. A test with a pass or fail verdict in it ran, so it is never flagged. */
  lastDrain?: LastDrain | null;
  /** Registered-name prefixes this project owns. Names outside them (engine tests) are not audited. */
  scopePrefixes?: readonly string[];
  functionalRoots?: readonly string[];
}

export const DEFAULT_SCOPE_PREFIXES: readonly string[] = [
  'Project.Functional Tests.Maps.',
  'Project.Functional Tests.PoF.',
];

export interface ReachabilityReport {
  status: AuditStatus;
  /** Why the status cannot be read as a verdict, one line each. Empty only for `clean` and `findings`. */
  loud: string[];
  warnings: string[];
  examined: {
    sourceFiles: number;
    scripts: number;
    declaredTests: number;
    byKind: Record<DeclaredKind, number>;
    abstractSkipped: number;
    otherClasses: number;
    unparsedMacros: number;
    registeredNames: number;
    registeredInScope: number;
    declaredCountInLog: number | null;
    drainVerdicts: number;
    drainNamesUnmatched: string[];
  };
  counts: Record<ReachabilityClass, number>;
  findings: Finding[];
}

const segs = (s: string) => s.toLowerCase().split('.');
function hasRun(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length && ok; j++) ok = hay[i + j] === needle[j];
    if (ok) return true;
  }
  return false;
}
/**
 * Does a name a gate asked for cover a candidate name of a class? Whole dotted segments only, either
 * direction: the runner's request `PoF.GenFireball` covers `Project.Functional Tests.PoF.GenFireball.
 * EffectConfig`, and a full path covers its leaf label. `Fire` never covers `Fireball`. A request that
 * is one broad segment (`PoF`) covers everything it names: that errs toward NOT flagging a test that
 * may have run, which is the side the floor protects.
 */
function covers(requested: string, candidate: string): boolean {
  const r = segs(requested);
  const c = segs(candidate);
  return hasRun(c, r) || hasRun(r, c);
}

export function drainVerdictNames(drain: LastDrain | null | undefined): string[] {
  const names = new Set<string>();
  for (const r of drain?.results ?? []) {
    const status = r.verdict?.status;
    if ((status === 'pass' || status === 'fail') && r.job.testName?.trim()) names.add(r.job.testName.trim());
  }
  return [...names];
}

const leafOf = (name: string) => name.slice(name.lastIndexOf('.') + 1);

export function auditReachability(input: ReachabilityInput): ReachabilityReport {
  const scope = input.scopePrefixes ?? DEFAULT_SCOPE_PREFIXES;
  const scripts = input.scripts ?? [];
  const list = parseAutomationList(input.listText);
  const listSupplied = list.names.length > 0;
  const registered = new Set(list.names);
  const decl = scanDeclaredTests(input.sources, { functionalRoots: input.functionalRoots });
  const placement = scanPlacementEvidence(scripts, decl.tests);
  const verdictNames = drainVerdictNames(input.lastDrain);
  const warnings: string[] = [];
  const findings: Finding[] = [];
  const usedVerdicts = new Set<string>();
  const claimed = new Set<string>();

  const byKind: Record<DeclaredKind, number> = { simple: 0, complex: 0, spec: 0, 'functional-actor': 0 };
  for (const t of decl.tests) byKind[t.kind]++;

  const functionalRoot = 'Project.Functional Tests.';
  // A name a macro test declares is that test's, even when its last segment equals an actor's label.
  const macroNames = new Set(decl.tests.flatMap((t) => (t.registeredName ? [t.registeredName] : [])));
  for (const t of decl.tests) {
    const place = t.kind === 'functional-actor' ? placement.get(t.className) : undefined;
    const classLabel = stripActorPrefix(t.className);
    const scriptLabels = place?.labels ?? [];
    const labelSet = new Set([classLabel, ...scriptLabels]);

    // Names this class could be registered as, for matching a drain verdict.
    const candidates = t.kind === 'functional-actor' ? [...labelSet] : [t.registeredName ?? ''];

    // Which registered names belong to this class.
    let matched: string[] = [];
    let via: ReachableVia | undefined;
    if (t.kind === 'simple') {
      if (registered.has(t.registeredName ?? '')) {
        matched = [t.registeredName ?? ''];
        via = 'registered-name';
      }
    } else if (t.kind === 'complex' || t.kind === 'spec') {
      const p = t.registeredName ?? '';
      matched = list.names.filter((n) => n === p || n.startsWith(`${p}.`));
      if (matched.length) via = 'registered-name';
    } else {
      matched = list.names.filter((n) => n.startsWith(functionalRoot) && labelSet.has(leafOf(n)) && !macroNames.has(n));
      if (matched.length) via = matched.some((n) => scriptLabels.includes(leafOf(n))) ? 'registered-label-from-script' : 'registered-label-equals-class-name';
    }
    for (const n of matched) claimed.add(n);

    const base = { className: t.className, kind: t.kind, file: t.file, placement: place };

    // The floor: a pass or fail verdict in the last drain means the engine ran it. Never flagged.
    const verdict = verdictNames.find((v) => candidates.some((c) => c && covers(v, c)) || matched.some((m) => covers(v, m)));
    if (verdict) {
      usedVerdicts.add(verdict);
      if (listSupplied && !matched.length) {
        warnings.push(`${t.className} returned a verdict in the last drain ("${verdict}") but the supplied list does not carry it: the list is stale or incomplete`);
      }
      findings.push({ ...base, classification: 'reachable', via: 'verdict-in-last-drain', matched, detail: `returned a pass or fail verdict in the last drain ("${verdict}")` });
      continue;
    }

    if (!listSupplied) {
      if (t.kind === 'functional-actor' && !place) {
        findings.push({ ...base, classification: 'functional-test-with-no-placement-evidence', detail: 'no placement script names this class; a map may still hold it, placed by hand' });
      } else {
        findings.push({ ...base, classification: 'unknown-no-list-supplied', detail: 'no Automation List was supplied, so registration cannot be checked' });
      }
      continue;
    }

    if (matched.length && via) {
      findings.push({ ...base, classification: 'reachable', via, matched, detail: `registered as ${matched.length === 1 ? `"${matched[0]}"` : `${matched.length} names`}` });
    } else if (t.kind === 'functional-actor' && !place) {
      findings.push({ ...base, classification: 'functional-test-with-no-placement-evidence', detail: `the engine lists no test labelled "${classLabel}" and no placement script names the class: it may never have been placed in any saved map` });
    } else if (t.kind === 'functional-actor') {
      findings.push({ ...base, classification: 'class-without-registered-name', detail: `a placement script ${place!.strength === 'spawn-call' ? 'spawns' : 'names'} it (${place!.scripts.join(', ')}) but the engine lists no test for it: the script may not have run, the map was not saved, or the actor is disabled` });
    } else {
      findings.push({ ...base, classification: 'class-without-registered-name', detail: `declares "${t.registeredName}" and the engine does not list it: not compiled into the listed build, excluded by filter, or the list predates it` });
    }
  }

  // Registered names this project owns that no declared class accounts for.
  const inScope = list.names.filter((n) => scope.some((p) => n.startsWith(p)));
  for (const n of inScope) {
    if (claimed.has(n)) continue;
    findings.push({
      classification: 'registered-name-without-class',
      registeredName: n,
      detail: scripts.length
        ? 'no scanned C++ class declares or is labelled this name (a Blueprint test, an unscanned module, or a label no script binds)'
        : 'no scanned C++ class declares or is labelled this name; no placement scripts were supplied, so a label cannot be bound to a class',
    });
  }

  const unmatched = verdictNames.filter((v) => !usedVerdicts.has(v));
  const counts: Record<ReachabilityClass, number> = {
    reachable: 0,
    'class-without-registered-name': 0,
    'registered-name-without-class': 0,
    'functional-test-with-no-placement-evidence': 0,
    'unknown-no-list-supplied': 0,
  };
  for (const f of findings) counts[f.classification]++;

  if (decl.unparsedMacros.length) warnings.push(`${decl.unparsedMacros.length} test macro(s) could not be read and are not audited (first: ${decl.unparsedMacros[0].file})`);
  if (decl.duplicateNames.length) warnings.push(`registered name declared more than once: ${decl.duplicateNames.join(', ')}`);
  if (listSupplied && list.duplicates) warnings.push(`${list.duplicates} duplicate name line(s) in the list`);
  if (listSupplied && list.declaredCounts.length === 0) warnings.push('the list has no `Found N Automation Tests` header, so its completeness is unproven');
  if (scripts.length === 0 && byKind['functional-actor'] > 0) warnings.push('no placement scripts supplied: a functional test cannot show placement evidence, so none is credited');

  const loud: string[] = [];
  let status: AuditStatus;
  if (!input.listText || !input.listText.trim()) {
    status = 'no-list';
    loud.push('no Automation List was supplied: 0 registered names examined, so no class is reported reachable or unreachable from the engine\'s side');
  } else if (!listSupplied) {
    status = 'empty-list';
    loud.push('the supplied text holds no registered test name (no quoted `LogAutomationCommandLine` line): not an Automation List capture, or the capture is empty');
  } else if (list.truncated) {
    status = 'truncated-list';
    loud.push(`the list is cut or interleaved: its header(s) declare ${list.declaredCounts.join(' + ')} names but ${list.nameLines} were read; absent names below may be missing from the capture, not from the engine`);
  } else if (decl.tests.length === 0) {
    status = 'no-classes';
    loud.push('0 declared test classes were found in the supplied sources: the scan had nothing to audit, so an empty result proves nothing');
  } else {
    status = findings.some((f) => f.classification !== 'reachable') ? 'findings' : 'clean';
  }

  return {
    status,
    loud,
    warnings,
    examined: {
      sourceFiles: decl.filesScanned,
      scripts: scripts.length,
      declaredTests: decl.tests.length,
      byKind,
      abstractSkipped: decl.abstractSkipped.length,
      otherClasses: decl.otherClasses,
      unparsedMacros: decl.unparsedMacros.length,
      registeredNames: list.names.length,
      registeredInScope: inScope.length,
      declaredCountInLog: list.declaredCounts.length ? list.declaredCounts[list.declaredCounts.length - 1] : null,
      drainVerdicts: verdictNames.length,
      drainNamesUnmatched: unmatched,
    },
    counts,
    findings,
  };
}

/** Plain-text report. The input accounting comes first, so a verdict never appears without its proof of input. */
export function formatReachabilityReport(r: ReachabilityReport): string {
  const e = r.examined;
  const lines: string[] = [];
  lines.push(`reachability audit: ${r.status.toUpperCase()}${r.loud.length ? ' (NOT A VERDICT)' : ''}`);
  lines.push(
    `examined: ${e.declaredTests} declared test classes (simple ${e.byKind.simple}, complex ${e.byKind.complex}, spec ${e.byKind.spec}, functional ${e.byKind['functional-actor']}; ${e.abstractSkipped} abstract skipped, ${e.otherClasses} other classes ignored) from ${e.sourceFiles} C++ files; ${e.scripts} placement scripts; ${e.registeredNames} registered names (${e.registeredInScope} in this project's namespaces); ${e.drainVerdicts} pass/fail verdicts in the last drain`,
  );
  for (const l of r.loud) lines.push(`!! ${l}`);
  for (const w of r.warnings) lines.push(`warning: ${w}`);
  lines.push(
    `counts: reachable ${r.counts.reachable} | class-without-registered-name ${r.counts['class-without-registered-name']} | registered-name-without-class ${r.counts['registered-name-without-class']} | functional-test-with-no-placement-evidence ${r.counts['functional-test-with-no-placement-evidence']} | unknown-no-list-supplied ${r.counts['unknown-no-list-supplied']}`,
  );
  const order: ReachabilityClass[] = ['class-without-registered-name', 'functional-test-with-no-placement-evidence', 'registered-name-without-class', 'unknown-no-list-supplied'];
  for (const c of order) {
    const group = r.findings.filter((f) => f.classification === c);
    if (!group.length) continue;
    lines.push(`-- ${c} (${group.length})`);
    for (const f of group) lines.push(`   ${f.className ?? f.registeredName}${f.file ? ` [${f.file}]` : ''}: ${f.detail}`);
  }
  return lines.join('\n');
}
