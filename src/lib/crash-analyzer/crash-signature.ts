/* ------------------------------------------------------------------ */
/*  UE5 Crash Analyzer — Crash Signatures & Diagnosis Matching        */
/* ------------------------------------------------------------------ */

/**
 * A crash's SIGNATURE — the shape of the failure, independent of when it
 * happened, which machine it happened on, or what id PoF stamped on it.
 *
 * This module exists because "does PoF already know this crash?" used to be
 * answered by `SAMPLE_DIAGNOSES.find((d) => d.crashId === report.id)` — exact id
 * equality against the fixed `crash-001`..`crash-008`. An imported crash is
 * stamped `crash-<base36 timestamp>`, so that lookup could never return anything
 * for real user input: the headline capability only ever fired for the eight
 * canned demo crashes.
 *
 * Everything below is PURE and free of app/DB/UI imports, so the ranking can be
 * reasoned about (and unit-tested) without running the analyzer or the UI.
 */

import type { CrashDiagnosis, CrashReport, CrashType } from '@/types/crash-analyzer';
import { lookupCrashTerm, isRawCrashToken } from '@/lib/crash-glossary';

/* ------------------------------------------------------------------ */
/*  The signature                                                      */
/* ------------------------------------------------------------------ */

/** The comparable shape of one crash. Every field is derived, never authored. */
export interface CrashSignature {
  /** Failure class (`nullptr_deref`, `gc_reference`, …) — the strongest discriminator. */
  crashType: CrashType;
  /** Culprit symbol as written, e.g. `AARPGCharacterBase::ActivateAbility`. */
  culpritFunction: string | null;
  /** Owning type of the culprit symbol, when it is qualified. */
  culpritClass: string | null;
  /** Bare method name of the culprit symbol. */
  culpritMethod: string | null;
  /** Culprit source file BASENAME, lowercased — real logs often omit the directory. */
  culpritFile: string | null;
  /** PoF module the crash was attributed to, or `null` when attribution was not confident. */
  module: string | null;
  /** Canonical glossary terms found in the error message + callstack, sorted. */
  terms: string[];
}

/* ---- Culprit extraction ------------------------------------------ */

/**
 * The culprit frame, resolved the same way `findCulpritFrame` resolves it (first
 * game-code frame carrying a source file), so a raw report and a processed one
 * produce the SAME signature. Prefers an already-stamped `culpritFrame`.
 */
function culpritOf(report: CrashReport) {
  return (
    report.culpritFrame ??
    report.callstack.find((f) => f.isGameCode && f.sourceFile) ??
    null
  );
}

function basename(filePath: string): string {
  const cut = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return cut >= 0 ? filePath.slice(cut + 1) : filePath;
}

/* ---- Glossary term extraction ------------------------------------ */

/**
 * Lowercase crash-vocabulary words worth carrying in a signature.
 *
 * The glossary is keyed on the raw token a reader sees, and `lookupCrashTerm`
 * falls back to the general UE5 jargon dictionary — which also holds everyday
 * verbs (`add`, `move`, `remove`, `none`) that would otherwise turn every
 * callstack into a bag of noise terms. Engine-shaped tokens are admitted
 * structurally by {@link isEngineShaped}; these plain words are the deliberate,
 * explicitly-listed exceptions. A crash word missing from this list simply does
 * not contribute a term — it never contributes a WRONG one.
 */
const PLAIN_CRASH_WORDS = new Set([
  'ensure',
  'assertion',
  'serialization',
  'nullptr',
  'montage',
  'replication',
]);

/**
 * Does this token look like an engine identifier rather than an everyday word?
 *
 * Two or more capitals covers the UE type vocabulary the glossary actually holds
 * (`UObject`, `FArchive`, `AbilitySpec`, `TWeakObjectPtr`, `GAS`) while rejecting
 * the single-capital jargon keys that are ordinary words (`Server`, `Category`,
 * `Transient`). `isRawCrashToken` alone is not enough — it misses `UObject` and
 * `FArchive`, which have no lower→upper hump — so it is used as an additional
 * accept, never as the only one.
 */
function isEngineShaped(token: string): boolean {
  if (token.includes('_')) return true;
  if (isRawCrashToken(token)) return true;
  let capitals = 0;
  for (const ch of token) {
    if (ch >= 'A' && ch <= 'Z') capitals++;
    if (capitals >= 2) return true;
  }
  return false;
}

/** UE type prefixes (`UFoo`, `AFoo`, `FFoo`, `TFoo`, `EFoo`, `SFoo`) stripped for a second try. */
const UE_PREFIXED = /^[UAFTES][A-Z]/;

function tokenVariants(token: string): string[] {
  const variants = [token];
  if (UE_PREFIXED.test(token)) variants.push(token.slice(1));
  const lower = token.toLowerCase();
  if (lower !== token) variants.push(lower);
  return variants;
}

const IDENTIFIER_RE = /[A-Za-z_][A-Za-z0-9_]*/g;

/**
 * The canonical glossary terms this crash mentions, from the error message and
 * EVERY frame (engine frames included — an engine frame names the subsystem even
 * though it is not evidence of module ownership). Sorted so the set is stable.
 */
