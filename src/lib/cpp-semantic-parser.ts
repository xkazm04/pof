/**
 * Regex-based C++ header parser for UE5 classes.
 *
 * Extracts class declarations, base classes, UPROPERTY member variables,
 * component pointer types, and UFUNCTION signatures from .h files.
 * Used by the semantic verifier to determine whether a class is fully
 * implemented or just a hollow stub.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ParsedClass {
  name: string;
  kind: 'class' | 'struct';
  baseClass: string | null;
  /** UPROPERTY members — name and type */
  properties: ParsedMember[];
  /**
   * UFUNCTION declaration NAMES only. Kept as the historical accessor for the
   * semantic verifier; `functionSignatures` carries the same functions with
   * their return type and parameters.
   */
  functions: string[];
  /**
   * UFUNCTION declarations with their full signature. Additive companion to
   * `functions` — every entry here has its name in `functions`, in order.
   */
  functionSignatures: ParsedFunction[];
  /** Raw component pointer types found (e.g., "UCharacterMovementComponent") */
  componentTypes: string[];
  /** Line count of the class body (rough complexity indicator) */
  bodyLineCount: number;
}

export interface ParsedMember {
  name: string;
  type: string;
  /**
   * Top-level `UPROPERTY(...)` specifiers as written, e.g.
   * `['EditAnywhere', 'Replicated', 'Category = "Stats"']`. Empty when the
   * member was found without a UPROPERTY macro.
   */
  specifiers: string[];
}

/** A single parameter of a parsed C++ function. `name` is '' when unnamed. */
export interface ParsedParam {
  type: string;
  name: string;
}

/** A UFUNCTION declaration with its full (declared) signature. */
export interface ParsedFunction {
  name: string;
  /** Declared return type, e.g. 'void', 'float', 'TArray<int32>'. */
  returnType: string;
  params: ParsedParam[];
  /** Top-level `UFUNCTION(...)` specifiers as written. */
  specifiers: string[];
}

export interface HeaderParseResult {
  filePath: string;
  classes: ParsedClass[];
  includes: string[];
  forwardDeclarations: string[];
}

// ── Regex patterns ──────────────────────────────────────────────────────────

/** Match UCLASS/USTRUCT declaration and capture class name + base class */
const CLASS_REGEX = /U(?:CLASS|STRUCT)\s*\([^)]*\)\s*(?:class|struct)\s+(?:\w+_API\s+)?(\w+)\s*(?::\s*public\s+(\w+))?/g;

/** Simpler fallback: pointer members that look like UE components */
const COMPONENT_PTR_REGEX = /\b(U\w+Component)\s*\*\s+(\w+)/g;

/** Match #include directives */
const INCLUDE_REGEX = /#include\s+["<]([^">]+)[">]/g;

/** Forward declarations: class Foo; */
const FORWARD_DECL_REGEX = /^class\s+(\w+)\s*;/gm;

// ── Strip comments ──────────────────────────────────────────────────────────

function stripComments(source: string): string {
  // Remove single-line comments
  let result = source.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

// ── Extract class body ──────────────────────────────────────────────────────

/**
 * Given source and a match position after the class declaration,
 * find the matching closing brace and return the body content.
 */
function extractClassBody(source: string, startSearchPos: number): { body: string; endPos: number } | null {
  let depth = 0;
  let bodyStart = -1;

  for (let i = startSearchPos; i < source.length; i++) {
    if (source[i] === '{') {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0 && bodyStart >= 0) {
        return { body: source.slice(bodyStart, i), endPos: i };
      }
    }
  }
  return null;
}

// ── Macro / declaration scanning ────────────────────────────────────────────

/**
 * Index of the `)` that closes the `(` at `openIdx`, or -1. Nested parens are
 * matched, so `UPROPERTY(meta = (ClampMin = "0"))` is read whole — the old
 * `\([^)]*\)` regexes silently dropped every such member.
 */
