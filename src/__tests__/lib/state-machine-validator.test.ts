import { describe, it, expect } from 'vitest';
import {
  validateStateMachine,
  extractFlagsFromRule,
  groupWarningsByState,
  highestSeverity,
} from '@/lib/state-machine-validator';

const KNOWN_FLAGS = ['bIsAttacking', 'bIsDodging', 'bIsHitReacting', 'bIsDead', 'bIsFullBodyMontage'] as const;

interface S { id: string; name: string; priority: number; flag: string; isDefault?: boolean }
interface T { id: string; from: string; to: string; rule: string }

function makeBasic(): { states: S[]; transitions: T[] } {
  const states: S[] = [
    { id: 's1', name: 'Locomotion', priority: 2, flag: '(default)', isDefault: true },
    { id: 's2', name: 'Attacking', priority: 1, flag: 'bIsAttacking' },
    { id: 's3', name: 'Death', priority: 0, flag: 'bIsDead' },
  ];
  const transitions: T[] = [
    { id: 't1', from: 's1', to: 's2', rule: 'bIsAttacking == true' },
    { id: 't2', from: 's2', to: 's1', rule: 'bIsAttacking == false' },
    { id: 't3', from: 's1', to: 's3', rule: 'bIsDead == true' },
  ];
  return { states, transitions };
}

describe('extractFlagsFromRule', () => {
  it('pulls out b-prefixed flag identifiers', () => {
    expect(extractFlagsFromRule('bIsAttacking == true && !bIsFullBodyMontage')).toEqual(
      ['bIsAttacking', 'bIsFullBodyMontage'],
    );
  });
  it('returns empty for empty rule', () => {
    expect(extractFlagsFromRule('')).toEqual([]);
  });
  it('returns empty when no flag tokens present', () => {
    expect(extractFlagsFromRule('(default) // fallback')).toEqual([]);
  });
  it('dedupes repeats', () => {
    expect(extractFlagsFromRule('bIsDodging && bIsDodging == false')).toEqual(['bIsDodging']);
  });
});

describe('validateStateMachine — clean graph', () => {
  it('emits only the Death info finding for the default 3-state setup', () => {
    const { states, transitions } = makeBasic();
    const warnings = validateStateMachine(states, transitions, KNOWN_FLAGS);
    // Death is intentional → info severity, but still surfaced
    const nonInfo = warnings.filter((w) => w.severity !== 'info');
    expect(nonInfo).toEqual([]);
    const deathInfo = warnings.find((w) => w.kind === 'soft-lock-deadend' && w.stateIds.includes('s3'));
    expect(deathInfo?.severity).toBe('info');
  });
});

describe('validateStateMachine — unreachable states', () => {
  it('flags a state with no inbound path from entry', () => {
    const states: S[] = [
      { id: 's1', name: 'Locomotion', priority: 1, flag: '(default)', isDefault: true },
      { id: 's2', name: 'Orphan', priority: 0, flag: 'bIsAttacking' },
    ];
    const warnings = validateStateMachine(states, [], KNOWN_FLAGS);
    const unreachable = warnings.find((w) => w.kind === 'unreachable-state');
    expect(unreachable).toBeDefined();
    expect(unreachable!.severity).toBe('error');
    expect(unreachable!.stateIds).toEqual(['s2']);
  });
});

describe('validateStateMachine — soft-lock dead-ends', () => {
  it('flags a non-Death state with no return path as warning', () => {
    const states: S[] = [
      { id: 's1', name: 'Locomotion', priority: 1, flag: '(default)', isDefault: true },
      { id: 's2', name: 'HitReact', priority: 0, flag: 'bIsHitReacting' },
    ];
    const transitions: T[] = [
      { id: 't1', from: 's1', to: 's2', rule: 'bIsHitReacting == true' },
    ];
    const warnings = validateStateMachine(states, transitions, KNOWN_FLAGS);
    const softlock = warnings.find((w) => w.kind === 'soft-lock-deadend');
    expect(softlock).toBeDefined();
    expect(softlock!.severity).toBe('warning');
    expect(softlock!.stateIds).toEqual(['s2']);
  });
});

