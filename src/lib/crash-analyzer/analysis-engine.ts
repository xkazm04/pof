/* ------------------------------------------------------------------ */
/*  UE5 Crash Analyzer — Analysis Engine                              */
/* ------------------------------------------------------------------ */

import type {
  CallstackFrame,
  CrashReport,
  CrashDiagnosis,
  CrashPattern,
  CrashStats,
  CrashAnalyzerResult,
  CrashType,
  CrashSeverity,
} from '@/types/crash-analyzer';
import { emptyCrashTypeCounts, emptyCrashSeverityCounts } from '@/types/crash-analyzer';
import { SAMPLE_CRASHES, SAMPLE_DIAGNOSES } from './sample-crashes';
import {
  crashSignature,
  matchSignature,
  MATCH_FLOOR,
  type CrashSignature,
  type DiagnosisCandidate,
  type MatchStrength,
  type RankedCandidate,
} from './crash-signature';

/* ------------------------------------------------------------------ */
/*  Module Attribution                                                 */
/* ------------------------------------------------------------------ */

/**
 * One vocabulary rule: a token pattern and the PoF module it points at.
 *
 * Rules are NOT ordered — every rule is tested against every piece of evidence
 * and the winner is decided by score (see {@link attributeModule}). The previous
 * implementation was a first-match scan in fixed array order, so a crash was
 * credited to whichever pattern happened to sit earliest in the list: an AI
 * Behavior Tree crash in `Source/AI/BTTask_ARPGAttackTarget.cpp` was filed under
 * `arpg-combat` purely because the combat rule was tested before the AI rule and
 * the function name contains "Attack"; a save-archive crash in
 * `Source/SaveLoad/ARPGSaveGame.cpp` was filed under `arpg-inventory` because the
 * function is called `DeserializeInventory`.
 *
 * Patterns are matched against TOKENIZED text (CamelCase, `snake_case` and path
 * separators split into words), so `\bai\b` matches the `Source/AI/` directory
 * without also matching the "ai" inside `CheckDependencyChain`, and `\bui\b`
 * matches `Source/UI/` without matching the "ui" inside `Build`. Raw-substring
 * matching on identifiers is exactly what made the old map imprecise.
 */
interface ModuleRule {
  pattern: RegExp;
  module: string;
  /**
   * Optional multiplier for rules whose vocabulary is weak evidence. Defaults
   * to 1. (The legacy `Component` catch-all was dropped rather than
   * down-weighted: nearly every UE class name ends in "Component", so it added
   * noise to every comparison while never being able to carry an attribution on
   * its own. `Health` — the useful half of that rule — is kept below.)
   */
  weight?: number;
}

const MODULE_RULES: ModuleRule[] = [
  { pattern: /\b(character|player|pawn|movement|locomotion)\b/, module: 'arpg-character' },
  { pattern: /\b(health|stamina|vitals)\b/, module: 'arpg-character' },
  { pattern: /\b(gas|asc|ability|abilities|gameplay|attribute|attributes|cue)\b/, module: 'arpg-abilities' },
  { pattern: /\b(inventory|item|items|equip|equipment|slot|slots|stash)\b/, module: 'arpg-inventory' },
  { pattern: /\b(ui|hud|widget|umg|menu|slate|viewmodel)\b/, module: 'arpg-ui-hud' },
  { pattern: /\b(dialog|dialogue|quest|quests|npc|conversation|objective)\b/, module: 'arpg-dialogue-quests' },
  { pattern: /\b(combat|damage|hit|attack|weapon|melee|projectile)\b/, module: 'arpg-combat' },
  { pattern: /\b(loot|drop|reward|treasure|rarity)\b/, module: 'arpg-loot' },
  { pattern: /\b(ai|bt|btt|behavior|behaviour|blackboard|enemy|perception|eqs|aicontroller)\b/, module: 'arpg-ai' },
  { pattern: /\b(save|load|persist|archive|checkpoint|\w*serializ\w*)\b/, module: 'arpg-save-load' },
  { pattern: /\b(audio|sound|music|sfx|metasound|submix)\b/, module: 'arpg-audio' },
];

/* ---- Evidence weights -------------------------------------------- */

/**
 * The file PATH outranks the symbol name when they disagree.
 *
 * A directory is a deliberate filing decision by the developer (`Source/AI/…`
 * means "this is AI code"); a file name is nearly as strong; a token of a
 * function name is the weakest of the three — it is precisely the evidence that
 * misfiled the Behavior Tree crash as combat.
 */
