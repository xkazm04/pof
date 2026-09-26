import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { fieldsRequiredWhen } from '@/lib/catalog/acceptance/conditionalCheckers';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';

const wiringContract = {
  grantedBy: 'The owning runtime component registers this declared artifact during initialization.',
  activatedBy: 'The declared gameplay event invokes this artifact through its registered runtime path.',
  dependencies: [],
  verification: 'L2: the registered path and every declared field are verified by an automated configuration test.',
};

function step(catalogId: string, label: string) {
  const pipeline = allCatalogPipelines().find((candidate) => candidate.catalogId === catalogId);
  const found = pipeline?.steps.find((candidate) => candidate.label === label);
  if (!found) throw new Error(`missing registered step ${catalogId} · ${label}`);
  return found;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function remove(value: object, field: string): void {
  delete (value as Record<string, unknown>)[field];
}

function expectPass(catalogId: string, label: string, artifact: Record<string, unknown>) {
  expect(step(catalogId, label).accept(artifact), `${catalogId} · ${label}`).toMatchObject({ status: 'pass' });
}

function expectFieldFailure(catalogId: string, label: string, artifact: Record<string, unknown>, field: string) {
  const result = step(catalogId, label).accept(artifact);
  expect(result.status, `${catalogId} · ${label}: ${result.reason}`).toBe('fail');
  expect(result.reason).toContain(field);
}

describe('conditional checker primitives', () => {
  const checker = fieldsRequiredWhen('targeting', 'projectile shape', 'shape', ['projectile'], ['speed'], 'includes');

  it('requires a conditional field when the artifact selects that shape', () => {
    const result = checker({ targeting: { shape: 'arcing-projectile' } });
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('speed');
  });

  it('does not impose projectile fields on a self-target shape', () => {
    expect(checker({ targeting: { shape: 'self' } }).status).toBe('pass');
  });

  it('rejects a wrong-type discriminator instead of bypassing the condition', () => {
    const result = checker({ targeting: { shape: 42, speed: 10 } });
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('targeting.shape');
  });
});

describe('spellbook world-neutral graders', () => {
  it('Effect Logic accepts a resource-gated healing spell and rejects an incomplete effect entry', () => {
    const artifact = {
      effect: {
        abilityId: 'GA_MendingCurrent',
        activation: 'active cast from the support slot',
        gatedBy: 'resource',
        manaCost: 14,
        wiringContract,
      },
      effects: [{ kind: 'heal', target: 'selected-ally', value: 28 }],
    };
    expectPass('spellbook', 'Effect Logic', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.effects[0], 'target');
    expectFieldFailure('spellbook', 'Effect Logic', incomplete, 'target');
  });

  it('Targeting accepts another projectile shape and requires its projectile speed', () => {
    const artifact = {
      targeting: { shape: 'chain-projectile', range: 1250, requiresLoS: false, projectileSpeed: 1700 },
    };
    expectPass('spellbook', 'Targeting', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.targeting, 'projectileSpeed');
    expectFieldFailure('spellbook', 'Targeting', incomplete, 'projectileSpeed');
  });

  it('Balance accepts another damage equation, rejects its missing component, and permits utility power', () => {
    const artifact = {
      balance: {
        kind: 'damage',
        baseDamage: 24,
        cooldown: 2,
        hitDPS: 12,
        chillDPS: 4,
        components: ['hitDPS', 'chillDPS'],
        normalizedPower: 16,
        tierTarget: 16,
      },
    };
    expectPass('spellbook', 'Balance', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.balance, 'chillDPS');
    expectFieldFailure('spellbook', 'Balance', incomplete, 'chillDPS');
    expectPass('spellbook', 'Balance', { balance: { kind: 'utility', normalizedPower: 55, tierTarget: 55 } });
  });

  it('VFX accepts an invented persistent aura binding and rejects a missing trigger', () => {
    const artifact = { vfx: [{ node: 'auraPulse', asset: 'NS_MendingAura', trigger: 'healing aura becomes active' }] };
    expectPass('spellbook', 'VFX', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.vfx[0], 'trigger');
    expectFieldFailure('spellbook', 'VFX', incomplete, 'trigger');
  });
});

describe('status-effects world-neutral graders', () => {
  it('Effect Logic accepts a different periodic ailment and requires its declared periodic shape', () => {
    const artifact = {
      effect: {
        tag: 'State.VenomSick',
        kind: 'damage-over-time',
        stacking: 'refresh',
        dispellable: true,
        removal: { mode: 'duration-or-cleanse' },
        magnitude: -2,
        period: 0.75,
        duration: 6,
        sourceDamageType: 'Poison',
        wiringContract,
      },
    };
    expectPass('status-effects', 'Effect Logic', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.effect, 'period');
    expectFieldFailure('status-effects', 'Effect Logic', incomplete, 'period');
  });

  it('Balance accepts a stun with duration termination and rejects a missing termination mode', () => {
    const artifact = {
      balance: {
        kind: 'control',
        controlBudget: {
          controlKind: 'stun',
          magnitude: 1,
          durationSec: 1.4,
          immunityTag: 'State.Immune.Stun',
          immunityWindowSec: 2.5,
          terminationMode: 'duration',
        },
      },
    };
    expectPass('status-effects', 'Balance', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.balance.controlBudget, 'terminationMode');
    expectFieldFailure('status-effects', 'Balance', incomplete, 'terminationMode');
  });
});

describe('progression-curves world-neutral graders', () => {
  it('XP Sources accepts a mastery-training source and rejects a missing formula', () => {
    const artifact = {
      xpSources: [{ source: 'training-completion', formula: 'grant = drillRank × 12', contribution: '100% of mastery progress' }],
      wiringContract,
    };
    expectPass('progression-curves', 'XP Sources', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.xpSources[0], 'formula');
    expectFieldFailure('progression-curves', 'XP Sources', incomplete, 'formula');
  });

  it('Reward Schedule accepts reputation rewards and rejects a missing trigger', () => {
    const artifact = {
      rewards: [{ kind: 'vendor-permit', grant: 'unlock the harbor quartermaster', trigger: 'reach reputation rank 12' }],
      wiringContract,
    };
    expectPass('progression-curves', 'Reward Schedule', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.rewards[0], 'trigger');
    expectFieldFailure('progression-curves', 'Reward Schedule', incomplete, 'trigger');
  });

  it('Balance accepts a declared table-curve checkpoint and rejects a missing rate', () => {
    const artifact = {
      balance: {
        kind: 'checkpoint',
        checkpoint: 'Mastery rank 17→18',
        requiredAmount: 2400,
        ratePerMinute: 80,
        elapsedMinutes: 30,
        targetMinutes: 30,
      },
    };
    expectPass('progression-curves', 'Balance', artifact);

    const incomplete = clone(artifact);
    remove(incomplete.balance, 'ratePerMinute');
    expectFieldFailure('progression-curves', 'Balance', incomplete, 'ratePerMinute');
  });
});