export function signatureTerms(report: CrashReport): string[] {
  const found = new Set<string>();
  const texts = [report.errorMessage, ...report.callstack.map((f) => f.functionName)];

  for (const text of texts) {
    for (const token of text.match(IDENTIFIER_RE) ?? []) {
      for (const variant of tokenVariants(token)) {
        if (!isEngineShaped(variant) && !PLAIN_CRASH_WORDS.has(variant)) continue;
        const entry = lookupCrashTerm(variant);
        if (entry) {
          found.add(entry.term);
          break;
        }
      }
    }
  }

  return [...found].sort();
}

/**
 * Derive the comparable signature of a crash.
 *
 * `mappedModule` is passed in rather than recomputed so this module stays free of
 * the attribution engine (and of the import cycle that would create). Callers in
 * `analysis-engine` hand it the scored `attributeModule` result; the default
 * reads whatever the report already carries.
 */
export function crashSignature(
  report: CrashReport,
  mappedModule: string | null = report.mappedModule,
): CrashSignature {
  const culprit = culpritOf(report);
  const fn = culprit?.functionName ?? null;
  const parts = fn ? fn.split('::') : [];

  return {
    crashType: report.crashType,
    culpritFunction: fn,
    culpritClass: parts.length >= 2 ? parts[parts.length - 2] : null,
    culpritMethod: parts.length >= 1 ? parts[parts.length - 1] : null,
    culpritFile: culprit?.sourceFile ? basename(culprit.sourceFile).toLowerCase() : null,
    module: mappedModule,
    terms: signatureTerms(report),
  };
}

/**
 * A stable identity string for a crash signature — the bucketing grain used for
 * "have I seen this exact crash before?".
 *
 * Deliberately built from the IDENTITY fields only (failure class + culprit
 * symbol + file + module) and NOT from `terms`: an error message that happens to
 * name one extra engine type is the same crash, and bucketing on the term set
 * would file it as a new one. This is the same grain `detectPatterns` already
 * groups by (`crashType::culpritFunction`), widened with the file and module.
 */
export function signatureFingerprint(sig: CrashSignature): string {
  return [
    sig.crashType,
    (sig.culpritFunction ?? '-').toLowerCase(),
    sig.culpritFile ?? '-',
    sig.module ?? '-',
  ].join('|');
}

/* ------------------------------------------------------------------ */
/*  Scoring                                                            */
/* ------------------------------------------------------------------ */

/**
 * How much each piece of agreement is worth. They sum to exactly 1.0, so a
 * similarity is a real fraction of the available evidence rather than an
 * arbitrary point total.
 *
 * Ordering is deliberate: the failure CLASS and the culprit SYMBOL are what make
 * two crashes the same crash. File and module corroborate. Shared vocabulary is
 * the weakest signal — two unrelated crashes both mentioning
 * `EXCEPTION_ACCESS_VIOLATION` say very little.
 */
export const SIGNATURE_WEIGHTS = {
  crashType: 0.25,
  culpritFunction: 0.3,
  culpritFile: 0.15,
  module: 0.15,
  terms: 0.15,
} as const;

/**
 * Below this similarity there is NO match — the crash is reported as
 * undiagnosed rather than handed the nearest thing on the shelf. 0.55 means a
 * candidate must agree on clearly more than half the available evidence; in
 * practice a bare shared failure class plus some shared vocabulary (0.25 + a
 * fraction of 0.15) cannot reach it, while the same culprit symbol in the same
 * file and module can (0.30 + 0.15 + 0.15 = 0.60) even across failure classes.
 */
export const MATCH_FLOOR = 0.55;

/** At or above this the match is reported as strong; between the two it is reported as WEAK. */
export const STRONG_MATCH = 0.75;

export type MatchStrength = 'strong' | 'weak';

/** Two decimal places — a similarity is displayed, so it must not jitter. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sameText(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.toLowerCase() === b.toLowerCase();
}

/** The result of comparing two signatures, with the evidence that produced it. */
export interface SignatureComparison {
  /** 0–1 fraction of the available evidence the two signatures agree on. */
  similarity: number;
  /** Plain-language statements of what the two crashes share. */
  agreements: string[];
  /** Plain-language statements of where they differ — why a weak match is weak. */
  differences: string[];
}

/**
 * Compare two crash signatures. Pure and symmetric: `compare(a, b)` and
 * `compare(b, a)` produce the same similarity.
 *
 * Missing evidence scores ZERO rather than counting as agreement — two crashes
 * that both failed to attribute a module have not thereby agreed on one. That
 * keeps the honest UNKNOWN attribution from silently manufacturing similarity.
 */
