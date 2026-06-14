import type { SubModuleId } from '@/types/modules';
import { MODULE_FEATURE_DEFINITIONS } from './feature-definitions';
import type { ExtractedEntity, StructuredInsight } from '@/types/structured-insights';

/**
 * Structured entity extraction — pulls rich entities (class hierarchies,
 * implementation steps, warnings, file paths, UE concepts) out of CLI
 * response text.
 *
 * This is the pure, in-memory extraction layer; persistence for the resulting
 * insights lives in `structured-insights-db.ts` (the `structured_insights`
 * table + save/get CRUD). Split out of `pattern-extractor.ts`, which keeps the
 * separate implementation-pattern / anti-pattern mining concern.
 */

// ── Class name extraction ────────────────────────────────────────────────────

const UE_CLASS_REGEX = /\b([AUF][A-Z][A-Za-z0-9]+(?:Component|Controller|Character|Base|Instance|System|Subsystem|Widget|Effect|Ability|Set|Asset|Manager|Volume)?)\b/g;

export function extractClasses(text: string): string[] {
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  UE_CLASS_REGEX.lastIndex = 0;
  while ((match = UE_CLASS_REGEX.exec(text)) !== null) {
    // Filter out common false positives
    const name = match[1];
    if (name.length >= 4 && !['ANSI', 'ASCII', 'ATTR', 'AUTO', 'UPROPERTY', 'UFUNCTION', 'UCLASS', 'USTRUCT', 'UENUM', 'UMETA', 'FORCEINLINE'].includes(name)) {
      matches.add(name);
    }
  }
  return [...matches].slice(0, 15);
}

// ── Class hierarchy extraction ───────────────────────────────────────────────

// Matches patterns like "AMyClass : public ACharacter" or "AMyClass extends ABase"
const INHERITANCE_REGEX = /\b([AUF][A-Z][A-Za-z0-9]+)\s*(?::\s*(?:public|protected|private)\s+|extends\s+)([AUF][A-Z][A-Za-z0-9]+)\b/g;

function extractClassHierarchy(text: string): { name: string; parent?: string }[] {
  const hierarchy = new Map<string, string | undefined>();

  // First pass: find explicit inheritance
  INHERITANCE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INHERITANCE_REGEX.exec(text)) !== null) {
    hierarchy.set(match[1], match[2]);
  }

  // Second pass: collect standalone class names not yet in hierarchy
  const allClasses = extractClasses(text);
  for (const cls of allClasses) {
    if (!hierarchy.has(cls)) {
      hierarchy.set(cls, undefined);
    }
  }

  return Array.from(hierarchy.entries())
    .map(([name, parent]) => ({ name, parent }))
    .slice(0, 20);
}

// ── Implementation step extraction ───────────────────────────────────────────

// Matches numbered step patterns: "1. Create...", "Step 1:", "- First, ..."
const STEP_PATTERNS = [
  /(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|\n\n|$)/g,           // "1. Do thing"
  /(?:^|\n)\s*(?:Step|Phase)\s+(\d+)[:.]\s*(.+?)(?=\n|$)/gi,     // "Step 1: Do thing"
];

const COMPLEXITY_HIGH_KEYWORDS = ['complex', 'difficult', 'advanced', 'extensive', 'significant', 'refactor', 'rewrite', 'redesign'];
const COMPLEXITY_LOW_KEYWORDS = ['simple', 'easy', 'basic', 'trivial', 'quick', 'minor', 'small', 'just'];

function estimateStepComplexity(text: string): 'low' | 'medium' | 'high' {
  const lower = text.toLowerCase();
  if (COMPLEXITY_HIGH_KEYWORDS.some((kw) => lower.includes(kw))) return 'high';
  if (COMPLEXITY_LOW_KEYWORDS.some((kw) => lower.includes(kw))) return 'low';
  // Longer descriptions tend to be more complex
  if (text.length > 200) return 'high';
  if (text.length < 60) return 'low';
  return 'medium';
}

function extractSteps(text: string): { order: number; description: string; complexity: 'low' | 'medium' | 'high' }[] {
  const steps: { order: number; description: string; complexity: 'low' | 'medium' | 'high' }[] = [];
  const seen = new Set<string>();

  for (const pattern of STEP_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const order = parseInt(match[1], 10);
      const description = match[2].trim().replace(/\*\*/g, '');
      const key = description.slice(0, 50).toLowerCase();
      if (!seen.has(key) && description.length > 5) {
        seen.add(key);
        steps.push({ order, description, complexity: estimateStepComplexity(description) });
      }
    }
  }

  return steps.sort((a, b) => a.order - b.order).slice(0, 15);
}

// ── Warning/caveat extraction ────────────────────────────────────────────────

const WARNING_PATTERNS = [
  /(?:⚠️|Warning|WARN|Caution|Note|Important|Be careful|Watch out|Caveat)[:\s]+(.+?)(?=\n\n|\n(?:⚠️|Warning|WARN|Caution|Note|Important|\d+\.)|\n$|$)/gi,
  /\*\*(?:Warning|Note|Important|Caution)\*\*[:\s]+(.+?)(?=\n\n|$)/gi,
];

