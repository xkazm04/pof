/** Deterministic, measurement-only checks for produced spell-mechanics claims. */
import { DIABLO1_DAMAGE_UNITS_LAWS } from '@/lib/catalog/reference/damageUnitsLawData';
import { MISSILE_BEHAVIOUR_SPECS_DATA } from '@/lib/catalog/reference/missileSpecsData';
import type { MissileBehaviourSpecData } from '@/lib/catalog/reference/missileSpecs';
import { PLAYER_SPELL_HIT_SOURCES_DATA } from '@/lib/catalog/reference/playerSpellHitsData';
import type { PlayerSpellHitSource } from '@/lib/catalog/reference/playerSpellHits';
import { SPELL_CAST_LEDGER_DATA } from '@/lib/catalog/reference/spellCastLedgerData';
import type { SpellCastBranch, SpellCastLedger } from '@/lib/catalog/reference/spellCastLedger';
import { SPELL_FIZZLE_BRANCHES_DATA } from '@/lib/catalog/reference/spellMechanicsData';
import type { SpellFizzleBranch } from '@/lib/catalog/reference/spellMechanics';

export type SpellTruthVerdict = 'agrees' | 'contradicts' | 'undecidable';

export interface SpellTruthClaim {
  readonly path: string;
  readonly field: string;
  readonly produced: unknown;
  readonly engine: string;
  readonly verdict: SpellTruthVerdict;
  readonly ref: string;
}

export interface SpellTruthCheckData {
  readonly ledgers: readonly SpellCastLedger[];
  readonly hitSources?: readonly PlayerSpellHitSource[];
  readonly missileSpecs?: readonly MissileBehaviourSpecData[];
  readonly fizzleBranches?: readonly SpellFizzleBranch[];
  readonly damageUnitsLaws?: readonly {
    readonly body: string;
    readonly refs?: readonly string[];
  }[];
}

interface LeafClaim {
  readonly path: string;
  readonly key: string;
  readonly value: unknown;
  readonly siblings: string;
}

interface SpellContext {
  readonly ledger: SpellCastLedger;
  readonly allSpellNames: readonly string[];
  readonly hits?: PlayerSpellHitSource;
  readonly missiles: readonly MissileBehaviourSpecData[];
  readonly fizzleBranches: readonly SpellFizzleBranch[];
  readonly damageUnitsLaws: SpellTruthCheckData['damageUnitsLaws'];
}

const DEFAULT_DATA: SpellTruthCheckData = {
  ledgers: SPELL_CAST_LEDGER_DATA,
  hitSources: PLAYER_SPELL_HIT_SOURCES_DATA,
  missileSpecs: MISSILE_BEHAVIOUR_SPECS_DATA,
  fizzleBranches: SPELL_FIZZLE_BRANCHES_DATA,
  damageUnitsLaws: DIABLO1_DAMAGE_UNITS_LAWS,
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'cast', 'each', 'for', 'from',
  'has', 'in', 'is', 'it', 'its', 'missile', 'of', 'on', 'only', 'or', 'spell', 'that', 'the',
  'then', 'this', 'through', 'to', 'when', 'with', 'within',
]);

function identity(value: string): string {
  return value.replace(/^d1-/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : String(value).toLowerCase();
}

function compact(value: unknown): string {
  return lower(value)
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/character\s*level/g, 'c')
    .replace(/spell\s*level/g, 's')
    .replace(/learned\s*(?:spell\s*)?(?:level|rank)/g, 's')
    .replace(/\bfloor\b/g, 'trunc')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9+*/().,<>=-]/g, '');
}

function words(value: unknown): Set<string> {
  const aliases: Readonly<Record<string, string>> = {
    petrification: 'petrify',
    petrified: 'petrify',
  };
  return new Set(lower(value).match(/[a-z][a-z0-9]+/g)
    ?.filter((word) => !STOP_WORDS.has(word))
    .map((word) => aliases[word] ?? word) ?? []);
}

function overlap(left: unknown, right: unknown): number {
  const a = words(left);
  const b = words(right);
  let count = 0;
  for (const token of a) if (b.has(token)) count += 1;
  return count;
}

function numbers(value: unknown): string[] {
  return lower(value).match(/\b\d+(?:\.\d+)?\b/g) ?? [];
}

function formulaLike(value: unknown): boolean {
  const text = lower(value);
  return /\d/.test(text) && (/[-+*/=×÷]/.test(text) || /\b(?:min|max|trunc|floor|roll|through|\.\.)\b/.test(text));
}

function sameFormula(produced: unknown, engine: string): boolean {
  const a = compact(produced);
  const b = compact(engine);
  if (a.length < 2 || b.length < 2) return false;
  return a === b || (a.length >= 8 && b.includes(a)) || (b.length >= 8 && a.includes(b));
}