export function compareSignatures(a: CrashSignature, b: CrashSignature): SignatureComparison {
  const agreements: string[] = [];
  const differences: string[] = [];
  let score = 0;

  if (a.crashType === b.crashType) {
    score += SIGNATURE_WEIGHTS.crashType;
    agreements.push(`same crash type (${a.crashType})`);
  } else {
    differences.push(`different crash type (${a.crashType} vs ${b.crashType})`);
  }

  if (sameText(a.culpritFunction, b.culpritFunction)) {
    score += SIGNATURE_WEIGHTS.culpritFunction;
    agreements.push(`same culprit function (${a.culpritFunction})`);
  } else if (sameText(a.culpritClass, b.culpritClass)) {
    score += SIGNATURE_WEIGHTS.culpritFunction / 2;
    agreements.push(`same culprit class (${a.culpritClass}), different method`);
    differences.push(`different function (${a.culpritFunction ?? 'unknown'} vs ${b.culpritFunction ?? 'unknown'})`);
  } else if (sameText(a.culpritMethod, b.culpritMethod)) {
    score += SIGNATURE_WEIGHTS.culpritFunction / 2;
    agreements.push(`same method name (${a.culpritMethod}), different type`);
    differences.push(`different function (${a.culpritFunction ?? 'unknown'} vs ${b.culpritFunction ?? 'unknown'})`);
  } else {
    differences.push(`different function (${a.culpritFunction ?? 'unknown'} vs ${b.culpritFunction ?? 'unknown'})`);
  }

  if (sameText(a.culpritFile, b.culpritFile)) {
    score += SIGNATURE_WEIGHTS.culpritFile;
    agreements.push(`same source file (${a.culpritFile})`);
  } else {
    differences.push(`different source file (${a.culpritFile ?? 'unknown'} vs ${b.culpritFile ?? 'unknown'})`);
  }

  if (a.module !== null && a.module === b.module) {
    score += SIGNATURE_WEIGHTS.module;
    agreements.push(`same module (${a.module})`);
  } else if (a.module === null || b.module === null) {
    differences.push('module not determined for both crashes');
  } else {
    differences.push(`different module (${a.module} vs ${b.module})`);
  }

  // Jaccard over the glossary vocabulary: shared / total distinct. Two crashes
  // with NO terms at all share no vocabulary — that is an absence of evidence,
  // scored 0, not a perfect match on the empty set.
  const shared = a.terms.filter((t) => b.terms.includes(t));
  const union = new Set([...a.terms, ...b.terms]);
  const jaccard = union.size > 0 ? shared.length / union.size : 0;
  score += SIGNATURE_WEIGHTS.terms * jaccard;
  if (shared.length > 0) {
    agreements.push(`shared terms: ${shared.join(', ')}`);
  } else {
    differences.push('no shared engine terms');
  }

  return { similarity: round2(score), agreements, differences };
}

/* ------------------------------------------------------------------ */
/*  Ranking a corpus of known crashes                                  */
/* ------------------------------------------------------------------ */

/** One known crash PoF holds a hand-written analysis for. */
export interface DiagnosisCandidate {
  diagnosis: CrashDiagnosis;
  signature: CrashSignature;
}

/** A scored candidate. `crashId` is the KNOWN crash's id, never the query's. */
export interface RankedCandidate extends SignatureComparison {
  crashId: string;
  diagnosis: CrashDiagnosis;
  strength: MatchStrength;
  /** True once `similarity >= MATCH_FLOOR`. Below it, this is a near miss, not a match. */
  cleared: boolean;
}

export interface SignatureMatchOutcome {
  /** The winner, or `null` when nothing cleared {@link MATCH_FLOOR}. */
  match: RankedCandidate | null;
  /** The top-ranked candidate whether or not it cleared the floor — the near miss. */
  best: RankedCandidate | null;
  /** Every candidate, strongest first. */
  ranked: RankedCandidate[];
}

/**
 * Rank a corpus of known crashes against one crash signature.
 *
 * Ordering is fully deterministic — similarity desc, then the crash's OWN
 * analysis first, then crash id ascending — so a tie never depends on array
 * order. The self-preference is a tie-break, not a lookup: a crash that carries
 * its own hand-written analysis scores 1.0 against itself and cannot be beaten,
 * and the tie-break only decides between two candidates that are *equally* good
 * matches (`crash-001` and `crash-008` are genuinely the same crash, and each
 * must still resolve to the analysis written for it).
 */
export function matchSignature(
  signature: CrashSignature,
  candidates: DiagnosisCandidate[],
  options: { selfCrashId?: string } = {},
): SignatureMatchOutcome {
  const { selfCrashId } = options;

  const ranked: RankedCandidate[] = candidates
    .map((candidate) => {
      const comparison = compareSignatures(signature, candidate.signature);
      return {
        ...comparison,
        crashId: candidate.diagnosis.crashId,
        diagnosis: candidate.diagnosis,
        strength: (comparison.similarity >= STRONG_MATCH ? 'strong' : 'weak') as MatchStrength,
        cleared: comparison.similarity >= MATCH_FLOOR,
      };
    })
    .sort((x, y) => {
      if (y.similarity !== x.similarity) return y.similarity - x.similarity;
      const xSelf = x.crashId === selfCrashId ? 0 : 1;
      const ySelf = y.crashId === selfCrashId ? 0 : 1;
      if (xSelf !== ySelf) return xSelf - ySelf;
      return x.crashId.localeCompare(y.crashId);
    });

  const best = ranked[0] ?? null;
  return { match: best?.cleared ? best : null, best, ranked };
}
