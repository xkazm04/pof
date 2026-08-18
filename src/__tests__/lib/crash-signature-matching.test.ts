/**
 * Crash SIGNATURE matching (direction: crash-signature-matching).
 *
 * The crash analyzer's headline capability — "map a crash to a known pattern and
 * suggest a fix" — used to be `SAMPLE_DIAGNOSES.find(d => d.crashId === report.id)`:
 * exact id equality against the fixed `crash-001`..`crash-008`. An imported crash is
 * stamped `crash-<base36 timestamp>`, so it could never match, and the feature only
 * ever fired for the eight canned demos.
 *
 * These pin the replacement:
 *   1. the scoring is a pure function with a fixed weight budget,
 *   2. the eight authored analyses still resolve for their own crashes — the only
 *      ground truth available,
 *   3. a transferred analysis is ALWAYS marked as transferred and never wears the
 *      confidence of hand-verified work,
 *   4. a no-match stays an explicit no-match.
 */
import { describe, it, expect } from 'vitest';
import {
  crashSignature,
  compareSignatures,
  matchSignature,
  signatureFingerprint,
  SIGNATURE_WEIGHTS,
  MATCH_FLOOR,
  STRONG_MATCH,
} from '@/lib/crash-analyzer/crash-signature';
import {
  analyzeAllCrashes,
  analyzeSingleCrash,
  attributeModule,
  buildDiagnosisCorpus,
  defaultDiagnosisCorpus,
  parseCrashLog,
  resolveDiagnosis,
} from '@/lib/crash-analyzer/analysis-engine';
import { SAMPLE_CRASHES, SAMPLE_DIAGNOSES } from '@/lib/crash-analyzer/sample-crashes';
import type { CrashReport } from '@/types/crash-analyzer';

/* ------------------------------------------------------------------ */
/*  Fixtures — real logs through the real parser                       */
/* ------------------------------------------------------------------ */

function log(errorLine: string, ...frames: string[]): string {
  const stamp = '[2026.08.18-09.12.44:120][842]LogWindows: Error: ';
  return [`${stamp}${errorLine}`, `${stamp}[Callstack]`, ...frames.map((f) => `${stamp}${f}`)].join('\n');
}

function imported(raw: string): CrashReport {
  const parsed = parseCrashLog(raw);
  if (!parsed) throw new Error('fixture log failed to parse');
  return parsed;
}

/** Same shape as crash-001: null-ASC deref in ActivateAbility. */
const IDENTICAL_TO_CRASH_001 = log(
  'Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000',
  'UnrealEditor-Engine!UAbilitySystemComponent::TryActivateAbility()',
  'UnrealEditor-MyGame!AARPGCharacterBase::ActivateAbility() [Source/Character/ARPGCharacterBase.cpp:234]',
);

/** Same culprit symbol/file/module as crash-001 but a DIFFERENT failure class. */
const WEAKLY_LIKE_CRASH_001 = log(
  'Assertion failed: AbilityHandle.IsValid()',
  'UnrealEditor-MyGame!AARPGCharacterBase::ActivateAbility() [Source/Character/ARPGCharacterBase.cpp:234]',
);

/** Same file/class as crash-004 but a different method AND a different failure class. */
const UNFAMILIAR = log(
  'Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000',
  'UnrealEditor-MyGame!UARPGInventoryComponent::AddItem() [Source/Inventory/ARPGInventoryComponent.cpp:142]',
  'UnrealEditor-MyGame!AARPGCharacterBase::PickupItem() [Source/Character/ARPGCharacterBase.cpp:401]',
);

/* ------------------------------------------------------------------ */
/*  1. The scoring is pure and its budget is fixed                     */
/* ------------------------------------------------------------------ */

