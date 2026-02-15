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
  /** UFUNCTION declarations */
  functions: string[];
  /** Raw component pointer types found (e.g., "UCharacterMovementComponent") */
  componentTypes: string[];
  /** Line count of the class body (rough complexity indicator) */
  bodyLineCount: number;
}

export interface ParsedMember {
  name: string;
  type: string;
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

/** Match UPROPERTY with type and name */
const PROPERTY_REGEX = /UPROPERTY\s*\([^)]*\)\s*\n?\s*(?:(?:const\s+)?(\w[\w<>,\s*&]+?)\s+(\w+)\s*(?:=|;|\{))/g;

/** Simpler fallback: pointer members that look like UE components */
const COMPONENT_PTR_REGEX = /\b(U\w+Component)\s*\*\s+(\w+)/g;

/** Match UFUNCTION declarations */
const UFUNCTION_REGEX = /UFUNCTION\s*\([^)]*\)\s*\n?\s*(?:virtual\s+)?(?:static\s+)?(?:FORCEINLINE\s+)?(\w[\w<>,\s*&]*?)\s+(\w+)\s*\(/g;

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

    // Extract UPROPERTY members
    const properties: ParsedMember[] = [];
    PROPERTY_REGEX.lastIndex = 0;
    let pm;
    while ((pm = PROPERTY_REGEX.exec(body)) !== null) {
      properties.push({ type: pm[1].trim(), name: pm[2] });
    }

    // Extract component pointers (even without UPROPERTY)
    const componentTypes: string[] = [];
    COMPONENT_PTR_REGEX.lastIndex = 0;
    while ((pm = COMPONENT_PTR_REGEX.exec(body)) !== null) {
      if (!componentTypes.includes(pm[1])) {
        componentTypes.push(pm[1]);
      }
    }

    // Extract UFUNCTION names
    const functions: string[] = [];
    UFUNCTION_REGEX.lastIndex = 0;
    while ((pm = UFUNCTION_REGEX.exec(body)) !== null) {
      functions.push(pm[2]);
    }

    classes.push({
      name: className,
      kind: cleaned.slice(m.index).startsWith('USTRUCT') ? 'struct' : 'class',
      baseClass,
      properties,
      functions,
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