describe('validateStateMachine — duplicate priorities', () => {
  it('flags two states sharing a priority value', () => {
    const states: S[] = [
      { id: 's1', name: 'Locomotion', priority: 1, flag: '(default)', isDefault: true },
      { id: 's2', name: 'Attacking', priority: 1, flag: 'bIsAttacking' },
    ];
    const transitions: T[] = [
      { id: 't1', from: 's1', to: 's2', rule: 'bIsAttacking == true' },
      { id: 't2', from: 's2', to: 's1', rule: 'bIsAttacking == false' },
    ];
    const warnings = validateStateMachine(states, transitions, KNOWN_FLAGS);
    const dup = warnings.find((w) => w.kind === 'duplicate-priority');
    expect(dup).toBeDefined();
    expect(dup!.stateIds.sort()).toEqual(['s1', 's2']);
  });
});

describe('validateStateMachine — unknown flags', () => {
  it('flags a state whose flag is not in KNOWN_FLAGS', () => {
    const states: S[] = [
      { id: 's1', name: 'Locomotion', priority: 1, flag: '(default)', isDefault: true },
      { id: 's2', name: 'Custom', priority: 0, flag: 'bMyMadeUpFlag' },
    ];
    const transitions: T[] = [
      { id: 't1', from: 's1', to: 's2', rule: 'bMyMadeUpFlag == true' },
      { id: 't2', from: 's2', to: 's1', rule: 'bMyMadeUpFlag == false' },
    ];
    const warnings = validateStateMachine(states, transitions, KNOWN_FLAGS);
    const stateFlag = warnings.find((w) => w.kind === 'unknown-flag-in-state');
    expect(stateFlag).toBeDefined();
    expect(stateFlag!.stateIds).toEqual(['s2']);
    const ruleFlag = warnings.filter((w) => w.kind === 'unknown-flag-in-rule');
    expect(ruleFlag.length).toBeGreaterThan(0);
    expect(ruleFlag[0].transitionIds.length).toBe(1);
  });

  it('does not flag (default) sentinel as unknown', () => {
    const { states, transitions } = makeBasic();
    const warnings = validateStateMachine(states, transitions, KNOWN_FLAGS);
    expect(warnings.find((w) => w.kind === 'unknown-flag-in-state')).toBeUndefined();
  });
});

describe('groupWarningsByState / highestSeverity', () => {
  it('groups warnings under each referenced stateId', () => {
    const { states, transitions } = makeBasic();
    // Force a soft-lock warning by removing the return edge
    const noReturn: T[] = transitions.filter((t) => t.id !== 't2');
    const warnings = validateStateMachine(states, noReturn, KNOWN_FLAGS);
    const grouped = groupWarningsByState(warnings);
    expect(grouped.get('s2')?.length).toBeGreaterThan(0);
  });

  it('reports highest severity in mixed lists', () => {
    expect(highestSeverity([])).toBeNull();
    expect(highestSeverity([{ kind: 'soft-lock-deadend', severity: 'info', stateIds: [], transitionIds: [], message: '' }])).toBe('info');
    expect(highestSeverity([
      { kind: 'soft-lock-deadend', severity: 'info', stateIds: [], transitionIds: [], message: '' },
      { kind: 'duplicate-priority', severity: 'warning', stateIds: [], transitionIds: [], message: '' },
    ])).toBe('warning');
    expect(highestSeverity([
      { kind: 'duplicate-priority', severity: 'warning', stateIds: [], transitionIds: [], message: '' },
      { kind: 'unreachable-state', severity: 'error', stateIds: [], transitionIds: [], message: '' },
    ])).toBe('error');
  });
});

describe('validateStateMachine — empty input', () => {
  it('returns no warnings for empty state list', () => {
    expect(validateStateMachine([], [], KNOWN_FLAGS)).toEqual([]);
  });
});
