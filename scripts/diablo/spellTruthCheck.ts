/* eslint-disable no-console -- CLI report; stdout is its interface. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

import {
  spellTruthCheck,
  type SpellTruthClaim,
  type SpellTruthVerdict,
} from '@/lib/catalog/reference/spellTruthCheck';

const RESEARCH = process.env.POF_DIABLO_RESEARCH ?? join(homedir(), 'Documents/Obsidian/pof/Diablo/Research');
const DEFAULT_PRODUCED = join(RESEARCH, 'w83-spellbook-mechanics-d.json');
const DEFAULT_AUDIT = join(RESEARCH, 'cx-b114-spell-mechanics-audit-d.json');
const DEFAULT_HOLDOUT_PRODUCED = join(RESEARCH, 'w81-spellbook-mechanics-c.json');
const DEFAULT_HOLDOUT_AUDIT = join(RESEARCH, 'cx-b112-spell-mechanics-audit-c.json');
const MIN_OVERLAP = 2;

interface ProducedEntity {
  readonly entityId: string;
  readonly steps: Readonly<Record<string, unknown>>;
}

interface AuditClaim {
  readonly step: string;
  readonly claim: string;
  readonly verdict: string;
  readonly evidence: string;
}

interface AuditSpell {
  readonly entityId: string;
  readonly claims: readonly AuditClaim[];
}

interface AuditExport {
  readonly spells: readonly AuditSpell[];
}

interface EvidenceLeaf {
  readonly path: string;
  readonly value: unknown;
}

interface ArtifactTotals {
  leaves: number;
  agrees: number;
  contradicts: number;
  undecidable: number;
}

interface ClaimTotals {
  claims: number;
  checkerAgrees: number;
  checkerContradicts: number;
  checkerUndecidable: number;
  auditCorrect: number;
  auditWrong: number;
  bothDecide: number;
  agreements: number;
  disagreements: number;
}

interface AuditMatch {
  readonly claim: string;
  readonly verdict: string;
  readonly evidence: string;
  readonly overlap: number;
  readonly claimTokenCoverage: number;
  readonly overlapQualified: boolean;
}

interface ArtifactContradiction {
  readonly entityId: string;
  readonly step: string;
  readonly path: string;
  readonly produced: unknown;
  readonly checkerEvidence: readonly {
    readonly field: string;
    readonly engine: string;
    readonly ref: string;
  }[];
  readonly bestAuditMatch: AuditMatch | null;
  readonly auditAlsoWrong: boolean;
}

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positionalPaths(): string[] {
  const flags = ['--produced', '--audit', '--holdout-produced', '--holdout-audit', '--out'];
  const paths: string[] = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    if (flags.includes(process.argv[index])) {
      index += 1;
      continue;
    }
    if (!process.argv[index].startsWith('--')) paths.push(process.argv[index]);
  }
  return paths;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseProduced(value: unknown): ProducedEntity[] {
  if (!Array.isArray(value)) throw new Error('Produced artifact export must be a JSON array.');
  return value.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.entityId !== 'string' || !isRecord(entry.steps)) {
      throw new Error(`Produced artifact entry ${index} must contain entityId and steps.`);
    }
    return { entityId: entry.entityId, steps: entry.steps };
  });
}

function parseAudit(value: unknown): AuditExport {
  if (!isRecord(value) || !Array.isArray(value.spells)) throw new Error('Audit export must contain a spells array.');
  const spells = value.spells.map((entry, spellIndex) => {
    if (!isRecord(entry) || typeof entry.entityId !== 'string' || !Array.isArray(entry.claims)) {
      throw new Error(`Audit spell ${spellIndex} must contain entityId and claims.`);
    }
    const claims = entry.claims.map((claim, claimIndex) => {
      if (!isRecord(claim)
        || typeof claim.step !== 'string'
        || typeof claim.claim !== 'string'
        || typeof claim.verdict !== 'string'
        || typeof claim.evidence !== 'string') {
        throw new Error(`Audit claim ${spellIndex}.${claimIndex} has an invalid shape.`);
      }
      return { step: claim.step, claim: claim.claim, verdict: claim.verdict, evidence: claim.evidence };
    });
    return { entityId: entry.entityId, claims };
  });
  return { spells };
}

function emptyArtifactTotals(): ArtifactTotals {
  return { leaves: 0, agrees: 0, contradicts: 0, undecidable: 0 };
}

function emptyClaimTotals(): ClaimTotals {
  return {
    claims: 0,
    checkerAgrees: 0,
    checkerContradicts: 0,
    checkerUndecidable: 0,
    auditCorrect: 0,
    auditWrong: 0,
    bothDecide: 0,
    agreements: 0,
    disagreements: 0,
  };
}

function flatten(value: unknown, path = ''): EvidenceLeaf[] {
  if (value === null || typeof value !== 'object') return [{ path: path || '$', value }];
  if (Array.isArray(value)) return value.flatMap((entry, index) => flatten(entry, `${path}[${index}]`));
  return Object.entries(value).flatMap(([key, entry]) => flatten(entry, path ? `${path}.${key}` : key));
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'each', 'for', 'from', 'has', 'in', 'is',
  'it', 'its', 'of', 'on', 'or', 'that', 'the', 'then', 'this', 'to', 'when', 'with',
]);

function tokens(value: unknown): Set<string> {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const separated = text.replace(/([a-z])([A-Z])/g, '$1 $2');
  return new Set(separated.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => !STOP_WORDS.has(word)) ?? []);
}

function overlap(left: unknown, right: unknown): number {
  const a = tokens(left);
  const b = tokens(right);
  let count = 0;
  for (const token of a) if (b.has(token)) count += 1;
  return count;
}

function aggregateChecker(checks: readonly SpellTruthClaim[]): {
  verdict: SpellTruthVerdict;
  evidence: readonly SpellTruthClaim[];
} {
  const contradictions = checks.filter((check) => check.verdict === 'contradicts');
  if (contradictions.length) return { verdict: 'contradicts', evidence: contradictions };
  const agreements = checks.filter((check) => check.verdict === 'agrees');
  const undecidable = checks.filter((check) => check.verdict === 'undecidable');
  if (agreements.length && !undecidable.length) return { verdict: 'agrees', evidence: agreements };
  if (agreements.length) return { verdict: 'undecidable', evidence: [...agreements, ...undecidable] };
  return { verdict: 'undecidable', evidence: checks.slice(0, 1) };
}

function auditDecision(verdict: string): SpellTruthVerdict {
  if (verdict === 'correct') return 'agrees';
  if (verdict === 'wrong' || verdict === 'invented') return 'contradicts';
  return 'undecidable';
}

function auditWrong(verdict: string): boolean {
  return verdict === 'wrong' || verdict === 'invented';
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(6));
}

function addArtifactResult(totals: ArtifactTotals, verdict: SpellTruthVerdict): void {
  totals.leaves += 1;
  if (verdict === 'agrees') totals.agrees += 1;
  else if (verdict === 'contradicts') totals.contradicts += 1;
  else totals.undecidable += 1;
}

function addClaimResult(totals: ClaimTotals, checker: SpellTruthVerdict, audit: SpellTruthVerdict): void {
  totals.claims += 1;
  if (checker === 'agrees') totals.checkerAgrees += 1;
  else if (checker === 'contradicts') totals.checkerContradicts += 1;
  else totals.checkerUndecidable += 1;
  if (audit === 'agrees') totals.auditCorrect += 1;
  else if (audit === 'contradicts') totals.auditWrong += 1;
  if (checker !== 'undecidable') {
    totals.bothDecide += 1;
    if (checker === audit) totals.agreements += 1;
    else totals.disagreements += 1;
  }
}

function auditClaimsFor(audit: AuditExport, entityId: string, step: string): AuditClaim[] {
  return audit.spells.find((spell) => spell.entityId === entityId)?.claims
    .filter((claim) => claim.step === step && claim.verdict !== 'unverifiable') ?? [];
}

function bestAuditMatch(leaf: EvidenceLeaf, claims: readonly AuditClaim[]): AuditMatch | null {
  const ranked = claims
    .map((claim) => {
      const score = overlap(`${leaf.path} ${String(leaf.value)}`, claim.claim);
      return { claim, score, coverage: ratio(score, tokens(claim.claim).size) };
    })
    .sort((left, right) => right.coverage - left.coverage || right.score - left.score);
  const best = ranked[0];
  if (!best) return null;
  return {
    claim: best.claim.claim,
    verdict: best.claim.verdict,
    evidence: best.claim.evidence,
    overlap: best.score,
    claimTokenCoverage: best.coverage,
    overlapQualified: best.score >= MIN_OVERLAP,
  };
}

function withArtifactRatios(value: ArtifactTotals) {
  return { ...value, decidedShare: ratio(value.agrees + value.contradicts, value.leaves) };
}

function runArtifactMode(produced: readonly ProducedEntity[], audit: AuditExport) {
  const totals = emptyArtifactTotals();
  const perStep = new Map<string, ArtifactTotals>();
  const perSpell = new Map<string, ArtifactTotals>();
  const contradictions: ArtifactContradiction[] = [];

  for (const entity of produced) {
    const spellTotals = perSpell.get(entity.entityId) ?? emptyArtifactTotals();
    perSpell.set(entity.entityId, spellTotals);
    for (const [step, artifact] of Object.entries(entity.steps)) {
      const stepTotals = perStep.get(step) ?? emptyArtifactTotals();
      perStep.set(step, stepTotals);
      const checks = spellTruthCheck(entity.entityId, artifact);
      const checksByPath = new Map<string, SpellTruthClaim[]>();
      for (const check of checks) {
        const group = checksByPath.get(check.path) ?? [];
        group.push(check);
        checksByPath.set(check.path, group);
      }
      const claims = auditClaimsFor(audit, entity.entityId, step);
      for (const leaf of flatten(artifact)) {
        const aggregate = aggregateChecker(checksByPath.get(leaf.path) ?? []);
        addArtifactResult(totals, aggregate.verdict);
        addArtifactResult(stepTotals, aggregate.verdict);
        addArtifactResult(spellTotals, aggregate.verdict);
        if (aggregate.verdict !== 'contradicts') continue;
        const match = bestAuditMatch(leaf, claims);
        contradictions.push({
          entityId: entity.entityId,
          step,
          path: leaf.path,
          produced: leaf.value,
          checkerEvidence: aggregate.evidence.map((evidence) => ({
            field: evidence.field,
            engine: evidence.engine,
            ref: evidence.ref,
          })),
          bestAuditMatch: match,
          auditAlsoWrong: Boolean(match?.overlapQualified && auditWrong(match.verdict)),
        });
      }
    }
  }

  const wrongClaims = audit.spells.flatMap((spell) => spell.claims
    .filter((claim) => auditWrong(claim.verdict))
    .map((claim) => ({ entityId: spell.entityId, claim })));
  const matchedWrongClaims = wrongClaims.flatMap(({ entityId, claim }) => {
    const candidates = contradictions
      .filter((item) => item.entityId === entityId && item.step === claim.step)
      .map((item) => ({ item, score: overlap(`${item.path} ${String(item.produced)}`, claim.claim) }))
      .sort((left, right) => right.score - left.score);
    const best = candidates[0];
    return best?.score >= MIN_OVERLAP ? [{
      entityId,
      step: claim.step,
      claim: claim.claim,
      auditEvidence: claim.evidence,
      overlap: best.score,
      checkerLeaf: { path: best.item.path, produced: best.item.produced },
    }] : [];
  });
  const auditedWrongContradictions = contradictions.filter((item) => item.auditAlsoWrong).length;

  return {
    summary: {
      ...withArtifactRatios(totals),
      auditWrongClaims: wrongClaims.length,
      auditedWrongContradictions,
      matchedAuditWrongClaims: matchedWrongClaims.length,
      precisionProxy: ratio(auditedWrongContradictions, totals.contradicts),
      recallProxy: ratio(matchedWrongClaims.length, wrongClaims.length),
    },
    perStep: Object.fromEntries([...perStep].map(([step, value]) => [step, withArtifactRatios(value)])),
    perSpell: Object.fromEntries([...perSpell].map(([spell, value]) => [spell, withArtifactRatios(value)])),
    contradictions,
    matchedAuditWrongClaims: matchedWrongClaims,
    unflaggedContradictions: contradictions.filter((item) => !item.auditAlsoWrong),
  };
}

function withClaimRatios(value: ClaimTotals) {
  return {
    ...value,
    checkerCoverage: ratio(value.checkerAgrees + value.checkerContradicts, value.claims),
    agreementWhereBothDecide: ratio(value.agreements, value.bothDecide),
  };
}

function runClaimTextMode(audit: AuditExport) {
  const totals = emptyClaimTotals();
  const perStep = new Map<string, ClaimTotals>();
  const perSpell = new Map<string, ClaimTotals>();
  const disagreements: Array<Record<string, unknown>> = [];
  let excludedUnverifiable = 0;
  const confusion = {
    checkerAgrees: { auditCorrect: 0, auditWrong: 0 },
    checkerContradicts: { auditCorrect: 0, auditWrong: 0 },
  };

  for (const spell of audit.spells) {
    const spellTotals = perSpell.get(spell.entityId) ?? emptyClaimTotals();
    perSpell.set(spell.entityId, spellTotals);
    for (const claim of spell.claims) {
      if (claim.verdict === 'unverifiable') {
        excludedUnverifiable += 1;
        continue;
      }
      const stepTotals = perStep.get(claim.step) ?? emptyClaimTotals();
      perStep.set(claim.step, stepTotals);
      const checker = aggregateChecker(spellTruthCheck(spell.entityId, { claim: claim.claim }));
      const auditVerdict = auditDecision(claim.verdict);
      addClaimResult(totals, checker.verdict, auditVerdict);
      addClaimResult(stepTotals, checker.verdict, auditVerdict);
      addClaimResult(spellTotals, checker.verdict, auditVerdict);
      if (checker.verdict === 'undecidable') continue;
      const row = checker.verdict === 'agrees' ? confusion.checkerAgrees : confusion.checkerContradicts;
      if (auditVerdict === 'agrees') row.auditCorrect += 1;
      else row.auditWrong += 1;
      if (checker.verdict !== auditVerdict) {
        disagreements.push({
          entityId: spell.entityId,
          step: claim.step,
          claim: claim.claim,
          checker: checker.evidence.map((evidence) => ({
            field: evidence.field,
            engine: evidence.engine,
            ref: evidence.ref,
          })),
          audit: { verdict: claim.verdict, evidence: claim.evidence },
        });
      }
    }
  }

  return {
    summary: { ...withClaimRatios(totals), excludedUnverifiable },
    confusion,
    disagreements,
    perStep: Object.fromEntries([...perStep].map(([step, value]) => [step, withClaimRatios(value)])),
    perSpell: Object.fromEntries([...perSpell].map(([spell, value]) => [spell, withClaimRatios(value)])),
  };
}

function runRound(producedPath: string, auditPath: string) {
  const produced = parseProduced(readJson(producedPath));
  const audit = parseAudit(readJson(auditPath));
  return {
    inputs: { produced: producedPath, audit: auditPath },
    artifactMode: runArtifactMode(produced, audit),
    claimTextMode: runClaimTextMode(audit),
  };
}

const positional = positionalPaths();
const producedPath = resolve(valueAfter('--produced') ?? positional[0] ?? DEFAULT_PRODUCED);
const auditPath = resolve(valueAfter('--audit') ?? positional[1] ?? DEFAULT_AUDIT);
const holdoutProducedPath = resolve(valueAfter('--holdout-produced') ?? positional[2] ?? DEFAULT_HOLDOUT_PRODUCED);
const holdoutAuditPath = resolve(valueAfter('--holdout-audit') ?? positional[3] ?? DEFAULT_HOLDOUT_AUDIT);
const outArg = valueAfter('--out');
if (!outArg) {
  throw new Error('Usage: npx tsx scripts/diablo/spellTruthCheck.ts [--produced path] [--audit path] [--holdout-produced path] [--holdout-audit path] --out path');
}
const outPath = resolve(outArg);

const report = {
  rounds: {
    primaryD: runRound(producedPath, auditPath),
    holdoutC: runRound(holdoutProducedPath, holdoutAuditPath),
  },
  methodology: {
    primaryResult: 'Artifact mode checks every primitive produced leaf before consulting the audit.',
    overlap: `Audit proxy matches require at least ${MIN_OVERLAP} shared normalized tokens within the same entity and step.`,
    precisionProxy: 'Share of checker-contradicted artifact leaves whose qualified best audit match is wrong or invented.',
    recallProxy: 'Share of audit wrong or invented claims with a qualified overlap to a checker-contradicted artifact leaf.',
    claimTextMode: 'Secondary diagnostic only; it applies unchanged checker rules directly to normalized audit claim sentences.',
    coverageDenominator: 'Claim-text coverage excludes audit-unverifiable placeholders. Artifact mode uses every primitive produced leaf.',
    holdout: 'Round C is evaluated with the same checker and matching rules as round D; no hold-out-specific tuning is performed.',
  },
  checkerSpecialCases: {
    perSpellEntityIds: [],
    auditSentences: [],
    statement: 'spellTruthCheck.ts contains no branches keyed to a spell entity id or a specific audit sentence.',
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  out: outPath,
  primaryD: {
    artifactMode: report.rounds.primaryD.artifactMode.summary,
    claimTextMode: report.rounds.primaryD.claimTextMode.summary,
  },
  holdoutC: {
    artifactMode: report.rounds.holdoutC.artifactMode.summary,
    claimTextMode: report.rounds.holdoutC.claimTextMode.summary,
  },
}, null, 2));
