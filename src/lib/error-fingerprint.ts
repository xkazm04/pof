/**
 * Error Fingerprinting Engine
 *
 * Takes raw build diagnostics (from UE5BuildParser) and produces fingerprinted
 * error records for storage in the error memory DB.
 *
 * Fingerprinting strips variable parts (line numbers, full paths, template args)
 * so that the same root error produces the same fingerprint across sessions.
 */

import type { FingerprintedError, ErrorCategory } from '@/types/error-memory';

// ── Pattern matchers for categorization ─────────────────────────────────────

const CATEGORY_PATTERNS: { pattern: RegExp; category: ErrorCategory; extractPattern: (m: RegExpMatchArray, msg: string) => string; extractFix: (m: RegExpMatchArray, msg: string) => string }[] = [
  // Missing #include
  {
    pattern: /cannot open (?:source|include) file[:\s]*['"]?([^'">\s]+\.h)['"]?/i,
    category: 'missing-include',
    extractPattern: (m) => m[1],
    extractFix: (m) => `Always include ${m[1]} when using its types`,
  },
  {
    pattern: /(?:undeclared identifier|use of undeclared identifier|is not a member of|no type named)\s*['"]?(\w+)['"]?/i,
    category: 'missing-include',
    extractPattern: (m) => m[1],
    extractFix: (m) => `Include the header that declares "${m[1]}"`,
  },
  {
    pattern: /'(\w+)'\s*:\s*(?:undeclared identifier|is not a (?:class|struct|type))/i,
    category: 'missing-include',
    extractPattern: (m) => m[1],
    extractFix: (m) => `Include the header for "${m[1]}" or add a forward declaration`,
  },
  // Unresolved external / linker
  {
    pattern: /unresolved external symbol\s*"[^"]*(\w+)@/i,
    category: 'unresolved-external',
    extractPattern: (m) => m[1],
    extractFix: (m) => `Add the module containing "${m[1]}" to Build.cs dependencies`,
  },
  {
    pattern: /unresolved external symbol\s+"[^"]*?(\w+)\s*\(/i,
    category: 'unresolved-external',
    extractPattern: (m) => m[1],
    extractFix: (m) => `Ensure "${m[1]}" is defined (not just declared) and its module is in Build.cs`,
  },
  {
    pattern: /LNK2019/,
    category: 'unresolved-external',
    extractPattern: (_m, msg) => {
      const sym = msg.match(/symbol\s+"[^"]*?(\w+)\s*\(/);
      return sym ? sym[1] : 'unresolved symbol';
    },
    extractFix: () => 'Check Build.cs dependencies and ensure the function is defined, not just declared',
  },
  // GC / UPROPERTY issues
  {
    pattern: /(?:UPROPERTY|Garbage Collection|GC).*(?:error|missing|invalid)/i,
    category: 'gc-issue',
    extractPattern: (_m, msg) => msg.slice(0, 60),
    extractFix: () => 'Mark UObject pointers with UPROPERTY() to prevent GC collection',
  },
  {
    pattern: /(?:raw pointer|non-UPROPERTY).*(?:UObject|AActor|UActorComponent)/i,
    category: 'gc-issue',
    extractPattern: (_m, msg) => msg.slice(0, 60),
    extractFix: () => 'Use UPROPERTY() on all UObject* members to register with GC',
  },
  // Missing module dependency
  {
    pattern: /module ['"](\w+)['"] (?:is )?not found|cannot find module ['"](\w+)['"]/i,
    category: 'missing-module-dep',
    extractPattern: (m) => m[1] || m[2],
    extractFix: (m) => `Add "${m[1] || m[2]}" to PublicDependencyModuleNames in Build.cs`,
  },
  // UCLASS macro issues
  {
    pattern: /UCLASS|GENERATED_BODY|GENERATED_UCLASS_BODY/,
    category: 'uclass-macro',
    extractPattern: (_m, msg) => msg.slice(0, 60),
    extractFix: () => 'Ensure UCLASS() macro and GENERATED_BODY() are present and correct',
  },
  // .generated.h issues
  {
    pattern: /\.generated\.h/i,
    category: 'generated-header',
    extractPattern: (_m, msg) => msg.slice(0, 60),
    extractFix: () => '#include "ClassName.generated.h" must be the last include in the header',
  },
  // Type mismatch
  {
    pattern: /cannot convert from ['"]?(\w+)['"]? to ['"]?(\w+)['"]?/i,
    category: 'type-mismatch',
    extractPattern: (m) => `${m[1]} → ${m[2]}`,
    extractFix: (m) => `Cast or convert from ${m[1]} to ${m[2]} explicitly`,
  },
  // Forward declaration
  {
    pattern: /incomplete type ['"]?(\w+)['"]?/i,
    category: 'forward-declaration',
    extractPattern: (m) => m[1],
    extractFix: (m) => `Include the full header for "${m[1]}" instead of just forward-declaring it`,
  },
  // Linker duplicate
  {
    pattern: /LNK2005|already defined in/i,
    category: 'linker-duplicate',
    extractPattern: (_m, msg) => {
      const sym = msg.match(/(?:symbol|function)\s+"?(\w+)/);
      return sym ? sym[1] : 'duplicate symbol';
    },
    extractFix: () => 'Move the definition to a .cpp file or mark inline',
  },
  // Access specifier
  {
    pattern: /(?:cannot access|is (?:a )?private|is (?:a )?protected) member/i,
    category: 'access-specifier',
    extractPattern: (_m, msg) => msg.slice(0, 60),
    extractFix: () => 'Check access specifiers — use public/protected as needed or add friend/getter',
  },
];

// ── Simple hash function ────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ── Normalize an error message for fingerprinting ───────────────────────────

function normalizeForFingerprint(message: string): string {
  return message
    .replace(/\b[A-Z]:\\[^\s:'"]+/g, 'FILE')     // Strip full Windows paths
    .replace(/\/[^\s:'"]+/g, 'FILE')               // Strip Unix paths
    .replace(/\(\d+(?:,\d+)?\)/g, '(LINE)')       // Strip line numbers
    .replace(/:\d+:\d+:/g, ':LINE:COL:')           // Strip Clang line:col
    .replace(/0x[0-9A-Fa-f]+/g, 'ADDR')           // Strip hex addresses
    .replace(/<[^>]+>/g, '<T>')                     // Normalize template args
    .replace(/\s+/g, ' ')                          // Normalize whitespace
    .trim()
    .toLowerCase();
}

// ── Main fingerprint function ───────────────────────────────────────────────

export function fingerprintError(
  message: string,
  errorCode: string | null,
  file: string | null,
): FingerprintedError {
  // Try each category pattern
  for (const rule of CATEGORY_PATTERNS) {
    const match = message.match(rule.pattern);
    if (match) {
      const pattern = rule.extractPattern(match, message);
      const fix = rule.extractFix(match, message);
      const normalized = normalizeForFingerprint(`${rule.category}:${pattern}`);
      const fingerprint = `${rule.category}-${simpleHash(normalized)}`;

      return {
        fingerprint,
        category: rule.category,
        errorCode,
        pattern,
        message: message.slice(0, 200),
        file: file ? normalizeFilePath(file) : null,
        fixDescription: fix,
      };
    }
  }

  // Fallback: generic categorization by error code
  let category: ErrorCategory = 'other';
  if (errorCode) {
    if (errorCode.startsWith('LNK')) category = 'unresolved-external';
    else if (errorCode.startsWith('C2')) category = 'syntax';
  }

  const normalized = normalizeForFingerprint(`${category}:${errorCode || ''}:${message.slice(0, 80)}`);
  return {
    fingerprint: `${category}-${simpleHash(normalized)}`,
    category,
    errorCode,
    pattern: message.slice(0, 60),
    message: message.slice(0, 200),
    file: file ? normalizeFilePath(file) : null,
    fixDescription: errorCode ? `Fix ${errorCode}: ${message.slice(0, 80)}` : message.slice(0, 80),
  };
}

/**
 * Fingerprint multiple raw error entries from the build parser.
 */
export function fingerprintErrors(
  errors: { message: string; code: string | null; file: string | null }[],
): FingerprintedError[] {
  const seen = new Set<string>();
  const results: FingerprintedError[] = [];

  for (const err of errors) {
    const fp = fingerprintError(err.message, err.code, err.file);
    if (!seen.has(fp.fingerprint)) {
      seen.add(fp.fingerprint);
      results.push(fp);
    }
  }

  return results;
}

/**
 * Extract task-relevant keywords from a prompt or task description.
 * Used for matching errors to the current task context.
 */
export function extractTaskKeywords(prompt: string): string[] {
  // UE5-specific keywords worth matching
  const ueKeywords = new Set([
    'gas', 'ability', 'attribute', 'gameplay', 'effect', 'tag',
    'character', 'controller', 'component', 'actor', 'pawn',
    'animation', 'montage', 'anim', 'blueprint', 'notify',
    'widget', 'umg', 'hud', 'slate', 'ui',
    'input', 'enhanced', 'action', 'mapping',
    'navigation', 'eqs', 'behavior', 'tree', 'perception',
    'replication', 'rpc', 'server', 'client', 'multicast',
    'save', 'load', 'serialize',
    'collision', 'physics', 'trace', 'overlap',
    'inventory', 'item', 'loot', 'equipment',
    'combat', 'damage', 'health', 'attack',
    'spawn', 'pool', 'level', 'streaming',
  ]);

  const words = prompt.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Return UE keywords found + any PascalCase/CamelCase identifiers
  const found: string[] = [];
  const seen = new Set<string>();

  for (const w of words) {
    if (ueKeywords.has(w) && !seen.has(w)) {
      seen.add(w);
      found.push(w);
    }
  }

  // Also extract PascalCase class names from original prompt
  const classNames = prompt.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) ?? [];
  for (const cn of classNames) {
    const lower = cn.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      found.push(lower);
    }
  }

  return found.slice(0, 15); // Cap at 15 keywords
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeFilePath(file: string): string {
  // Strip to just the filename or Source-relative path
  const sourceIdx = file.indexOf('Source');
  if (sourceIdx >= 0) return file.slice(sourceIdx).replace(/\\/g, '/');
  // Just return the filename
  const parts = file.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}