function extractWarnings(text: string): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const pattern of WARNING_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const warning = match[1].trim().replace(/\*\*/g, '').slice(0, 300);
      const key = warning.slice(0, 40).toLowerCase();
      if (warning.length > 10 && !seen.has(key)) {
        seen.add(key);
        warnings.push(warning);
      }
    }
  }

  return warnings.slice(0, 10);
}

// ── File path extraction ─────────────────────────────────────────────────────

const FILE_PATH_REGEX = /(?:Source\/|Private\/|Public\/|Content\/)[\w/.-]+\.\w{1,5}/g;
const HEADER_INCLUDE_REGEX = /#include\s+["<]([\w/.-]+\.h)[">]/g;

function extractFilePaths(text: string): string[] {
  const paths = new Set<string>();

  FILE_PATH_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FILE_PATH_REGEX.exec(text)) !== null) {
    paths.add(match[0]);
  }

  HEADER_INCLUDE_REGEX.lastIndex = 0;
  while ((match = HEADER_INCLUDE_REGEX.exec(text)) !== null) {
    paths.add(match[1]);
  }

  return [...paths].slice(0, 20);
}

// ── Concept keyword extraction ───────────────────────────────────────────────

const UE_CONCEPTS = [
  'Gameplay Ability System', 'GAS', 'Behavior Tree', 'EQS', 'NavMesh',
  'Enhanced Input', 'Replication', 'RPC', 'GameplayEffect', 'GameplayCue',
  'Data Table', 'Data Asset', 'Subsystem', 'Blueprint', 'Widget',
  'Animation Blueprint', 'Montage', 'Blend Space', 'State Machine',
  'Collision Channel', 'Object Pool', 'Instanced Static Mesh',
  'Niagara', 'Material Instance', 'Post Process', 'Level Streaming',
  'World Partition', 'Gameplay Tag', 'Slate', 'UMG',
];

function extractConcepts(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const concept of UE_CONCEPTS) {
    if (lower.includes(concept.toLowerCase())) {
      found.push(concept);
    }
  }
  return found.slice(0, 10);
}

// ── Link entities to modules ─────────────────────────────────────────────────

/**
 * Lowercased feature corpus, precomputed once at module load.
 *
 * The match is fuzzy (substring in both directions + a description scan), so it
 * cannot be reduced to an exact-key Map. Instead we hoist the lowercasing out of
 * the per-entity hot path: each feature's name/description is lowercased a single
 * time here rather than re-lowercased on every `linkEntityToModule` call.
 *
 * Order is preserved exactly — `Object.entries(MODULE_FEATURE_DEFINITIONS)` module
 * order, then feature-array order within each module — so the first-match result
 * (and therefore every entity→module assignment) is byte-for-byte identical to the
 * previous nested-loop implementation; only redundant recomputation is removed.
 */
const FEATURE_MATCH_CORPUS: { moduleId: string; nameLower: string; descLower: string }[] = (() => {
  const corpus: { moduleId: string; nameLower: string; descLower: string }[] = [];
  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    for (const feat of features) {
      corpus.push({
        moduleId,
        nameLower: feat.featureName.toLowerCase(),
        descLower: feat.description.toLowerCase(),
      });
    }
  }
  return corpus;
})();

function linkEntityToModule(entity: string): string | undefined {
  const lower = entity.toLowerCase();
  for (const feat of FEATURE_MATCH_CORPUS) {
    if (
      feat.nameLower.includes(lower) ||
      lower.includes(feat.nameLower) ||
      feat.descLower.includes(lower)
    ) {
      return feat.moduleId;
    }
  }
  return undefined;
}

// ── Main structured extraction ───────────────────────────────────────────────

export function extractStructuredEntities(
  text: string,
  moduleId: SubModuleId,
  sessionId: string
): StructuredInsight {
  const classHierarchy = extractClassHierarchy(text);
  const steps = extractSteps(text);
  const warnings = extractWarnings(text);
  const filePaths = extractFilePaths(text);
  const concepts = extractConcepts(text);

  // Build entity list
  const entities: ExtractedEntity[] = [];

  for (const cls of classHierarchy) {
    entities.push({
      type: 'class',
      value: cls.name,
      parent: cls.parent,
      moduleId: linkEntityToModule(cls.name) ?? moduleId,
    });
  }

  for (const step of steps) {
    entities.push({
      type: 'step',
      value: step.description,
      complexity: step.complexity,
      order: step.order,
      moduleId,
    });
  }

  for (const warning of warnings) {
    entities.push({ type: 'warning', value: warning, moduleId });
  }

  for (const fp of filePaths) {
    entities.push({ type: 'file', value: fp, moduleId });
  }

  for (const concept of concepts) {
    entities.push({
      type: 'concept',
      value: concept,
      moduleId: linkEntityToModule(concept) ?? moduleId,
    });
  }

  const id = `si-${sessionId}-${Date.now()}`;

  return {
    id,
    sessionId,
    moduleId,
    extractedAt: new Date().toISOString(),
    entities,
    classHierarchy,
    steps,
    warnings,
    filePaths,
  };
}