function firstRef(refs: readonly string[] | undefined, fallback: readonly string[] = []): string {
  const ref = refs?.[0] ?? fallback[0] ?? '';
  const github = ref.match(/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/Source\/([^#]+)#L(\d+)(?:-L(\d+))?/);
  return github ? `.reference/devilutionX/Source/${github[1]}:${github[2]}${github[3] ? `-${github[3]}` : ''}` : ref;
}

function result(
  field: string,
  leaf: LeafClaim,
  engine: string,
  verdict: SpellTruthVerdict,
  ref: string,
): SpellTruthClaim {
  return { path: leaf.path, field, produced: leaf.value, engine, verdict, ref };
}

function flatten(value: unknown, path = '', seen = new Set<object>(), siblings = ''): LeafClaim[] {
  if (value === null || typeof value !== 'object') {
    const key = path.split(/[.[\]]/).filter(Boolean).at(-1) ?? '$';
    return [{ path: path || '$', key, value, siblings }];
  }
  if (seen.has(value)) return [{ path: path || '$', key: '$', value: '[circular]', siblings }];
  seen.add(value);
  const leaves: LeafClaim[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => leaves.push(...flatten(entry, `${path}[${index}]`, seen, siblings)));
  } else {
    const localContext = Object.entries(value)
      .filter(([, entry]) => entry === null || typeof entry !== 'object')
      .map(([key, entry]) => `${key}: ${String(entry)}`)
      .join('; ');
    for (const [key, entry] of Object.entries(value)) {
      leaves.push(...flatten(entry, path ? `${path}.${key}` : key, seen, localContext || siblings));
    }
  }
  seen.delete(value);
  return leaves;
}

function contextFor(entityId: string, data: SpellTruthCheckData): SpellContext | undefined {
  const wanted = identity(entityId);
  const ledger = data.ledgers.find((candidate) => identity(candidate.spell) === wanted);
  if (!ledger) return undefined;
  const missileIds = new Set([...ledger.initialMissiles, ...ledger.spawnedMissiles].map(identity));
  return {
    ledger,
    allSpellNames: data.ledgers.map((candidate) => candidate.spell),
    hits: data.hitSources?.find((candidate) => identity(candidate.spell) === wanted),
    missiles: (data.missileSpecs ?? []).filter((spec) => spec.missileIds.some((id) => missileIds.has(identity(id)))),
    fizzleBranches: (data.fizzleBranches ?? []).filter((branch) => identity(branch.spell) === wanted),
    damageUnitsLaws: data.damageUnitsLaws,
  };
}

function mentionsForeignSpell(text: string, context: SpellContext): boolean {
  const normalized = identity(text);
  return context.allSpellNames.some((spell) => identity(spell) !== identity(context.ledger.spell)
    && normalized.includes(identity(spell)));
}

function manaCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim | undefined {
  const text = lower(leaf.value);
  const semantic = `${leaf.path.toLowerCase()} ${text}`;
  if (!/(?:mana(?:cost|payment|pool| debit| deduction| spend)|(?:cost|pay|pays|paid|deduct|requires)[^.!]{0,25}mana)/.test(semantic)) {
    return undefined;
  }
  if (/basemanacost|listedbasemana|referencevalues\.manacost/.test(leaf.path.toLowerCase()) && typeof leaf.value === 'number') {
    return result('manaCost.rule', leaf, context.ledger.manaCost.formula, 'undecidable', firstRef(context.ledger.manaCost.refs));
  }
  if (typeof leaf.value === 'number') {
    return result('manaCost.rule', leaf, context.ledger.manaCost.formula, 'undecidable', firstRef(context.ledger.manaCost.refs));
  }

  const engine = context.ledger.manaCost.formula;
  const engineCompact = compact(engine);
  const engineConstant = /^\d+(?:\.\d+)?(?:when.*)?$/.test(engineCompact);
  const producedNumber = typeof leaf.value === 'number' ? String(leaf.value) : undefined;
  const explicitConstant = producedNumber !== undefined
    || /\b(?:always|fixed|exactly|necessarily|universal(?:ly)?)\b[^.!]{0,35}\bmana\b|\bmana\b[^.!]{0,20}\b(?:always|fixed|exactly)\b/.test(text)
    || /\b(?:costs?|pays?|deducts?|requires?)\s+(?:exactly\s+)?\d+(?:\.\d+)?\s+mana\b/.test(text);

  let verdict: SpellTruthVerdict = 'undecidable';
  if (sameFormula(leaf.value, engine) || sameFormula(leaf.value, context.ledger.manaCost.engineFormula)) {
    verdict = 'agrees';
  } else if (/spell level does not (?:modify|change|affect)/.test(text) && /levelsAboveFirst|\bS\b/.test(engine)) {
    verdict = 'contradicts';
  } else if (explicitConstant && !engineConstant) {
    verdict = 'contradicts';
  } else if (explicitConstant && engineConstant) {
    const claimed = producedNumber ?? numbers(text).at(-1);
    verdict = claimed === engineCompact.match(/^\d+(?:\.\d+)?/)?.[0] ? 'agrees' : 'contradicts';
  } else if (/level[^.!]{0,30}(?:reduction|adjust)|class[^.!]{0,30}adjust|min(?:imum)?\s*mana|standard[^.!]{0,30}formula/.test(text)
    && /levelsAboveFirst|manaAdj|minMana|\bD\(/.test(engine)) {
    verdict = 'agrees';
  }
  return result('manaCost.rule', leaf, engine, verdict, firstRef(context.ledger.manaCost.refs));
}

function orderCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim | undefined {
  const text = lower(leaf.value);
  if (!/(?:addmissile|initial (?:missile|projectile|creation)|missile (?:allocation|creation))/.test(text)
    || !/(?:pay|payment|consume|deduct|resource|mana|charge|scroll)/.test(text)) return undefined;

  const addBefore = /(?:addmissile|creation|allocation)[^.!]{0,80}(?:before|then|after[^.!]{0,20}(?:comes|reaches))[^.!]{0,30}(?:pay|consume|deduct)/.test(text)
    || /(?:pay|consume|deduct)[^.!]{0,35}(?:only\s+)?after[^.!]{0,45}(?:addmissile|creation|allocation|succeeds?)/.test(text)
    || /after (?:successful )?(?:initial )?(?:projectile|missile) creation[^.!]{0,45}(?:consume|pay|deduct)/.test(text);
  const consumeBefore = /(?:pay|consume|deduct)[^.!]{0,45}before[^.!]{0,45}(?:addmissile|creation|allocation)/.test(text)
    || /(?:addmissile|creation|allocation)[^.!]{0,45}after[^.!]{0,30}(?:pay|consume|deduct)/.test(text);
  if (!addBefore && !consumeBefore) return undefined;
  const phases = context.ledger.steps.map((step) => step.phase);
  const engineAgrees = phases.indexOf('add') < phases.indexOf('consume');
  const engine = phases.join(' -> ');
  const verdict = addBefore === engineAgrees && consumeBefore !== engineAgrees ? 'agrees' : 'contradicts';
  return result('cast.order.addVsConsume', leaf, engine, verdict, firstRef(context.ledger.steps.find((step) => step.phase === 'consume')?.refs));
}

function ledgerBranches(context: SpellContext): SpellCastBranch[] {
  return context.ledger.steps.flatMap((step) => step.branches ?? []);
}

function closestBranch(text: string, context: SpellContext): SpellCastBranch | undefined {
  const branches = ledgerBranches(context);
  if (/pool (?:is )?full|addmissile returns? null|allocation (?:returns? null|fails?)|cannot be allocated|failed initial (?:missile|projectile) creation|(?:initial|later) (?:missile|bolt|projectile)[^.!]{0,20}(?:fails?|null)/.test(text)) {
    const pool = branches.find((branch) => /AddMissile returns null|missile pool is full/i.test(branch.condition));
    if (pool) return pool;
  }
  let best: { branch: SpellCastBranch; score: number; specificity: number } | undefined;
  for (const branch of branches) {
    const score = overlap(text, `${branch.condition} ${branch.outcome}`);
    const specificity = branch.sourceDataset ? 1 : 0;
    if (!best || score > best.score || (score === best.score && specificity > best.specificity)) {
      best = { branch, score, specificity };
    }
  }
  return best && best.score >= 2 ? best.branch : undefined;
}

function fizzleCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim[] {
  const text = lower(leaf.value);
  if (/distinct from (?:a )?failed|unlike (?:a )?failed/.test(text)) return [];
  if (/\bundefined\b/.test(text) && /skip(?:s|ped)? (?:resource )?(?:cost|payment|consumption)|\bfree\b/.test(text)) return [];
  if (/after dispatch|downstream|item contention|inventory rejection|cursor/.test(text)
    && !/addmissile|initial (?:missile|projectile)|cast[- ]fizzle/.test(text)) return [];
  const useSiblings = /failure|branch|resource|condition|outcome|fizzle/.test(leaf.path.toLowerCase());
  const branchText = useSiblings ? `${text} ${lower(leaf.siblings)}` : text;
  const semantic = `${leaf.path.toLowerCase()} ${branchText}`;
  if (!/(?:fizzl|failure|fails?|failed|no legal|no eligible|no .* tile|allocation|returns? null|empty search|missilecreationfailed)/.test(semantic)) return [];
  if (mentionsForeignSpell(branchText, context)) return [];
  if (/successfully created/.test(branchText) && /child placement/.test(branchText)
    && /do not refund|no refund/.test(branchText)) {
    const consumeStep = context.ledger.steps.find((step) => step.phase === 'consume');
    return [result(
      'fizzle.resource', leaf, 'Successful initial creation reaches consumption before child processing => consumed',
      'agrees', firstRef(consumeStep?.refs, context.ledger.refs),
    )];
  }
  if (/(?:allocation failure|allocation-fizzle)/.test(branchText)
    && /\bpaid\b|consum(?:e|es|ed|ption)/.test(branchText)) return [];
  const processStep = context.ledger.steps.find((step) => step.phase === 'process');
  if (/revalidat/.test(branchText) && /revalidat/.test(lower(processStep?.what ?? ''))
    && /after payment/.test(lower(processStep?.what ?? ''))) {
    const producedConsumed = /after payment|mana after cast\s*=.*[-−]|resource:\s*consumed/.test(branchText);
    return [result(
      'fizzle.resource', leaf, 'Processing revalidation occurs after payment => consumed',
      producedConsumed ? 'agrees' : 'undecidable', firstRef(processStep?.refs, context.ledger.refs),
    )];
  }
  const branch = closestBranch(branchText, context);
  if (!branch) return [];
  const claims: SpellTruthClaim[] = [];
  const saysFree = /\bfree\b|without (?:mana |resource )?(?:cost|payment|consumption|deduction)|before resource consumption|skip(?:s|ped)? (?:resource )?(?:cost|payment|consumption)|consum(?:e|es|ed|ption) no[^.!]{0,20}(?:resource|mana|charge|scroll)|no[^.!]{0,20}(?:resource|mana|charge|scroll)[^.!]{0,15}(?:consum|deduct|spent)|no (?:mana |resource )?(?:cost|payment|deduction)|costs? 0|resource:\s*free/.test(branchText);
  const explicitlyConsumed = /\bpaid\b|after payment|(?:resource|mana|charge|scroll)[^.!]{0,25}(?:consum|deduct|spent)|consum(?:e|es|ed|ption)[^.!]{0,25}(?:resource|mana|charge|scroll|selected source)|resource:\s*consumed/.test(branchText);
  if (saysFree && explicitlyConsumed) return [];
  const saysConsumed = explicitlyConsumed;
  if (saysFree || saysConsumed) {
    const producedResource = saysFree && !saysConsumed ? 'free' : saysConsumed && !saysFree ? 'consumed' : undefined;
    claims.push(result(
      'fizzle.resource', leaf, `${branch.condition} => ${branch.resource}`,
      producedResource ? (producedResource === branch.resource ? 'agrees' : 'contradicts') : 'undecidable',
      firstRef(branch.refs),
    ));
  }
  const saysSets = /sets? spellfizzled|records? a fizzle|\bfizzles?\b|setsspellfizzled:\s*true/.test(branchText);
  const saysDoesNotSet = /without (?:setting[^.!]{0,20})?spellfizzled|without setting[^.!]{0,30}fizzl|does not (?:set|record)[^.!]{0,20}fizzl|fizzl[^.!]{0,20}(?:remains?|stays?) unset|not (?:marked as )?(?:a )?fizzl|not an allocation fizzle|setsspellfizzled:\s*false/.test(branchText);
  if (branch.setsSpellFizzled !== undefined && (saysSets || saysDoesNotSet)) {
    const producedSets = saysSets && !saysDoesNotSet;
    claims.push(result(
      'fizzle.setsSpellFizzled', leaf, `${branch.condition} => ${String(branch.setsSpellFizzled)}`,
      producedSets === branch.setsSpellFizzled ? 'agrees' : 'contradicts', firstRef(branch.refs),
    ));
  }
  return claims;
}

function damageLawFact(context: SpellContext): { text: string; refs: readonly string[] } | undefined {
  const spell = identity(context.ledger.spell);
  const matches = (context.damageUnitsLaws ?? []).flatMap((law) => law.body
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => identity(sentence).includes(spell))
    .map((text) => ({ text, refs: law.refs ?? [] })));
  return matches.length === 1 ? matches[0] : undefined;
}

function chooseMissileFact(
  leaf: LeafClaim,
  context: SpellContext,
  field: 'damageSource' | 'lifetime' | 'collision' | 'movement',
): { value: string; refs: readonly string[] } | undefined {
  if (context.missiles.length === 0) return undefined;
  const semantic = `${leaf.path} ${String(leaf.value)}`;
  const ranked = context.missiles
    .map((spec) => ({
      spec,
      score: overlap(semantic, `${spec.missileIds.join(' ')} ${spec.movement} ${spec.collision} ${spec[field]}`),
    }))
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 1 || ranked[0].score > ranked[1].score) {
    return { value: ranked[0].spec[field], refs: ranked[0].spec.refs };
  }
  const values = [...new Set(context.missiles.map((spec) => spec[field]))];
  return values.length === 1 ? { value: values[0], refs: context.missiles[0].refs } : undefined;
}

function damageFormulaCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim | undefined {
  const text = lower(leaf.value);
  const semantic = `${leaf.path.toLowerCase()} ${text}`;
  if (!/(?:damage|damageresolution|damagesource|formula|roll)/.test(semantic)
    || /(?:damagetype|damageexecution|no damage|none)/.test(semantic)) return undefined;
  const fact = chooseMissileFact(leaf, context, 'damageSource');
  if (!fact) return undefined;
  const clauses = fact.value.split(/;|\botherwise\b/i).map((clause) => clause.trim()).filter(Boolean);
  const rankedClauses = clauses.map((clause) => ({ clause, score: overlap(semantic, clause) })).sort((a, b) => b.score - a.score);
  const ownershipClause = /\bmonster\b/.test(text) ? clauses.find((clause) => /non-player|monster/.test(lower(clause)))
    : /\bplayer\b/.test(text) ? clauses.find((clause) => /\bplayer\b/.test(lower(clause)) && !/non-player/.test(lower(clause)))
      : undefined;
  const engine = ownershipClause ?? (rankedClauses[0]?.score > 0 ? rankedClauses[0].clause : fact.value);
  let verdict: SpellTruthVerdict = 'undecidable';
  if (sameFormula(leaf.value, engine)) verdict = 'agrees';
  else if (/\bfixed\b/.test(text) && /\bconstant\b/.test(lower(engine))
    && numbers(engine).every((value) => numbers(leaf.value).includes(value))) verdict = 'agrees';
  else if (/\b(?:always|universally|fixed)\b/.test(text) && numbers(text).length >= 1 && /(?:level|magic|spell|roll|\bC\b|\bS\b)/i.test(engine)) {
    verdict = 'contradicts';
  } else if (formulaLike(leaf.value) && formulaLike(engine)) {
    const producedNumbers = numbers(leaf.value).join(',');
    const engineNumbers = numbers(engine).join(',');
    const tokenOverlap = overlap(leaf.value, engine);
    if (producedNumbers === engineNumbers && tokenOverlap >= 2) verdict = 'agrees';
    else if (leaf.path.toLowerCase().endsWith('formula')) verdict = 'contradicts';
  }
  return result('damage.formula', leaf, engine, verdict, firstRef(fact.refs));
}

function statedEquationIsValid(produced: unknown, engine: string): boolean | undefined {
  const expression = lower(produced).match(/(\d+(?:\s*\+\s*\d+)+)\s*=\s*(\d+)/);
  if (!expression) return undefined;
  const operands = expression[1].split('+').map((value) => Number(value.trim()));
  const stated = Number(expression[2]);
  if (!operands.every((operand) => numbers(engine).includes(String(operand)))) return undefined;
  return operands.reduce((sum, operand) => sum + operand, 0) === stated;
}

function durationCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim | undefined {
  const text = lower(leaf.value);
  const semantic = `${leaf.path.toLowerCase()} ${text}`;
  if (/casttime|releasetime|cooldown/.test(leaf.path.toLowerCase()) || /cast(?:-| )time|release time/.test(text)) return undefined;
  if (/(?:divisor|multiplier|offset|base)$/.test(leaf.key.toLowerCase())) return undefined;
  if (!/(?:duration|lifetime|lifecycleticks|travel(?:ticks|window)|expiryfadeticks|lasts?\b|flight[^.!]{0,30}ticks?|fade[^.!]{0,20}ticks?)/.test(semantic)) return undefined;
  if (mentionsForeignSpell(text, context)) return undefined;

  const missileFact = chooseMissileFact(leaf, context, 'lifetime');
  const candidates = [
    { value: context.ledger.durationRule, refs: context.ledger.refs },
    ...(missileFact ? [missileFact] : []),
  ].flatMap((candidate) => [
    candidate,
    ...candidate.value.split(/;|,|\bthen\b/i).map((value) => ({ value: value.trim(), refs: candidate.refs })).filter(({ value }) => value),
  ]);
  if (/maximum lifetime/.test(text) && /never decremented/.test(lower(context.ledger.durationRule))) {
    return result('duration.rule', leaf, context.ledger.durationRule, 'contradicts', firstRef(context.ledger.refs));
  }
  const matching = candidates.find((candidate) => sameFormula(leaf.value, candidate.value));
  if (matching) return result('duration.rule', leaf, matching.value, 'agrees', firstRef(matching.refs));

  const equation = statedEquationIsValid(leaf.value, candidates.map((candidate) => candidate.value).join(' '));
  if (equation !== undefined) {
    return result(
      'duration.rule', leaf, candidates[0].value, equation ? 'agrees' : 'contradicts', firstRef(candidates[0].refs),
    );
  }

  const producedNumbers = numbers(leaf.value);
  const subsetMatch = candidates.find((candidate) => {
    const candidateNumbers = numbers(candidate.value);
    return candidateNumbers.length > 0 && candidateNumbers.every((value) => producedNumbers.includes(value));
  });
  if (subsetMatch) return result('duration.rule', leaf, subsetMatch.value, 'agrees', firstRef(subsetMatch.refs));

  const comparable = candidates.filter((candidate) => numbers(candidate.value).length > 0);
  let selected = comparable.length === 1 ? comparable[0] : undefined;
  if (!selected && comparable.length > 1) {
    const ranked = comparable.map((candidate) => ({ candidate, score: overlap(semantic, candidate.value) })).sort((a, b) => b.score - a.score);
    if (ranked[0] && (!ranked[1] || ranked[0].score > ranked[1].score)) selected = ranked[0].candidate;
    else if (new Set(comparable.map((candidate) => numbers(candidate.value).join(','))).size === 1) selected = comparable[0];
  }
  let verdict: SpellTruthVerdict = 'undecidable';
  if (selected && numbers(leaf.value).length > 0) {
    const producedSignature = numbers(leaf.value).join(',');
    const engineNumbers = numbers(selected.value).join(',');
    if (producedSignature === engineNumbers && overlap(leaf.value, selected.value) >= 1) verdict = 'agrees';
    else if (leaf.path.toLowerCase() !== 'claim' && producedSignature && engineNumbers
      && (typeof leaf.value === 'number' || !String(leaf.value).includes('='))) verdict = 'contradicts';
  }
  const engine = selected?.value ?? candidates.map((candidate) => candidate.value).join(' | ');
  return result('duration.rule', leaf, engine, verdict, firstRef(selected?.refs ?? context.ledger.refs));
}

function hitCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim[] {
  if (!context.hits) return [];
  const text = lower(leaf.value);
  const semantic = `${leaf.path.toLowerCase()} ${text}`;
  const claims: SpellTruthClaim[] = [];
  const rollTerms: Array<[RegExp, PlayerSpellHitSource['damageRoll']]> = [
    [/once[- ]per[- ]cast|one (?:shared )?(?:damage )?roll[^.!]{0,20}(?:cast|all)/, 'once-per-cast'],
    [/once[- ]per[- ]child|each child (?:rolls|stores) (?:one|its own)/, 'once-per-child'],
    [/once[- ]per[- ]segment|each segment (?:rolls|stores) (?:one|its own)/, 'once-per-segment'],
    [/once[- ]per[- ]projectile|each (?:bolt|projectile) (?:rolls|stores) (?:one|its own)/, 'once-per-projectile'],
  ];
  const producedRoll = rollTerms.find(([pattern]) => pattern.test(text))?.[1];
  const rerollsEveryTick = /rerolls? (?:its )?damage (?:on )?every tick|damage[^.!]{0,20}reroll[^.!]{0,15}(?:tick|check)/.test(text);
  if (producedRoll || rerollsEveryTick || /damageroll/.test(leaf.path.toLowerCase())) {
    let verdict: SpellTruthVerdict = 'undecidable';
    if (producedRoll) verdict = producedRoll === context.hits.damageRoll ? 'agrees' : 'contradicts';
    else if (rerollsEveryTick) verdict = 'contradicts';
    else if (typeof leaf.value === 'string') verdict = compact(leaf.value) === compact(context.hits.damageRoll) ? 'agrees' : 'contradicts';
    claims.push(result('hits.damageRoll', leaf, context.hits.damageRoll, verdict, firstRef(context.hits.refs)));
  }

  if (/collisionchecks|hitcount|checks? (?:its |the )?(?:tile|occupant|target)|\bchecks?\b[^.!]{0,20}\b(?:tick|segment|path)/.test(semantic)) {
    const collisionCandidates = context.hits.collisionChecks.split(';').map((value) => value.trim()).filter(Boolean);
    let verdict: SpellTruthVerdict = 'undecidable';
    if (collisionCandidates.some((candidate) => sameFormula(leaf.value, candidate))) verdict = 'agrees';
    else if (formulaLike(leaf.value) && formulaLike(context.hits.collisionChecks)) {
      const producedNumbers = numbers(leaf.value);
      const agreesWithClause = collisionCandidates.some((candidate) => {
        const engineNumbers = numbers(candidate);
        return engineNumbers.length > 0 && engineNumbers.every((value) => producedNumbers.includes(value));
      });
      if (agreesWithClause) verdict = 'agrees';
      else if (/collisionchecks|hitcount/.test(leaf.path.toLowerCase())) verdict = 'contradicts';
    }
    claims.push(result('hits.collisionChecks', leaf, context.hits.collisionChecks, verdict, firstRef(context.hits.refs)));
  }

  const saysNoRecheck = /without[^.!]{0,80}repeat(?:ed)? hits?|does not recheck|cannot receive persistent repeat|\bno\b[^.!]{0,80}repeat(?:ed)? hits?|neither[^.!]{0,100}repeat(?:ed)? hits?/.test(text);
  const saysRechecks = !saysNoRecheck && /repeat(?:ed)? hits?|rechecks? (?:the )?(?:same )?(?:target|occupant)|checks? (?:the )?(?:same )?(?:target|occupant) every tick/.test(text);
  const saysStops = /stops? (?:damaging )?after (?:the )?first|deleted on (?:the )?first (?:successful )?hit/.test(text);
  if (saysRechecks || saysNoRecheck || saysStops || /hitresult/.test(leaf.path.toLowerCase())) {
    let producedResult: PlayerSpellHitSource['hitResult'] | undefined;
    if (saysRechecks) producedResult = 'persists-and-rechecks';
    else if (saysNoRecheck) producedResult = 'persists-without-rechecking-target';
    else if (saysStops) producedResult = context.hits.hitResult === 'stops-damaging-after-hit'
      ? 'stops-damaging-after-hit' : context.hits.hitResult === 'child-deleted-on-hit'
        ? 'child-deleted-on-hit' : undefined;
    else if (typeof leaf.value === 'string') producedResult = leaf.value as PlayerSpellHitSource['hitResult'];
    claims.push(result(
      'hits.persistence', leaf, context.hits.hitResult,
      producedResult ? (producedResult === context.hits.hitResult ? 'agrees' : 'contradicts') : 'undecidable',
      firstRef(context.hits.refs),
    ));
  }
  return claims;
}

function unitsAndBlockabilityCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim[] {
  const text = lower(leaf.value);
  const semantic = `${leaf.path.toLowerCase()} ${text}`;
  const claims: SpellTruthClaim[] = [];
  const describesPostHitRepresentation = /(?:outcomes?|results?)[^.!]{0,30}representable|enters? internal fixed[- ]point/.test(text);
  const saysWhole = !describesPostHitRepresentation && /whole(?:-| )?(?:hit points?|hp)|unshifted/.test(text);
  const saysFixed = !describesPostHitRepresentation && /1\s*\/\s*64|fixed[- ]point|already[- ]shifted|internal hp/.test(text);
  const lawFact = damageLawFact(context);
  const lawUnits = lawFact && /whole hp|scaled x64/.test(lower(lawFact.text)) ? 'whole-hit-points'
    : lawFact && /1\s*\/\s*64|already/.test(lower(lawFact.text)) ? 'already-shifted-fixed-point'
      : undefined;
  const engineUnits = context.hits?.collisionDamage ?? lawUnits;
  if ((saysWhole || saysFixed || /damageunits|collisiondamage/.test(leaf.path.toLowerCase())) && engineUnits) {
    const producedUnits = saysWhole && !saysFixed ? 'whole-hit-points'
      : saysFixed && !saysWhole ? 'already-shifted-fixed-point'
        : typeof leaf.value === 'string' ? leaf.value : undefined;
    claims.push(result(
      'damage.units', leaf, engineUnits,
      producedUnits ? (compact(producedUnits) === compact(engineUnits) ? 'agrees' : 'contradicts') : 'undecidable',
      firstRef(context.hits?.refs ?? lawFact?.refs, context.ledger.refs),
    ));
  }

  if (/blockable/.test(semantic)) {
    const fact = chooseMissileFact(leaf, context, 'collision');
    const engineText = fact?.value ?? lawFact?.text ?? '';
    const engineLower = lower(engineText);
    const explicitlyUnblockable = /\bunblockable\b/.test(engineLower);
    const explicitlyBlockable = /\bblockable\b/.test(engineLower) && !explicitlyUnblockable;
    const producedBlockable = typeof leaf.value === 'boolean' ? leaf.value
      : /\bunblockable\b|not blockable/.test(text) ? false
        : /\bblockable\b/.test(text) ? true : undefined;
    const engineBlockable = explicitlyUnblockable ? false : explicitlyBlockable ? true : undefined;
    claims.push(result(
      'damage.blockable', leaf, engineText || '(no structured blockability fact)',
      producedBlockable === undefined || engineBlockable === undefined
        ? 'undecidable' : producedBlockable === engineBlockable ? 'agrees' : 'contradicts',
      firstRef(fact?.refs ?? context.damageUnitsLaws?.flatMap((law) => law.refs ?? []), context.ledger.refs),
    ));
  }
  return claims;
}

function factionCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim | undefined {
  const text = lower(leaf.value);
  const semantic = `${leaf.path.toLowerCase()} ${text}`;
  if (!/(?:faction|friendly fire|either side|both sides|allies|enemies|players and monsters)/.test(semantic)) return undefined;
  const facts = engineSentences(context).filter((fact) => /(?:faction|friendly fire|either side|both sides|allies|enemies|players and monsters)/.test(lower(fact.text)));
  if (facts.length !== 1) return result('targeting.faction', leaf, '(no unambiguous structured faction fact)', 'undecidable', firstRef(context.ledger.refs));
  const engine = lower(facts[0].text);
  const producedBoth = /either side|both sides|players and monsters|harms? allies/.test(text);
  const producedEnemies = /enemies only|only enemies|hostile only/.test(text);
  const engineBoth = /either side|both sides|players and monsters|harms? allies/.test(engine);
  const engineEnemies = /enemies only|only enemies|hostile only/.test(engine);
  const verdict = producedBoth || producedEnemies
    ? producedBoth === engineBoth && producedEnemies === engineEnemies ? 'agrees' : 'contradicts'
    : 'undecidable';
  return result('targeting.faction', leaf, facts[0].text, verdict, firstRef(facts[0].refs));
}

function engineSentences(context: SpellContext): Array<{ text: string; refs: readonly string[] }> {
  const sentences: Array<{ text: string; refs: readonly string[] }> = [];
  for (const step of context.ledger.steps) {
    for (const text of [step.what, step.hitResult, ...(step.branches ?? []).flatMap((branch) => [branch.condition, branch.outcome])]) {
      if (text) sentences.push({ text, refs: step.refs });
    }
  }
  for (const spec of context.missiles) {
    for (const text of [spec.movement, spec.lifetime, spec.collision]) sentences.push({ text, refs: spec.refs });
  }
  for (const branch of context.fizzleBranches) sentences.push({ text: branch.failure, refs: branch.refs });
  return sentences;
}

function targetingCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim[] {
  const text = lower(leaf.value);
  const path = leaf.path.toLowerCase();
  const semantic = `${path} ${text}`;
  const facts = engineSentences(context);
  const claims: SpellTruthClaim[] = [];
  if (/\b(?:circular|euclidean|square|axis[- ]aligned|crawl[- ]ring)\b/.test(semantic)) {
    const shapeFacts = facts.filter((fact) => /\b(?:circular|euclidean|square|axis[- ]aligned|crawl[- ]ring)\b/.test(lower(fact.text)));
    const matching = shapeFacts.find((fact) => overlap(text, fact.text) > 0);
    claims.push(result(
      'targeting.shape', leaf, matching?.text ?? '(no structured shape fact)',
      matching ? 'agrees' : 'undecidable', firstRef(matching?.refs, context.ledger.refs),
    ));
  }
  if (/requireslos|requireslineofsight|lineofsight|line-of-sight|\blos\b|line clear/.test(semantic)) {
    const relevant = facts.filter((fact) => /line[- ]clear|line[- ]visible|line of sight|sight geometry/.test(lower(fact.text)));
    const negative = relevant.filter((fact) => /does not require|no line of sight|without (?:a )?line[- ]of[- ]sight|vanilla does not require|sight geometry do not/.test(lower(fact.text)));
    const positive = relevant.filter((fact) => /requires?[^.!]{0,20}line|line[- ]clear|line[- ]visible/.test(lower(fact.text)) && !negative.includes(fact));
    const produced = typeof leaf.value === 'boolean' ? leaf.value
      : /(?:requires?|with) (?:a )?(?:line of sight|line[- ]clear|los)/.test(text) ? true
        : /(?:does not require|without|ignores?) (?:a )?(?:line of sight|line[- ]clear|los)|requireslos is (?:always )?false/.test(text) ? false
          : undefined;
    const engine = positive.length && !negative.length ? true : negative.length && !positive.length ? false : undefined;
    const evidence = (engine === true ? positive : engine === false ? negative : relevant)[0];
    const overgeneralizesVanilla = produced === false && /\balways\b/.test(text)
      && negative.some((fact) => /\bvanilla\b/.test(lower(fact.text)));
    const processVisibilityOnly = positive.length > 0 && positive.every((fact) => /line[- ]visible/.test(lower(fact.text)))
      && /requireslos|requireslineofsight/.test(path);
    claims.push(result(
      'targeting.requiresLineOfSight', leaf,
      relevant.map((fact) => fact.text).join(' | ') || '(no unambiguous structured line-of-sight fact)',
      produced === undefined || engine === undefined || processVisibilityOnly ? 'undecidable'
        : overgeneralizesVanilla ? 'contradicts' : produced === engine ? 'agrees' : 'contradicts',
      firstRef(evidence?.refs, context.ledger.refs),
    ));
  }

  const targetingRangePath = /(?:range|radius|distancecap|placementrange|searchradius)/.test(path)
    && !/(?:damage|heal|roll)range/.test(path);
  if (targetingRangePath
    || /\b(?:range|radius)\s*-?\s*\d+|within \d+ tiles?/.test(text)) {
    const radiusFacts = facts.filter((fact) => /(?:radius|within)\s*-?\s*\d+|\d+\s*tiles?/.test(lower(fact.text)));
    const ranked = radiusFacts.map((fact) => ({ fact, score: overlap(semantic, fact.text) })).sort((a, b) => b.score - a.score);
    let selected: { text: string; refs: readonly string[] } | undefined = ranked[0]?.fact;
    if (ranked[1] && ranked[0].score === ranked[1].score) {
      const unique = [...new Set(radiusFacts.map((fact) => numbers(fact.text).join(',')))];
      if (unique.length !== 1) selected = undefined;
    }
    const producedNumbers = numbers(leaf.value);
    const engineNumbers = numbers(selected?.text ?? '');
    let verdict: SpellTruthVerdict = 'undecidable';
    if (selected && producedNumbers.length && engineNumbers.length) {
      verdict = producedNumbers.some((value) => engineNumbers.includes(value)) ? 'agrees' : 'contradicts';
    }
    claims.push(result(
      'targeting.range', leaf, selected?.text ?? (radiusFacts.map((fact) => fact.text).join(' | ') || '(no unambiguous structured range fact)'),
      verdict, firstRef(selected?.refs, context.ledger.refs),
    ));
  }

  if (/(?:targeting\.)?anchor|cast origin|caster[- ]anchored|anchored to/.test(semantic)) {
    const anchorFacts = facts.filter((fact) => /(?:around|near|from|at|to) (?:the )?(?:caster|target|destination|origin)|cast origin/.test(lower(fact.text)));
    const ranked = anchorFacts.map((fact) => ({ fact, score: overlap(semantic, fact.text) })).sort((a, b) => b.score - a.score);
    const selected = ranked[0]?.score >= 2 ? ranked[0].fact : undefined;
    let verdict: SpellTruthVerdict = 'undecidable';
    if (selected) {
      const producedCaster = /caster|cast origin/.test(text);
      const producedTarget = /target|destination|clicked/.test(text);
      const engineCaster = /caster|cast origin/.test(lower(selected.text));
      const engineTarget = /target|destination|clicked/.test(lower(selected.text));
      if ((producedCaster || producedTarget) && (engineCaster || engineTarget)) {
        verdict = producedCaster === engineCaster && producedTarget === engineTarget ? 'agrees' : 'contradicts';
      }
    }
    claims.push(result('targeting.anchor', leaf, selected?.text ?? '(no unambiguous structured anchor fact)', verdict, firstRef(selected?.refs, context.ledger.refs)));
  }
  return claims;
}

function persistenceCheck(leaf: LeafClaim, context: SpellContext): SpellTruthClaim | undefined {
  const text = lower(leaf.value);
  const path = leaf.path.toLowerCase();
  if (/status|crossreferences/.test(path) || /(?:actor|cataloged|applied) status|cursor|selection|persistent[- ](?:ground|world)[- ]effect|persistent hazard/.test(text)
    || !/(?:persist(?:s|ent|ence)?|no timed expiry|until (?:depletion|teardown|killed|recast))/.test(`${path} ${text}`)) return undefined;
  if (mentionsForeignSpell(text, context)) return undefined;
  const engine = `${context.ledger.durationRule}; ${context.ledger.steps.find((step) => step.phase === 'process')?.hitResult ?? ''}`;
  const enginePersistent = /persistent|persists|until /.test(lower(engine));
  const producedPersistent = !/(?:does not persist|\bno\b[^.!]{0,200}persist|nonpersistent|not persistent|(?:persistent[^.!=]{0,30})?=\s*∅|empty persistent)/.test(text);
  return result(
    'lifecycle.persistence', leaf, engine,
    producedPersistent === enginePersistent ? 'agrees' : 'contradicts',
    firstRef(context.ledger.steps.find((step) => step.phase === 'process')?.refs, context.ledger.refs),
  );
}

function checkLeaf(leaf: LeafClaim, context: SpellContext): SpellTruthClaim[] {
  const claims: SpellTruthClaim[] = [];
  const singleChecks = [
    manaCheck(leaf, context), orderCheck(leaf, context), damageFormulaCheck(leaf, context),
    durationCheck(leaf, context), persistenceCheck(leaf, context), factionCheck(leaf, context),
  ];
  claims.push(...singleChecks.filter((claim): claim is SpellTruthClaim => claim !== undefined));
  claims.push(...fizzleCheck(leaf, context));
  claims.push(...hitCheck(leaf, context));
  claims.push(...unitsAndBlockabilityCheck(leaf, context));
  claims.push(...targetingCheck(leaf, context));
  if (claims.length) return claims;
  return [result(leaf.path, leaf, '(no deterministic matcher for this field)', 'undecidable', firstRef(context.ledger.refs))];
}

/**
 * Walk a free-form produced artifact and compare only semantics backed by structured engine facts.
 * Every primitive field produces at least one result; unsupported semantics remain undecidable.
 */
export function spellTruthCheck(
  entityId: string,
  artifact: unknown,
  data: SpellTruthCheckData = DEFAULT_DATA,
): SpellTruthClaim[] {
  const context = contextFor(entityId, data);
  const leaves = flatten(artifact);
  if (!context) {
    return leaves.map((leaf) => result(leaf.path, leaf, '(no spell cast ledger)', 'undecidable', ''));
  }
  return leaves.flatMap((leaf) => checkLeaf(leaf, context));
}

export const checkSpellTruth = spellTruthCheck;
