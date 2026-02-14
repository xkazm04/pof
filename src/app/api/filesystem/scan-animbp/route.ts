import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';

// ── Types ──

export interface AnimState {
  name: string;
  /** Whether a montage reference was found for this state */
  hasMontage: boolean;
  /** Montage variable or asset name if found */
  montageRef: string | null;
}

export interface AnimTransition {
  from: string;
  to: string;
  /** Transition rule snippet if found (e.g., "Speed > 0") */
  rule: string | null;
}

export interface AnimBPScanResult {
  scannedAt: string;
  /** AnimInstance class name (e.g., "UMyAnimInstance") */
  animInstanceClass: string | null;
  /** Header file path relative to Source/ */
  headerPath: string | null;
  /** States found in the state machine */
  states: AnimState[];
  /** Transitions found between states */
  transitions: AnimTransition[];
  /** Montage asset references found in the class */
  montageRefs: string[];
  /** Variables exposed for animation (Speed, Direction, etc.) */
  animVariables: string[];
  scanDurationMs: number;
}

// ── Helpers ──

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recursively collect all .h and .cpp files under a directory.
 */
async function collectSourceFiles(dir: string, extensions: string[], maxFiles = 500): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    if (results.length >= maxFiles) return;
    try {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) return;
        const full = path.join(current, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await walk(full);
        } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
          results.push(full);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  await walk(dir);
  return results;
}

/**
 * Extract AnimInstance subclass info from a header file.
 * Looks for classes inheriting from UAnimInstance.
 */
function extractAnimInstanceFromHeader(content: string): {
  className: string;
  variables: string[];
  montageRefs: string[];
} | null {
  // Match class declaration inheriting UAnimInstance
  const classMatch = content.match(
    /class\s+(?:\w+_API\s+)?(U\w+)\s*:\s*public\s+UAnimInstance/
  );
  if (!classMatch) return null;

  const className = classMatch[1];

  // Extract UPROPERTY variables that look like animation params
  const variables: string[] = [];
  const varRegex = /UPROPERTY\s*\([^)]*\)\s*(?:float|bool|int32|FVector|FRotator)\s+(\w+)/g;
  let varMatch;
  while ((varMatch = varRegex.exec(content)) !== null) {
    variables.push(varMatch[1]);
  }

  // Extract montage references
  const montageRefs: string[] = [];
  const montageRegex = /UPROPERTY\s*\([^)]*\)\s*(?:UAnimMontage\s*\*|TSoftObjectPtr\s*<\s*UAnimMontage\s*>)\s+(\w+)/g;
  let montageMatch;
  while ((montageMatch = montageRegex.exec(content)) !== null) {
    montageRefs.push(montageMatch[1]);
  }

  // Also check for montage pointers without UPROPERTY
  const rawMontageRegex = /UAnimMontage\s*\*\s+(\w+)/g;
  let rawMatch;
  while ((rawMatch = rawMontageRegex.exec(content)) !== null) {
    if (!montageRefs.includes(rawMatch[1])) {
      montageRefs.push(rawMatch[1]);
    }
  }

  return { className, variables, montageRefs };
}

/**
 * Extract state machine states from AnimBP-related code.
 *
 * UE5 state machines are typically defined in Blueprint AnimBPs, but
 * C++ code often references states via name strings and enums.
 * We look for:
 * 1. State name string constants
 * 2. Enum values for animation states
 * 3. Montage section names (which map to states)
 * 4. Comments/documentation describing states
 */
