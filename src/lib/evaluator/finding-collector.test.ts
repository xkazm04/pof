import { describe, it, expect } from 'vitest';
import { parseFindings } from './finding-collector';
import type { SubModuleId } from '@/types/modules';
import type { EvalPass } from './module-eval-prompts';

const MODULE: SubModuleId = 'arpg-combat';

function parse(raw: string, pass: EvalPass = 'quality') {
  return parseFindings(raw, 'scan-1', MODULE, pass);
}

const SAMPLE_FINDINGS = [
  {
    category: 'gas',
    severity: 'high',
    file: 'Combat/GA_MeleeAttack.cpp',
    line: 42,
    description: 'Armor attribute is read by GE_Damage but never set by any DataTable',
    suggestedFix: 'Add DT_AttributeDefaults with an Armor row',
    effort: 'small',
  },
  {
    category: 'gas',
    severity: 'medium',
    file: 'Combat/UARPGDamageExecution.cpp',
    line: 88,
    description: 'CriticalChance read but no source attribute defined',
    suggestedFix: 'Define CriticalChance in the attribute set defaults',
    effort: 'small',
  },
];

const SAMPLE_JSON = JSON.stringify(SAMPLE_FINDINGS);

describe('parseFindings — clean JSON (unchanged behaviour)', () => {
  it('parses a bare JSON array identically', () => {
    const findings = parse(SAMPLE_JSON);
    expect(findings).toHaveLength(2);
    expect(findings[0].description).toBe(SAMPLE_FINDINGS[0].description);
    expect(findings[0].severity).toBe('high');
    expect(findings[0].file).toBe('Combat/GA_MeleeAttack.cpp');
    expect(findings[0].line).toBe(42);
    expect(findings[1].description).toBe(SAMPLE_FINDINGS[1].description);
  });

  it('parses a JSON-only fenced block', () => {
    const findings = parse('```json\n' + SAMPLE_JSON + '\n```');
    expect(findings).toHaveLength(2);
    expect(findings[1].severity).toBe('medium');
  });

  it('returns [] for an empty array', () => {
    expect(parse('[]')).toEqual([]);
  });

  it('returns [] for non-array / garbage output', () => {
    expect(parse('No findings here.')).toEqual([]);
    expect(parse('{ "not": "an array" }')).toEqual([]);
  });
});

describe('parseFindings — prose before JSON (combat-trace regression)', () => {
  it('extracts findings when prose precedes the array', () => {
    const raw =
      'Here are the findings I traced for GA_MeleeAttack:\n\n' + SAMPLE_JSON;
    const findings = parse(raw, 'combat-trace');
    expect(findings).toHaveLength(2);
    expect(findings[0].description).toBe(SAMPLE_FINDINGS[0].description);
  });

  it('survives a combat-trace call graph with stray brackets before the array', () => {
    const callGraph = [
      '1. PlayerController activates GA_MeleeAttack via input action [IA_Attack].',
      '2. Activation tag Ability.Melee -> ActivateAbility().',
      '3. Damage path: Animation-driven [Event.MeleeHit notify]; when bUseAnimationDrivenDamage is false the Direct branch runs.',
      '4. GE_Damage applied via UARPGDamageExecution.',
      '5. Reads [AttackPower, Armor, CriticalChance]; writes [IncomingDamage, Health].',
      '6. Broadcasts OnHealthChanged, Event.Death [listeners: HUD, EnemySpawner].',
      '',
      'JSON findings array:',
    ].join('\n');
    const raw = callGraph + '\n' + SAMPLE_JSON;
    const findings = parse(raw, 'combat-trace');
    // Naive first-`[`/last-`]` would slice from "[IA_Attack]" to the last "]"
    // and throw, dropping every finding. Balanced scanning recovers them.
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.description)).toEqual(
      SAMPLE_FINDINGS.map((f) => f.description),
    );
  });

  it('extracts findings from a fenced block that follows prose', () => {
    const raw =
      'Call graph step 5 reads [AttackPower, Armor].\nFindings:\n\n```json\n' +
      SAMPLE_JSON +
      '\n```';
    const findings = parse(raw, 'combat-trace');
    expect(findings).toHaveLength(2);
    expect(findings[0].severity).toBe('high');
  });

  it('ignores a leading prose object and finds the real findings array', () => {
    const raw =
      'Summary: { "module": "arpg-combat", "passes": 5 }\n\n' + SAMPLE_JSON;
    const findings = parse(raw, 'combat-trace');
    expect(findings).toHaveLength(2);
  });

  it('does not split on a bracket inside a JSON string value', () => {
    const tricky = JSON.stringify([
      {
        category: 'gas',
        severity: 'high',
        file: null,
        line: null,
        description: 'Reads attributes [AttackPower, Armor] without defaults',
        suggestedFix: 'Add defaults',
        effort: 'small',
      },
    ]);
    const findings = parse('Trace done. ' + tricky, 'combat-trace');
    expect(findings).toHaveLength(1);
    expect(findings[0].description).toContain('[AttackPower, Armor]');
  });
});