describe('compareSignatures — a similarity is a fraction of the available evidence', () => {
  it('spends exactly a 1.0 weight budget', () => {
    const total = Object.values(SIGNATURE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(MATCH_FLOOR).toBeLessThan(STRONG_MATCH);
  });

  it('scores a signature against itself at exactly 1.0', () => {
    for (const crash of SAMPLE_CRASHES) {
      const sig = crashSignature(crash, attributeModule(crash).module);
      expect(compareSignatures(sig, sig).similarity).toBe(1);
    }
  });

  it('is symmetric', () => {
    const a = crashSignature(SAMPLE_CRASHES[0], attributeModule(SAMPLE_CRASHES[0]).module);
    const b = crashSignature(SAMPLE_CRASHES[4], attributeModule(SAMPLE_CRASHES[4]).module);
    expect(compareSignatures(a, b).similarity).toBe(compareSignatures(b, a).similarity);
  });

  it('gives NO credit when both sides failed to attribute a module', () => {
    // Frameless: no culprit function, no culprit file. Both sides agree only on
    // the failure class and the vocabulary of the (shared) error message.
    const frameless = { ...SAMPLE_CRASHES[0], callstack: [] };
    const unknownModule = compareSignatures(
      crashSignature(frameless, null),
      crashSignature(frameless, null),
    );
    const sameModule = compareSignatures(
      crashSignature(frameless, 'arpg-character'),
      crashSignature(frameless, 'arpg-character'),
    );

    // Two unknowns are not an agreement: the module weight is simply not spent.
    expect(unknownModule.similarity).toBe(SIGNATURE_WEIGHTS.crashType + SIGNATURE_WEIGHTS.terms);
    expect(unknownModule.differences).toContain('module not determined for both crashes');
    // Naming the same module is what earns it.
    expect(sameModule.similarity - unknownModule.similarity).toBeCloseTo(SIGNATURE_WEIGHTS.module, 10);
  });

  it('names the failure-class difference as a difference, not silence', () => {
    const nullDeref = crashSignature(SAMPLE_CRASHES[0], attributeModule(SAMPLE_CRASHES[0]).module);
    const assertion = crashSignature(imported(WEAKLY_LIKE_CRASH_001), 'arpg-character');
    const cmp = compareSignatures(assertion, nullDeref);
    expect(cmp.differences.some((d) => d.startsWith('different crash type'))).toBe(true);
    expect(cmp.agreements).toContain('same culprit function (AARPGCharacterBase::ActivateAbility)');
  });
});

describe('signatureFingerprint — the bucketing grain', () => {
  it('is identity-only: the same crash reported with an extra engine term buckets the same', () => {
    const a = crashSignature(SAMPLE_CRASHES[0], 'arpg-character');
    const b = { ...a, terms: [...a.terms, 'TWeakObjectPtr'] };
    expect(signatureFingerprint(b)).toBe(signatureFingerprint(a));
  });

  it('separates two different culprits', () => {
    const a = crashSignature(SAMPLE_CRASHES[0], attributeModule(SAMPLE_CRASHES[0]).module);
    const b = crashSignature(SAMPLE_CRASHES[2], attributeModule(SAMPLE_CRASHES[2]).module);
    expect(signatureFingerprint(a)).not.toBe(signatureFingerprint(b));
  });
});

/* ------------------------------------------------------------------ */
/*  2. Ground truth: the 8 authored analyses still resolve             */
/* ------------------------------------------------------------------ */

describe('the authored corpus is the ground truth and must survive the rewrite', () => {
  it('resolves every sample crash to the analysis written FOR it, byte-identical', () => {
    for (const crash of SAMPLE_CRASHES) {
      const authored = SAMPLE_DIAGNOSES.find((d) => d.crashId === crash.id);
      const resolution = resolveDiagnosis(crash);

      expect(resolution.origin).toBe('authored');
      // Identity, not equality: a hand-verified confidence is never rewritten.
      expect(resolution.diagnosis).toBe(authored);
      expect(resolution.diagnosis?.match).toBeUndefined();
    }
  });

  it('does not let crash-001 and crash-008 steal each other\'s analysis', () => {
    // These two ARE the same crash (same culprit, same file, same module, same
    // failure class) — so both score 1.0 against each other. Each must still
    // resolve to its own authored analysis, which crash-008's text depends on
    // (it is written as the SECOND occurrence).
    const c1 = SAMPLE_CRASHES.find((c) => c.id === 'crash-001')!;
    const c8 = SAMPLE_CRASHES.find((c) => c.id === 'crash-008')!;
    const s1 = crashSignature(c1, attributeModule(c1).module);
    const s8 = crashSignature(c8, attributeModule(c8).module);
    expect(compareSignatures(s1, s8).similarity).toBe(1);

    expect(resolveDiagnosis(c1).diagnosis?.crashId).toBe('crash-001');
    expect(resolveDiagnosis(c8).diagnosis?.crashId).toBe('crash-008');
  });

  it('analyzeAllCrashes reproduces the authored mapping through the matcher', () => {
    const result = analyzeAllCrashes();
    expect(result.diagnoses).toHaveLength(SAMPLE_DIAGNOSES.length);
    result.diagnoses.forEach((d, i) => {
      expect(d).toBe(SAMPLE_DIAGNOSES[i]);
    });
  });

  it('ranks deterministically regardless of corpus array order', () => {
    const forward = defaultDiagnosisCorpus();
    const reversed = buildDiagnosisCorpus(SAMPLE_CRASHES, [...SAMPLE_DIAGNOSES].reverse());
    const sig = crashSignature(imported(IDENTICAL_TO_CRASH_001), 'arpg-character');
    expect(matchSignature(sig, forward).match?.crashId).toBe(
      matchSignature(sig, reversed).match?.crashId,
    );
  });
});

/* ------------------------------------------------------------------ */
/*  3. A transferred analysis says so                                  */
/* ------------------------------------------------------------------ */

describe('an imported crash now reaches the corpus — and is told apart from it', () => {
  it('matches an identically-shaped crash and marks the analysis as transferred', () => {
    const report = imported(IDENTICAL_TO_CRASH_001);
    expect(report.id).not.toMatch(/^crash-00\d$/); // the id lookup could never have fired

    const { diagnosis, resolution } = analyzeSingleCrash(report);

    expect(resolution.origin).toBe('signature-match');
    expect(diagnosis).not.toBeNull();
    expect(diagnosis!.crashId).toBe(report.id);
    expect(diagnosis!.match).toBeDefined();
    expect(diagnosis!.match!.sourceCrashId).toBe('crash-001');
    expect(diagnosis!.match!.similarity).toBe(1);
    expect(diagnosis!.match!.strength).toBe('strong');
    expect(diagnosis!.match!.agreements.length).toBeGreaterThan(0);
  });

  it('never presents a transferred confidence above the analyst\'s own', () => {
    const authored = SAMPLE_DIAGNOSES.find((d) => d.crashId === 'crash-001')!;
    const { diagnosis } = analyzeSingleCrash(imported(IDENTICAL_TO_CRASH_001));
    expect(diagnosis!.confidence).toBeLessThanOrEqual(authored.confidence);
    // …and it is a PRODUCT of the authored judgement and the measured similarity.
    expect(diagnosis!.confidence).toBe(
      Math.round(authored.confidence * diagnosis!.match!.similarity * 100) / 100,
    );
  });

  it('reports a weak match as weak, with the reason it is weak', () => {
    const { diagnosis, resolution } = analyzeSingleCrash(imported(WEAKLY_LIKE_CRASH_001));

    expect(resolution.origin).toBe('signature-match');
    expect(diagnosis!.match!.sourceCrashId).toBe('crash-001');
    expect(diagnosis!.match!.similarity).toBe(0.6);
    expect(diagnosis!.match!.strength).toBe('weak');
    expect(diagnosis!.match!.differences.some((d) => d.startsWith('different crash type'))).toBe(true);
    // A weak transfer is discounted well below the 0.95 the analyst claimed.
    expect(diagnosis!.confidence).toBe(0.57);
  });

  it('every transferred diagnosis carries provenance — no exceptions', () => {
    for (const raw of [IDENTICAL_TO_CRASH_001, WEAKLY_LIKE_CRASH_001]) {
      const { diagnosis, resolution } = analyzeSingleCrash(imported(raw));
      if (resolution.origin !== 'signature-match') continue;
      expect(diagnosis!.match).toBeDefined();
      expect(diagnosis!.match!.sourceCrashId).not.toBe(diagnosis!.crashId);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  4. A no-match is still an explicit no-match                        */
/* ------------------------------------------------------------------ */

describe('nothing close enough is reported as nothing, with the near miss named', () => {
  it('returns a null diagnosis below the floor and says how close the nearest was', () => {
    const { diagnosis, resolution } = analyzeSingleCrash(imported(UNFAMILIAR));

    expect(diagnosis).toBeNull();
    expect(resolution.origin).toBe('none');
    expect(resolution.floor).toBe(MATCH_FLOOR);
    expect(resolution.nearest).not.toBeNull();
    expect(resolution.nearest!.crashId).toBe('crash-004');
    expect(resolution.nearest!.similarity).toBe(0.45);
    expect(resolution.nearest!.cleared).toBe(false);
    expect(resolution.nearest!.similarity).toBeLessThan(MATCH_FLOOR);
  });

  it('parsing still did its real work — that is what may be claimed', () => {
    const { report } = analyzeSingleCrash(imported(UNFAMILIAR));
    expect(report.crashType).toBe('nullptr_deref');
    expect(report.mappedModule).toBe('arpg-inventory');
    expect(report.analyzed).toBe(true);
  });
});