function extractStatesFromSource(content: string, montageRefs: string[]): {
  states: AnimState[];
  transitions: AnimTransition[];
} {
  const stateNames = new Set<string>();
  const transitions: AnimTransition[] = [];

  // Pattern 1: Explicit state name references in TEXT("StateName") or FName("StateName")
  const stateNameRegex = /(?:FName|TEXT)\s*\(\s*"(\w+)"\s*\)/g;
  let match;
  while ((match = stateNameRegex.exec(content)) !== null) {
    const name = match[1];
    // Filter to likely animation state names
    if (isLikelyStateName(name)) {
      stateNames.add(name);
    }
  }

  // Pattern 2: Montage section names via Montage_JumpToSection or GetSectionName
  const sectionRegex = /(?:JumpToSection|SetNextSection|GetSectionName|Montage_JumpToSection)\s*\(\s*(?:FName\s*\(\s*)?"(\w+)"/g;
  while ((match = sectionRegex.exec(content)) !== null) {
    stateNames.add(match[1]);
  }

  // Pattern 3: Enum-style animation state definitions
  const enumRegex = /(?:enum\s+(?:class\s+)?E\w*(?:Anim|State|Locomotion)\w*)[^{]*\{([^}]+)\}/g;
  while ((match = enumRegex.exec(content)) !== null) {
    const body = match[1];
    const enumValues = body.match(/(\w+)\s*(?:=\s*\d+)?\s*(?:,|$)/g);
    if (enumValues) {
      for (const ev of enumValues) {
        const name = ev.replace(/\s*=\s*\d+/, '').replace(/,/, '').trim();
        if (name && name !== 'MAX' && name !== 'Count' && !name.startsWith('//')) {
          stateNames.add(name);
        }
      }
    }
  }

  // Pattern 4: State transition rules in comments or code
  // e.g., "// Locomotion -> Attacking" or transitions defined as pairs
  const transitionCommentRegex = /\/\/\s*(\w+)\s*(?:->|→|to)\s*(\w+)/gi;
  while ((match = transitionCommentRegex.exec(content)) !== null) {
    const from = match[1];
    const to = match[2];
    if (isLikelyStateName(from) && isLikelyStateName(to)) {
      stateNames.add(from);
      stateNames.add(to);
      transitions.push({ from, to, rule: null });
    }
  }

  // Pattern 5: Well-known UE5 animation state names in string literals
  const knownStateRegex = /["'](?:Locomotion|Idle|Walk|Run|Sprint|Jump|JumpStart|JumpLoop|Falling|Fall|Landing|Land|Attacking|Attack|HitReact|Hit|Death|Dead|Dodge|Dodging|Block|Blocking|Stunned|Stun|Casting|Cast|Swimming|Climbing)["']/gi;
  while ((match = knownStateRegex.exec(content)) !== null) {
    const name = match[0].slice(1, -1); // Remove quotes
    stateNames.add(name);
  }

  // Build states list with montage association
  const montageRefLower = montageRefs.map((r) => r.toLowerCase());
  const states: AnimState[] = Array.from(stateNames).map((name) => {
    const nameLower = name.toLowerCase();
    const hasMontage = montageRefLower.some(
      (r) => r.includes(nameLower) || nameLower.includes(r.replace(/montage|anim|am_/gi, ''))
    );
    const montageRef = hasMontage
      ? montageRefs.find((r) => r.toLowerCase().includes(nameLower)) ?? null
      : null;
    return { name, hasMontage, montageRef };
  });

  return { states, transitions };
}

/**
 * Heuristic: is this string likely an animation state name?
 */
function isLikelyStateName(name: string): boolean {
  if (name.length < 3 || name.length > 30) return false;
  // Skip common non-state names
  const skipPatterns = /^(None|Default|Self|Owner|this|true|false|null|nullptr|NAME_|Get|Set|Is|Has|On|Do|Can)$/i;
  if (skipPatterns.test(name)) return false;
  // Skip all-caps constants that aren't state names
  if (/^[A-Z_]+$/.test(name) && name.length > 6) return false;
  return true;
}

// ── Main scan function ──

async function scanAnimBP(projectPath: string, moduleName: string): Promise<AnimBPScanResult> {
  const startTime = Date.now();
  const sourceRoot = path.join(projectPath, 'Source', moduleName);

  const result: AnimBPScanResult = {
    scannedAt: new Date().toISOString(),
    animInstanceClass: null,
    headerPath: null,
    states: [],
    transitions: [],
    montageRefs: [],
    animVariables: [],
    scanDurationMs: 0,
  };

  if (!(await directoryExists(sourceRoot))) {
    result.scanDurationMs = Date.now() - startTime;
    return result;
  }

  // Collect all source files
  const sourceFiles = await collectSourceFiles(sourceRoot, ['.h', '.cpp']);
  const sourceRootParent = path.join(projectPath, 'Source');

  // Read all files in parallel (batch of 20)
  const allContents: { path: string; content: string }[] = [];
  const batchSize = 20;
  for (let i = 0; i < sourceFiles.length; i += batchSize) {
    const batch = sourceFiles.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (fp) => {
        try {
          const content = await fs.readFile(fp, 'utf-8');
          return { path: fp, content };
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r) allContents.push(r);
    }
  }

  // Find the AnimInstance subclass
  for (const { path: fp, content } of allContents) {
    if (!fp.endsWith('.h')) continue;
    const animInfo = extractAnimInstanceFromHeader(content);
    if (animInfo) {
      result.animInstanceClass = animInfo.className;
      result.headerPath = path.relative(sourceRootParent, fp).replace(/\\/g, '/');
      result.animVariables = animInfo.variables;
      result.montageRefs.push(...animInfo.montageRefs);
      break; // Use the first AnimInstance found
    }
  }

  // Scan all files for state machine info and montage refs
  const allStates = new Map<string, AnimState>();
  const allTransitions: AnimTransition[] = [];

  for (const { content } of allContents) {
    // Collect additional montage refs from .cpp files
    const montageRegex = /UAnimMontage\s*\*\s+(\w+)/g;
    let m;
    while ((m = montageRegex.exec(content)) !== null) {
      if (!result.montageRefs.includes(m[1])) {
        result.montageRefs.push(m[1]);
      }
    }

    const { states, transitions } = extractStatesFromSource(content, result.montageRefs);
    for (const s of states) {
      const existing = allStates.get(s.name);
      if (!existing || (s.hasMontage && !existing.hasMontage)) {
        allStates.set(s.name, s);
      }
    }
    allTransitions.push(...transitions);
  }

  result.states = Array.from(allStates.values());
  // Deduplicate transitions
  const transSet = new Set<string>();
  for (const t of allTransitions) {
    const key = `${t.from}->${t.to}`;
    if (!transSet.has(key)) {
      transSet.add(key);
      result.transitions.push(t);
    }
  }

  result.scanDurationMs = Date.now() - startTime;
  return result;
}

// ── Route handler ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath, moduleName } = body;

    if (!projectPath || typeof projectPath !== 'string') {
      return apiError('projectPath is required', 400);
    }
    if (!moduleName || typeof moduleName !== 'string') {
      return apiError('moduleName is required', 400);
    }

    if (!(await directoryExists(projectPath))) {
      return apiError('Project path does not exist', 404);
    }

    const result = await scanAnimBP(projectPath, moduleName);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Internal server error');
  }
}
