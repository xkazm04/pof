import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStateMachineEditor } from '@/components/modules/content/animations/StateMachineEditor/useStateMachineEditor';
import { compileMachine, checkRuleExpression } from '@/lib/state-machine-compile';
import { validateStateMachine } from '@/lib/state-machine-validator';
import {
  generateComputeAnimState,
  generateFullCppOutput,
} from '@/components/modules/content/animations/StateMachineEditor/codegen';
import { seedFromScan } from '@/components/modules/content/animations/StateMachineEditor/seed';
import {
  DEFAULT_STATES,
  DEFAULT_TRANSITIONS,
  KNOWN_FLAGS,
} from '@/components/modules/content/animations/StateMachineEditor/constants';
import type { AnimBPScanResult } from '@/app/api/filesystem/scan-animbp/route';

// Same fixture as state-machine-editor-wiring.test.tsx: a scan seed never sets
// isDefault and assigns priority by array index (seed.ts toEditorStates).
const SCAN: AnimBPScanResult = {
  scannedAt: '2026-09-05T00:00:00.000Z',
  animInstanceClass: 'UPoFAnimInstance',
  headerPath: 'PoF/Animation/PoFAnimInstance.h',
  states: [
    { name: 'Idle', hasMontage: false, montageRef: null },
    { name: 'Sprint', hasMontage: false, montageRef: null },
    { name: 'SaberSlash', hasMontage: true, montageRef: 'AM_SaberSlash' },
  ],
  transitions: [
    { from: 'Idle', to: 'Sprint', rule: 'Speed > 0' },
    { from: 'Sprint', to: 'Idle', rule: null },
  ],
  montageRefs: ['AM_SaberSlash'],
  animVariables: ['Speed'],
  scanDurationMs: 12,
};

/** generateComputeAnimState(DEFAULT_STATES) at base sha 7a3ddd7a. */
const BASE_COMPUTE =
  'EARPGAnimState UARPGAnimInstance::ComputeAnimState() const\n{\n\t// Priority order: Death > HitReact > Dodging > Attacking > Locomotion\n\t// Highest-priority state always wins.\n\n\tif (bIsDead)\n\t{\n\t\treturn EARPGAnimState::Death;\n\t}\n\n\tif (bIsHitReacting)\n\t{\n\t\treturn EARPGAnimState::HitReact;\n\t}\n\n\tif (bIsDodging)\n\t{\n\t\treturn EARPGAnimState::Dodging;\n\t}\n\n\tif (bIsAttacking)\n\t{\n\t\treturn EARPGAnimState::Attacking;\n\t}\n\n\treturn EARPGAnimState::Locomotion;\n}';

const returnsOf = (code: string) =>
  code.split('\n').filter((l) => l.includes('return EARPGAnimState::')).map((l) => l.trim());