const WEIGHT_DIRECTORY = 3;
const WEIGHT_FILENAME = 2;
const WEIGHT_SYMBOL = 1;

/**
 * ALL game-code frames are consulted, not only the first one, so a deeper and
 * more specific frame can corroborate an attribution. Each frame below the
 * culprit contributes 40% of the weight of the frame above it: the caller chain
 * says who INVOKED the code, not who owns the defect, so it may confirm an
 * attribution but must never outvote the frame the crash happened in.
 */
const FRAME_DECAY = 0.4;

/**
 * Confidence gates. Below either of these the crash reports UNKNOWN (`null`)
 * instead of defaulting to whichever rule happened to score highest.
 *
 * - `MIN_SCORE` requires at least file-name-level evidence: a bare token of a
 *   function name (weight 1) can corroborate an attribution but cannot carry one
 *   on its own.
 * - `MIN_MARGIN` requires the winner to lead the runner-up by 25%; a near-tie
 *   between two subsystems is genuinely ambiguous and is reported as such.
 */
const MIN_SCORE = 2;
const MIN_MARGIN = 1.25;

/** Split CamelCase / snake_case / path text into lowercase word tokens. */
const TOKEN_RE = /[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+/g;

function tokenize(text: string): string {
  const matched = text.match(TOKEN_RE);
  if (!matched) return '';
  return ` ${matched.join(' ').toLowerCase()} `;
}

type EvidenceKind = 'directory' | 'file' | 'symbol';

interface FrameEvidence {
  kind: EvidenceKind;
  weight: number;
  raw: string;
  tokens: string;
}

function frameEvidence(frame: CallstackFrame): FrameEvidence[] {
  const src = frame.sourceFile ?? '';
  const cut = Math.max(src.lastIndexOf('/'), src.lastIndexOf('\\'));
  const dir = cut >= 0 ? src.slice(0, cut) : '';
  const file = cut >= 0 ? src.slice(cut + 1) : src;
  const parts: FrameEvidence[] = [
    { kind: 'directory', weight: WEIGHT_DIRECTORY, raw: dir, tokens: tokenize(dir) },
    { kind: 'file', weight: WEIGHT_FILENAME, raw: file, tokens: tokenize(file) },
    { kind: 'symbol', weight: WEIGHT_SYMBOL, raw: frame.functionName, tokens: tokenize(frame.functionName) },
  ];
  return parts.filter((p) => p.tokens.length > 0);
}

/** Why an attribution did — or did not — land. */
export type AttributionReason = 'attributed' | 'no-evidence' | 'ambiguous';

/** The full, inspectable result of attributing a crash to a PoF module. */
export interface ModuleAttribution {
  /** The winning module, or `null` when it could not be determined confidently. */
  module: string | null;
  reason: AttributionReason;
  /** Score of the top-ranked module (0 when nothing matched). */
  score: number;
  /** The next-best module when one exists — the reason an `ambiguous` call is ambiguous. */
  runnerUp: { module: string; score: number } | null;
  /** Human-readable trace of the evidence that fed the score, strongest first. */
  evidence: string[];
}

/**
 * Attribute a crash to a PoF module by SCORING every rule against every
 * game-code frame — weighting path evidence over symbol evidence — instead of
 * returning whichever regex matched first.
 *
 * Returns `module: null` when the evidence is too thin (`no-evidence`) or two
 * subsystems land within {@link MIN_MARGIN} of each other (`ambiguous`). An
 * honest "unknown" beats a confident wrong subsystem here, because this value
 * feeds `crashesByModule` / `mostAffectedModule` — the stat a developer reads to
 * decide WHERE their crashes are concentrated.
 */
export function attributeModule(report: CrashReport): ModuleAttribution {
  const gameFrames = report.callstack.filter((f) => f.isGameCode);
  const scores = new Map<string, number>();
  const evidence: { text: string; points: number }[] = [];

  gameFrames.forEach((frame, depth) => {
    const frameWeight = FRAME_DECAY ** depth;
    for (const ev of frameEvidence(frame)) {
      for (const rule of MODULE_RULES) {
        if (!rule.pattern.test(ev.tokens)) continue;
        const points = ev.weight * (rule.weight ?? 1) * frameWeight;
        scores.set(rule.module, (scores.get(rule.module) ?? 0) + points);
        evidence.push({
          text: `${rule.module} +${points.toFixed(2)} — ${ev.kind} "${ev.raw}" (frame ${frame.index})`,
          points,
        });
      }
    }
  });

  // Deterministic ranking: score desc, then module name asc, so a tie never
  // depends on Map insertion order.
  const ranked = [...scores.entries()]
    .map(([module, score]) => ({ module, score }))
    .sort((a, b) => b.score - a.score || a.module.localeCompare(b.module));

  const trace = [...evidence].sort((a, b) => b.points - a.points).map((e) => e.text);
  const top = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;

  if (!top || top.score < MIN_SCORE) {
    return { module: null, reason: 'no-evidence', score: top?.score ?? 0, runnerUp, evidence: trace };
  }
  if (runnerUp && top.score < runnerUp.score * MIN_MARGIN) {
    return { module: null, reason: 'ambiguous', score: top.score, runnerUp, evidence: trace };
  }
  return { module: top.module, reason: 'attributed', score: top.score, runnerUp, evidence: trace };
}

/** The winning module for a crash, or `null` when it cannot be determined confidently. */
function mapToModule(report: CrashReport): string | null {
  return attributeModule(report).module;
}

/* ------------------------------------------------------------------ */
/*  Crash Origin Detection                                             */
/* ------------------------------------------------------------------ */

function findCulpritFrame(report: CrashReport): CrashReport {
  const updated = { ...report };
  // Find the first game code frame — this is the likely culprit
  const culprit = report.callstack.find((f) => f.isGameCode && f.sourceFile);
  if (culprit) {
    updated.culpritFrame = { ...culprit, isCrashOrigin: true };
    updated.callstack = report.callstack.map((f) =>
      f.index === culprit.index ? { ...f, isCrashOrigin: true } : f,
    );
  }
  // Map to module
  updated.mappedModule = mapToModule(report);
  return updated;
}

/* ------------------------------------------------------------------ */
/*  Diagnosis Resolution (signature matching)                          */
/* ------------------------------------------------------------------ */

/**
 * The known-crash corpus: every hand-written analysis paired with the SIGNATURE
 * of the crash it was written for.
 *
 * Joining a diagnosis to its crash by id is the corpus's internal structure — a
 * diagnosis belongs to exactly one authored crash — and is not the matching. The
 * matching is {@link matchSignature}, which never looks at the query's id.
 */
export function buildDiagnosisCorpus(
  crashes: CrashReport[],
  diagnoses: CrashDiagnosis[],
): DiagnosisCandidate[] {
  const byId = new Map(crashes.map((c) => [c.id, c]));
  const candidates: DiagnosisCandidate[] = [];
  for (const diagnosis of diagnoses) {
    const crash = byId.get(diagnosis.crashId);
    if (!crash) continue; // an analysis with no crash to compare against cannot be matched
    candidates.push({ diagnosis, signature: crashSignature(crash, attributeModule(crash).module) });
  }
  return candidates;
}

/**
 * The default corpus is a pure function of the static sample imports, which
 * never change at runtime — so it is built once rather than per crash.
 */
let cachedCorpus: DiagnosisCandidate[] | null = null;

export function defaultDiagnosisCorpus(): DiagnosisCandidate[] {
  cachedCorpus ??= buildDiagnosisCorpus(SAMPLE_CRASHES, SAMPLE_DIAGNOSES);
  return cachedCorpus;
}

/** Why a crash ended up with (or without) a diagnosis. */
export type DiagnosisOrigin =
  /** Hand-written for exactly this crash. `confidence` is a human judgement. */
  | 'authored'
  /** Transferred from a different crash with a close signature. `confidence` is computed. */
  | 'signature-match'
  /** Nothing in the corpus was close enough. An explicit no-match. */
  | 'none';

export interface DiagnosisResolution {
  diagnosis: CrashDiagnosis | null;
  origin: DiagnosisOrigin;
  /**
   * The closest known crash whether or not it cleared the floor. Present even on
   * a no-match, so "nothing matched" can say HOW close the nearest thing was
   * instead of being an unexplained blank.
   */
  nearest: { crashId: string; similarity: number; strength: MatchStrength; cleared: boolean } | null;
  /** The similarity a candidate has to clear to be reported as a match at all. */
  floor: number;
}

function nearestOf(best: RankedCandidate | null): DiagnosisResolution['nearest'] {
  if (!best) return null;
  return {
    crashId: best.crashId,
    similarity: best.similarity,
    strength: best.strength,
    cleared: best.cleared,
  };
}

/** Two decimal places, matching the similarity scale a confidence is derived from. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolve the diagnosis for a crash by comparing its SIGNATURE against the known
 * crashes — replacing the exact `crashId === report.id` lookup that could only
 * ever fire for `crash-001`..`crash-008`.
 *
 * Three outcomes, and they are deliberately different things:
 *
 *  - **authored** — the winning candidate is the crash's own analysis (it scores
 *    1.0 against itself). Returned byte-identical, so a hand-verified confidence
 *    is never rewritten.
 *  - **signature-match** — a DIFFERENT crash's analysis was close enough. A new
 *    diagnosis object is produced, stamped with `match` and a confidence of
 *    `authored × similarity`, so it can never be mistaken for hand-verified work.
 *  - **none** — nothing cleared {@link MATCH_FLOOR}. `diagnosis` is null and the
 *    caller must SAY there is no diagnosis (see `NoDiagnosisNotice`); `nearest`
 *    carries the near miss so the absence can be explained rather than asserted.
 */
export function resolveDiagnosis(
  report: CrashReport,
  corpus: DiagnosisCandidate[] = defaultDiagnosisCorpus(),
  signature: CrashSignature = crashSignature(report, report.mappedModule ?? attributeModule(report).module),
): DiagnosisResolution {
  const outcome = matchSignature(signature, corpus, { selfCrashId: report.id });
  const nearest = nearestOf(outcome.best);
  const winner = outcome.match;

  if (!winner) return { diagnosis: null, origin: 'none', nearest, floor: MATCH_FLOOR };

  // The crash's OWN analysis — pass it through untouched.
  if (winner.crashId === report.id) {
    return { diagnosis: winner.diagnosis, origin: 'authored', nearest, floor: MATCH_FLOOR };
  }

  const transferred: CrashDiagnosis = {
    ...winner.diagnosis,
    crashId: report.id,
    // A product, never a copy: the analyst's confidence in their own finding,
    // discounted by how alike the two crashes actually are. Always ≤ the authored
    // value, and carried alongside the `match` provenance that says what it is.
    confidence: round2(winner.diagnosis.confidence * winner.similarity),
    match: {
      sourceCrashId: winner.diagnosis.crashId,
      similarity: winner.similarity,
      strength: winner.strength,
      agreements: winner.agreements,
      differences: winner.differences,
    },
  };

  return { diagnosis: transferred, origin: 'signature-match', nearest, floor: MATCH_FLOOR };
}

/* ------------------------------------------------------------------ */
/*  Pattern Detection                                                  */
/* ------------------------------------------------------------------ */

export function detectPatterns(reports: CrashReport[]): CrashPattern[] {
  // Group crashes by their signature (crash type + culprit function)
  const signatureMap = new Map<string, CrashReport[]>();

  for (const report of reports) {
    const culpritFn = report.culpritFrame?.functionName ?? 'unknown';
    const sig = `${report.crashType}::${culpritFn}`;
    const existing = signatureMap.get(sig) ?? [];
    existing.push(report);
    signatureMap.set(sig, existing);
  }

  const patterns: CrashPattern[] = [];
  let patternIdx = 0;

  for (const [sig, crashes] of signatureMap) {
    if (crashes.length < 2) continue; // Only patterns with 2+ occurrences

    const first = crashes[0];
    const signatureFns = [
      ...new Set(
        crashes.flatMap((c) =>
          c.callstack.filter((f) => f.isGameCode).map((f) => f.functionName),
        ),
      ),
    ].slice(0, 5);

    patterns.push({
      id: `pattern-${patternIdx++}`,
      name: `Recurring ${first.crashType.replace(/_/g, ' ')} in ${first.culpritFrame?.functionName ?? 'unknown'}`,
      description: `This crash pattern has been seen ${crashes.length} times. The crash consistently occurs in ${first.culpritFrame?.functionName ?? 'unknown function'} with the same callstack signature.`,
      occurrences: crashes.length,
      crashIds: crashes.map((c) => c.id),
      crashType: first.crashType,
      signatureFunctions: signatureFns,
      isSystemic: crashes.length >= 3,
      rootCause: `Recurring ${first.crashType.replace(/_/g, ' ')} — likely a systemic issue in the ${first.mappedModule ?? 'unknown'} module.`,
      firstSeen: crashes.reduce((min, c) => (c.timestamp < min ? c.timestamp : min), crashes[0].timestamp),
      lastSeen: crashes.reduce((max, c) => (c.timestamp > max ? c.timestamp : max), crashes[0].timestamp),
    });
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/*  Statistics                                                         */
/* ------------------------------------------------------------------ */

export function computeStats(reports: CrashReport[], patterns: CrashPattern[]): CrashStats {
  const crashesByType = emptyCrashTypeCounts();
  const crashesBySeverity = emptyCrashSeverityCounts();
  const crashesByModule: Record<string, number> = {};

  for (const r of reports) {
    crashesByType[r.crashType]++;
    crashesBySeverity[r.severity]++;
    const mod = r.mappedModule ?? 'unmapped';
    crashesByModule[mod] = (crashesByModule[mod] ?? 0) + 1;
  }

  // Find most common type
  let mostCommonType: CrashType = 'unknown';
  let maxTypeCount = 0;
  for (const [type, count] of Object.entries(crashesByType)) {
    if (count > maxTypeCount) {
      maxTypeCount = count;
      mostCommonType = type as CrashType;
    }
  }

  // Find most affected module
  let mostAffectedModule = 'none';
  let maxModCount = 0;
  for (const [mod, count] of Object.entries(crashesByModule)) {
    if (count > maxModCount) {
      maxModCount = count;
      mostAffectedModule = mod;
    }
  }

  // Recent crashes (within 24h)
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentCrashes = reports.filter((r) => new Date(r.timestamp) >= dayAgo).length;

  return {
    totalCrashes: reports.length,
    crashesByType,
    crashesBySeverity,
    crashesByModule,
    patternsDetected: patterns.length,
    systemicIssues: patterns.filter((p) => p.isSystemic).length,
    recentCrashes,
    mostCommonType,
    mostAffectedModule,
  };
}

/* ------------------------------------------------------------------ */
/*  Main Analysis Function                                             */
/* ------------------------------------------------------------------ */

/**
 * Memoized result of the full sample-crash analysis.
 *
 * `analyzeAllCrashes` is a pure function of the static `SAMPLE_CRASHES` and
 * `SAMPLE_DIAGNOSES` imports, which never change at runtime, so the computed
 * result is invariant. Caching it eliminates repeated pattern detection and
 * stat aggregation on the hot read path (every GET and every analyze /
 * full-analysis POST). Callers only read the result — the store copies arrays
 * before mutating and the API serializes it — so sharing one reference is safe.
 */
let cachedResult: CrashAnalyzerResult | null = null;

export function analyzeAllCrashes(): CrashAnalyzerResult {
  if (cachedResult) return cachedResult;

  // Process each crash report
  const processedReports = SAMPLE_CRASHES.map(findCulpritFrame).map((r) => ({
    ...r,
    analyzed: true,
  }));

  // Resolve each report's diagnosis through the SAME signature matcher an
  // imported crash goes through. For the samples this reproduces the authored
  // mapping exactly (each crash scores 1.0 against itself), which is the only
  // ground truth available — and pinning it here is what proves the matcher did
  // not quietly re-file the eight known crashes onto each other's analyses.
  const diagnoses = processedReports
    .map((r) => resolveDiagnosis(r).diagnosis)
    .filter((d): d is CrashDiagnosis => d !== null);

  // Detect patterns
  const patterns = detectPatterns(processedReports);

  // Compute stats
  const stats = computeStats(processedReports, patterns);

  cachedResult = {
    reports: processedReports,
    diagnoses,
    patterns,
    stats,
  };
  return cachedResult;
}

/**
 * Parse-and-attribute a single crash report (used by the import path).
 *
 * The diagnosis is resolved by comparing this crash's SIGNATURE — failure class,
 * culprit function/file, attributed module, engine vocabulary — against the
 * crashes PoF holds hand-written analyses for (see {@link resolveDiagnosis}).
 * It replaces the exact `crashId === report.id` lookup, which could only ever
 * fire for `crash-001`..`crash-008` and so returned `null` for every crash a
 * user actually imported.
 *
 * `diagnosis` is still null whenever nothing clears the match floor, and that
 * remains the normal outcome for an unfamiliar crash: callers must SAY there is
 * no diagnosis rather than substituting generic crash-category text under a
 * diagnosis heading. `resolution` carries the near miss so the absence can be
 * explained. A diagnosis that came back with `match` set was written for a
 * DIFFERENT crash and must be presented as transferred, never as hand-verified.
 */
export function analyzeSingleCrash(report: CrashReport): {
  report: CrashReport;
  diagnosis: CrashDiagnosis | null;
  resolution: DiagnosisResolution;
} {
  const processed = findCulpritFrame(report);
  processed.analyzed = true;

  const resolution = resolveDiagnosis(processed);
  return { report: processed, diagnosis: resolution.diagnosis, resolution };
}

/** Parse raw crash log text into a CrashReport */
export function parseCrashLog(rawText: string): CrashReport | null {
  const lines = rawText.split('\n');
  const errorLine = lines.find((l) => l.includes('Error:') && !l.includes('[Callstack]'));
  if (!errorLine) return null;

  // Extract error message
  const errorMatch = errorLine.match(/Error:\s*(.+)/);
  const errorMessage = errorMatch?.[1]?.trim() ?? 'Unknown error';

  // Detect crash type
  let crashType: CrashType = 'unknown';
  if (errorMessage.includes('ACCESS_VIOLATION') || errorMessage.includes('address 0x000000000000')) {
    crashType = 'nullptr_deref';
  } else if (errorMessage.includes('ACCESS_VIOLATION')) {
    crashType = 'access_violation';
  } else if (errorMessage.includes('Assertion failed')) {
    crashType = 'assertion_failed';
  } else if (errorMessage.includes('Ensure condition failed')) {
    crashType = 'ensure_failed';
  } else if (errorMessage.includes('garbage collected')) {
    crashType = 'gc_reference';
  } else if (errorMessage.includes('STACK_OVERFLOW')) {
    crashType = 'stack_overflow';
  } else if (errorMessage.includes('Fatal')) {
    crashType = 'fatal_error';
  }

  // Determine severity
  let severity: CrashSeverity = 'medium';
  if (crashType === 'nullptr_deref' || crashType === 'stack_overflow') severity = 'critical';
  else if (crashType === 'assertion_failed' || crashType === 'gc_reference') severity = 'high';
  else if (crashType === 'ensure_failed') severity = 'low';

  // Extract timestamp
  const tsMatch = rawText.match(/\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})/);
  const timestamp = tsMatch
    ? tsMatch[1].replace(/\./g, (m, offset: number) => (offset <= 9 ? '-' : ':')).replace(/-(\d{2}):/, 'T$1:') + 'Z'
    : new Date().toISOString();

  // Parse callstack frames
  const callstackStart = lines.findIndex((l) => l.includes('[Callstack]'));
  const frames: typeof SAMPLE_CRASHES[0]['callstack'] = [];
  if (callstackStart >= 0) {
    let idx = 0;
    for (let i = callstackStart + 1; i < lines.length; i++) {
      const frameLine = lines[i];
      const frameMatch = frameLine.match(/Error:\s*(\S+)!(\S+)\(\)\s*(?:\[(\S+?)(?::(\d+))?\])?/);
      if (frameMatch) {
        const moduleName = frameMatch[1];
        const isGame = moduleName.includes('MyGame') || !moduleName.includes('UnrealEditor-');
        frames.push({
          index: idx,
          address: `0x00007FF6${(0xA0000000 + idx * 0x1234).toString(16).toUpperCase()}`,
          moduleName,
          functionName: frameMatch[2],
          sourceFile: frameMatch[3] ?? null,
          lineNumber: frameMatch[4] ? parseInt(frameMatch[4]) : null,
          isGameCode: isGame,
          isCrashOrigin: false,
        });
        idx++;
      }
    }
  }

  const id = `crash-${Date.now().toString(36)}`;

  return {
    id,
    timestamp,
    crashType,
    severity,
    errorMessage,
    callstack: frames,
    culpritFrame: null,
    machineState: {
      platform: 'Windows',
      cpuBrand: 'Unknown',
      gpuBrand: 'Unknown',
      ramMB: 0,
      osVersion: 'Unknown',
      engineVersion: '5.5',
      buildConfig: 'Development',
      isEditor: true,
    },
    crashDir: 'Imported',
    mappedModule: null,
    rawLog: rawText,
    analyzed: false,
  };
}