function matchParen(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split on commas that are not nested inside (), <> or []. */
function splitTopLevel(src: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(' || ch === '<' || ch === '[') depth++;
    else if (ch === ')' || ch === '>' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(src.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

const DECL_KEYWORDS = /\b(?:virtual|static|inline|explicit|mutable|constexpr|FORCEINLINE|friend)\b/g;

/**
 * Split a declaration like `TArray<int32> Scores` or `UStaticMeshComponent* Mesh`
 * into its type and trailing identifier. Returns a nameless entry (`name: ''`)
 * for a type-only declaration such as an unnamed parameter `float`.
 */
function parseDeclaration(decl: string): ParsedParam {
  const cleaned = decl.replace(DECL_KEYWORDS, ' ').replace(/\s+/g, ' ').trim();
  // The name must be preceded by a separator (space, `*` or `&`) so a bare
  // type ("float") is never sliced into "f" + "loat".
  const m = /^([\s\S]+?[\s*&])\s*([A-Za-z_]\w*)$/.exec(cleaned);
  if (!m) return { type: cleaned, name: '' };
  return { type: m[1].trim(), name: m[2] };
}

/** Every occurrence of `macro` in `body`, with its balanced specifier list and
 *  the declaration text that follows it (up to `;`, `{` or `=`). */
function scanMacro(body: string, macro: string): { specifiers: string[]; decl: string }[] {
  const out: { specifiers: string[]; decl: string }[] = [];
  const re = new RegExp(`\\b${macro}\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const open = body.indexOf('(', m.index);
    const close = matchParen(body, open);
    if (close < 0) break;
    const specifiers = splitTopLevel(body.slice(open + 1, close));
    // Declaration runs to the statement/body terminator. `=` also ends it, so
    // an initialiser (`= 100.f`) or a pure-virtual `= 0` is not read as type.
    let end = body.length;
    for (let i = close + 1; i < body.length; i++) {
      const ch = body[i];
      if (ch === ';' || ch === '{') { end = i; break; }
      if (ch === '=' && body[i + 1] !== '=') { end = i; break; }
      if (ch === '(') { i = matchParen(body, i); if (i < 0) { i = body.length; } }
    }
    out.push({ specifiers, decl: body.slice(close + 1, end).trim() });
    re.lastIndex = close;
  }
  return out;
}

function extractProperties(body: string): ParsedMember[] {
  const props: ParsedMember[] = [];
  for (const { specifiers, decl } of scanMacro(body, 'UPROPERTY')) {
    if (!decl) continue;
    const { type, name } = parseDeclaration(decl);
    if (!name || !type) continue;
    props.push({ name, type, specifiers });
  }
  return props;
}

function extractFunctions(body: string): ParsedFunction[] {
  const fns: ParsedFunction[] = [];
  for (const { specifiers, decl } of scanMacro(body, 'UFUNCTION')) {
    const open = decl.indexOf('(');
    if (open < 0) continue;
    const close = matchParen(decl, open);
    if (close < 0) continue;
    const head = parseDeclaration(decl.slice(0, open));
    if (!head.name) continue;
    const params = splitTopLevel(decl.slice(open + 1, close)).map(parseDeclaration);
    fns.push({ name: head.name, returnType: head.type || 'void', params, specifiers });
  }
  return fns;
}

/** True when `specifiers` carries `wanted` (specifier names are case-insensitive
 *  in practice and may be written `Name = Value`). */
export function hasSpecifier(specifiers: string[], wanted: string): boolean {
  const target = wanted.toLowerCase();
  return specifiers.some((s) => s.split('=')[0].trim().toLowerCase() === target);
}

// ── Main parser ─────────────────────────────────────────────────────────────

export function parseHeader(source: string, filePath: string = ''): HeaderParseResult {
  const cleaned = stripComments(source);
  const classes: ParsedClass[] = [];
  const includes: string[] = [];
  const forwardDeclarations: string[] = [];

  // Extract includes
  let m;
  INCLUDE_REGEX.lastIndex = 0;
  while ((m = INCLUDE_REGEX.exec(source)) !== null) {
    includes.push(m[1]);
  }

  // Forward declarations
  FORWARD_DECL_REGEX.lastIndex = 0;
  while ((m = FORWARD_DECL_REGEX.exec(cleaned)) !== null) {
    forwardDeclarations.push(m[1]);
  }

  // Extract classes
  CLASS_REGEX.lastIndex = 0;
  while ((m = CLASS_REGEX.exec(cleaned)) !== null) {
    const className = m[1];
    const baseClass = m[2] || null;
    const matchEnd = m.index + m[0].length;

    const bodyResult = extractClassBody(cleaned, matchEnd);
    if (!bodyResult) continue;

    const { body } = bodyResult;
    const bodyLineCount = body.split('\n').filter((l) => l.trim().length > 0).length;

    // Extract UPROPERTY members (with their specifiers)
    const properties = extractProperties(body);

    // Extract component pointers (even without UPROPERTY)
    const componentTypes: string[] = [];
    COMPONENT_PTR_REGEX.lastIndex = 0;
    let pm;
    while ((pm = COMPONENT_PTR_REGEX.exec(body)) !== null) {
      if (!componentTypes.includes(pm[1])) {
        componentTypes.push(pm[1]);
      }
    }

    // Extract UFUNCTION signatures; `functions` stays the name-only accessor.
    const functionSignatures = extractFunctions(body);

    classes.push({
      name: className,
      kind: cleaned.slice(m.index).startsWith('USTRUCT') ? 'struct' : 'class',
      baseClass,
      properties,
      functions: functionSignatures.map((f) => f.name),
      functionSignatures,
      componentTypes,
      bodyLineCount,
    });
  }

  return { filePath, classes, includes, forwardDeclarations };
}

// ── Semantic check ──────────────────────────────────────────────────────────

export interface SemanticExpectation {
  /** Class name to look for */
  className: string;
  /** Expected base class (optional) */
  baseClass?: string;
  /** Expected component types (pointer types like "USpringArmComponent") */
  expectedComponents?: string[];
  /** Expected UPROPERTY member names (partial match) */
  expectedProperties?: string[];
  /** Expected UFUNCTION names */
  expectedFunctions?: string[];
  /** Minimum body line count to not be considered a stub */
  minBodyLines?: number;
}

export interface SemanticResult {
  className: string;
  found: boolean;
  /** 0–1: ratio of expectations met */
  completeness: number;
  missingComponents: string[];
  missingProperties: string[];
  missingFunctions: string[];
  isStub: boolean;
  /** 'full' | 'partial' | 'stub' | 'missing' */
  status: 'full' | 'partial' | 'stub' | 'missing';
}

export function checkExpectations(
  parsed: HeaderParseResult,
  expectation: SemanticExpectation,
): SemanticResult {
  const cls = parsed.classes.find((c) => c.name === expectation.className);

  if (!cls) {
    return {
      className: expectation.className,
      found: false,
      completeness: 0,
      missingComponents: expectation.expectedComponents ?? [],
      missingProperties: expectation.expectedProperties ?? [],
      missingFunctions: expectation.expectedFunctions ?? [],
      isStub: false,
      status: 'missing',
    };
  }

  let totalExpectations = 0;
  let metExpectations = 0;

  // Check base class
  if (expectation.baseClass) {
    totalExpectations++;
    if (cls.baseClass === expectation.baseClass) metExpectations++;
  }

  // Check components
  const missingComponents: string[] = [];
  for (const comp of expectation.expectedComponents ?? []) {
    totalExpectations++;
    if (cls.componentTypes.includes(comp)) {
      metExpectations++;
    } else {
      missingComponents.push(comp);
    }
  }

  // Check properties
  const missingProperties: string[] = [];
  const allPropNames = cls.properties.map((p) => p.name.toLowerCase());
  const allPropTypes = cls.properties.map((p) => p.type.toLowerCase());
  for (const prop of expectation.expectedProperties ?? []) {
    totalExpectations++;
    // Match by name or type substring
    const lower = prop.toLowerCase();
    if (allPropNames.some((n) => n.includes(lower)) || allPropTypes.some((t) => t.includes(lower))) {
      metExpectations++;
    } else {
      missingProperties.push(prop);
    }
  }

  // Check functions
  const missingFunctions: string[] = [];
  const allFuncNames = cls.functions.map((f) => f.toLowerCase());
  for (const func of expectation.expectedFunctions ?? []) {
    totalExpectations++;
    if (allFuncNames.some((f) => f.includes(func.toLowerCase()))) {
      metExpectations++;
    } else {
      missingFunctions.push(func);
    }
  }

  // Stub detection
  const minLines = expectation.minBodyLines ?? 5;
  const isStub = cls.bodyLineCount < minLines;
  if (!isStub && totalExpectations > 0) {
    // Bonus for not being a stub
    totalExpectations++;
    metExpectations++;
  }

  const completeness = totalExpectations > 0 ? metExpectations / totalExpectations : (isStub ? 0.1 : 1.0);

  let status: SemanticResult['status'];
  if (isStub && completeness < 0.3) {
    status = 'stub';
  } else if (completeness >= 0.8) {
    status = 'full';
  } else {
    status = 'partial';
  }

  return {
    className: expectation.className,
    found: true,
    completeness,
    missingComponents,
    missingProperties,
    missingFunctions,
    isStub,
    status,
  };
}