describe('compileMachine — acceptance (card animation-state-machine-editor/A)', () => {
  it('1. scan seed: reachability runs FROM the state the C++ falls back to (SaberSlash), never from array order', () => {
    const seed = seedFromScan(SCAN)!;
    const compiled = compileMachine(seed.states, seed.transitions);
    expect(compiled.entryId).toBe('scanned-SaberSlash');
    expect(generateComputeAnimState(seed.states)).toContain('\treturn EARPGAnimState::SaberSlash;\n}');

    const warnings = validateStateMachine(seed.states, seed.transitions, KNOWN_FLAGS);
    // The false finding is gone: SaberSlash is the entry, not "unreachable from Idle".
    expect(warnings.some((w) => w.kind === 'unreachable-state' && w.stateIds.includes('scanned-SaberSlash'))).toBe(false);
    expect(warnings.some((w) => w.message.includes('no path from "Idle"'))).toBe(false);
    // Coordinator review of d47d3e86: the graph check runs from the compiled entry
    // and reports what it finds, unsuppressed. SaberSlash has no transitions at all
    // in this scan, so Idle and Sprint have no path from it.
    const unreachable = warnings.filter((w) => w.kind === 'unreachable-state');
    expect(unreachable.map((w) => w.stateIds[0])).toEqual(['scanned-Idle', 'scanned-Sprint']);
    expect(unreachable.every((w) => w.message.includes('no path from "SaberSlash"'))).toBe(true);
  });

  it('2. scan seed: an implicit-fallback WARNING names SaberSlash as the lowest-priority fallback', () => {
    const seed = seedFromScan(SCAN)!;
    const { diagnostics } = compileMachine(seed.states, seed.transitions);
    const implicit = diagnostics.filter((d) => d.kind === 'implicit-fallback');
    expect(implicit).toHaveLength(1);
    expect(implicit[0].severity).toBe('warning');
    expect(implicit[0].stateIds).toEqual(['scanned-SaberSlash']);
    expect(implicit[0].message).toContain('SaberSlash');
    expect(implicit[0].message.toLowerCase()).toContain('lowest-priority');
    // and the linter surfaces it
    const warnings = validateStateMachine(seed.states, seed.transitions, KNOWN_FLAGS);
    expect(warnings.some((w) => w.kind === 'implicit-fallback' && w.severity === 'warning')).toBe(true);
  });

  it('3. two defaults: multiple-defaults error, and ComputeAnimState still returns all 5 enumerators with no (default) branch', () => {
    const states = DEFAULT_STATES.map((s) => (s.id === 'state-death' ? { ...s, isDefault: true } : s));
    const { diagnostics } = compileMachine(states, DEFAULT_TRANSITIONS);
    const multi = diagnostics.find((d) => d.kind === 'multiple-defaults');
    expect(multi?.severity).toBe('error');
    expect(multi?.stateIds).toEqual(['state-locomotion', 'state-death']);

    const code = generateComputeAnimState(states);
    const returned = new Set(returnsOf(code).map((l) => l.replace(/^return EARPGAnimState::|;$/g, '')));
    expect(returned).toEqual(new Set(['Locomotion', 'Attacking', 'Dodging', 'HitReact', 'Death']));
    expect(code).not.toContain('if ((default))');
    expect(code.split('\n').filter((l) => /\bif\s*\(/.test(l) && l.includes('(default)'))).toEqual([]);
    expect(validateStateMachine(states, DEFAULT_TRANSITIONS, KNOWN_FLAGS).some((w) => w.kind === 'multiple-defaults')).toBe(true);
  });

  it('4. Default unticked while flag stays "(default)": error on state-locomotion', () => {
    const states = DEFAULT_STATES.map((s) => (s.id === 'state-locomotion' ? { ...s, isDefault: false } : s));
    const warnings = validateStateMachine(states, DEFAULT_TRANSITIONS, KNOWN_FLAGS);
    const onLoco = warnings.filter((w) => w.severity === 'error' && w.stateIds.includes('state-locomotion'));
    expect(onLoco.map((w) => w.kind)).toContain('default-sentinel-mismatch');
  });

  it('5. the one-click {flag} template rule is an invalid-rule-expression error', () => {
    const transitions = DEFAULT_TRANSITIONS.map((t) =>
      t.id === 't-loco-atk' ? { ...t, rule: '{flag} == true && !bIsFullBodyMontage' } : t,
    );
    const warnings = validateStateMachine(DEFAULT_STATES, transitions, KNOWN_FLAGS);
    const bad = warnings.filter((w) => w.kind === 'invalid-rule-expression');
    expect(bad).toHaveLength(1);
    expect(bad[0].severity).toBe('error');
    expect(bad[0].transitionIds).toEqual(['t-loco-atk']);
  });

  it('6. every derived bCan<X>To<Y> assignment has a bool declaration (4 of 4)', () => {
    const out = generateFullCppOutput(DEFAULT_STATES, DEFAULT_TRANSITIONS);
    const assigned = Array.from(out.matchAll(/^(bCan\w+To\w+) =/gm)).map((m) => m[1]);
    expect(assigned).toHaveLength(4);
    for (const name of assigned) {
      expect(out).toMatch(new RegExp(`^\\s*bool ${name}\\b`, 'm'));
    }
  });

  it('7. [guard] DEFAULT_STATES ComputeAnimState is byte-identical and the lint kinds are unchanged', () => {
    expect(generateComputeAnimState(DEFAULT_STATES)).toBe(BASE_COMPUTE);
    const warnings = validateStateMachine(DEFAULT_STATES, DEFAULT_TRANSITIONS, KNOWN_FLAGS);
    expect(warnings.map((w) => [w.kind, w.severity, w.stateIds])).toEqual([
      ['soft-lock-deadend', 'info', ['state-death']],
    ]);
  });
});

describe('compileMachine — model', () => {
  it('exactly one default is the fallback and the rest form the priority cascade', () => {
    const c = compileMachine(DEFAULT_STATES, DEFAULT_TRANSITIONS);
    expect(c.entryId).toBe('state-locomotion');
    expect(c.cascade.map((s) => s.name)).toEqual(['Death', 'HitReact', 'Dodging', 'Attacking']);
    expect(c.enumMembers).toEqual(['Death', 'HitReact', 'Dodging', 'Attacking', 'Locomotion']);
    expect(c.derivedFlags.map((f) => f.name)).toEqual([
      'bCanAttackingToLocomotion', 'bCanAttackingToDodging', 'bCanAttackingToHitReact', 'bCanDodgingToAttacking',
    ]);
    expect(c.diagnostics).toEqual([]);
  });

  it('the editor hook exposes the compiled entry the canvas draws (scan seed -> SaberSlash)', () => {
    const { result, unmount } = renderHook(() => useStateMachineEditor({ seed: seedFromScan(SCAN) }));
    expect(result.current.entryStateId).toBe('scanned-SaberSlash');
    expect(result.current.entrySource).toBe('implicit');
    unmount();
  });

  it('empty machine compiles to nothing', () => {
    const c = compileMachine([], []);
    expect(c.entryId).toBeNull();
    expect(c.cascade).toEqual([]);
    expect(c.diagnostics).toEqual([]);
  });

  it('a cascade state with an empty flag is an invalid-state-flag error (if () would not compile)', () => {
    const states = DEFAULT_STATES.map((s) => (s.id === 'state-dodging' ? { ...s, flag: '' } : s));
    const d = compileMachine(states, []).diagnostics;
    expect(d.some((w) => w.kind === 'invalid-state-flag' && w.stateIds[0] === 'state-dodging')).toBe(true);
  });
});

describe('checkRuleExpression', () => {
  it('accepts every rule the template emits, plus calls, floats and member access', () => {
    for (const t of DEFAULT_TRANSITIONS) expect(checkRuleExpression(t.rule), t.rule).toBeNull();
    for (const rule of ['Speed > 0.5f', 'GetSpeed() > 0 || !bIsInAir', 'Owner->bIsDead == false', '-Speed < 10', 'FMath::Abs(Speed) >= 2.0f && (bA || bB)']) {
      expect(checkRuleExpression(rule), rule).toBeNull();
    }
  });

  it('rejects placeholders, prose, comments, empties and unbalanced parens', () => {
    for (const rule of [
      '{flag} == true',
      'StateTime > {threshold}',
      'Montage ends (bIsAnyMontageActive == false)',
      '(default) // fallback',
      '',
      '(bIsDead == true',
      'bIsDead ==',
      'bIsDead; bIsDodging',
    ]) {
      expect(checkRuleExpression(rule), rule).not.toBeNull();
    }
  });
});
