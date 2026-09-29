import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bindingsApplyGate, expandKey, isMouseKey, rebindAction, resolveBindings,
} from '@/lib/character/input-bindings';
import {
  CHARACTER_ABILITIES, INPUT_BINDINGS, KEYBOARD_ROWS,
} from '@/components/modules/core-engine/sub_character/_shared/data';
import { buildBindingsApplyPrompt } from '@/components/modules/core-engine/sub_character/input/build-bindings-apply-prompt';

const SUB = join(process.cwd(), 'src/components/modules/core-engine/sub_character');
const WASD_SPELLED = /['"]W['"]\s*,\s*['"]A['"]\s*,\s*['"]S['"]\s*,\s*['"]D['"]/g;

describe('input bindings - one pure resolver over (defaults, overrides)', () => {
  it('case 1: factory defaults have no conflict and WASD expands to IA_Move', () => {
    const r = resolveBindings(INPUT_BINDINGS, {});
    expect(r.conflicts.size).toBe(0);
    for (const k of ['W', 'A', 'S', 'D']) expect(r.keyMap.get(k)?.action).toBe('IA_Move');
    expect(r.changed).toEqual([]);
  });

  it('case 2: rebinding onto a single bound key swaps the two actions', () => {
    const next = rebindAction(INPUT_BINDINGS, {}, 'IA_Dodge', 'Shift');
    expect(next).toEqual({ IA_Dodge: 'Shift', IA_Sprint: 'Space' });
    expect(resolveBindings(INPUT_BINDINGS, next).conflicts.size).toBe(0);
  });

  it('case 3: the WASD group is never silently swapped; WASD is spelled once', () => {
    const next = rebindAction(INPUT_BINDINGS, {}, 'IA_Dodge', 'W');
    expect(next).toEqual({ IA_Dodge: 'W' });
    expect(resolveBindings(INPUT_BINDINGS, next).conflicts.get('W')).toEqual(['IA_Move', 'IA_Dodge']);
    expect(expandKey('WASD')).toEqual(['W', 'A', 'S', 'D']);

    const lib = readFileSync(join(process.cwd(), 'src/lib/character/input-bindings.ts'), 'utf8');
    expect(lib.match(WASD_SPELLED)).toHaveLength(1);
    for (const f of ['_shared/data.ts', 'input/InputBindingsRow.tsx', 'input/InputBindingsTable.tsx']) {
      expect(readFileSync(join(SUB, f), 'utf8').match(WASD_SPELLED), f).toBeNull();
    }
  });

  it('case 5: Apply is gated off at defaults and on conflicts, on for a clean change', () => {
    expect(bindingsApplyGate(resolveBindings(INPUT_BINDINGS, {}))).toEqual({ ok: false, reason: 'matches defaults' });
    const conflicting = bindingsApplyGate(resolveBindings(INPUT_BINDINGS, { IA_Dodge: 'W' }));
    expect(conflicting.ok).toBe(false);
    expect(!conflicting.ok && conflicting.reason).toMatch(/\bW\b/);
    expect(bindingsApplyGate(resolveBindings(INPUT_BINDINGS, { IA_Dodge: 'Ctrl' }))).toEqual({ ok: true });
  });

  it('case 6: the Apply prompt names IMC_Default, the change, and every mapping once', () => {
    const resolved = resolveBindings(INPUT_BINDINGS, { IA_Dodge: 'Ctrl' });
    const prompt = buildBindingsApplyPrompt(resolved);
    expect(prompt).toContain('IMC_Default');
    expect(prompt).toContain('IA_Dodge: Space -> Ctrl');
    expect(resolved.effective).toHaveLength(16);
    const lines = prompt.split('\n');
    for (const e of resolved.effective) {
      expect(lines.filter((l) => l.startsWith(`- ${e.action}: ${e.key} `)), e.action).toHaveLength(1);
    }
  });

  it('case 7: every bound non-mouse key is drawn on the keyboard map', () => {
    const drawn = new Set(KEYBOARD_ROWS.flat().map((k) => k.key));
    const bound = [...resolveBindings(INPUT_BINDINGS, {}).keyMap.keys()].filter((k) => !isMouseKey(k));
    expect(bound.filter((k) => !drawn.has(k))).toEqual([]);
    expect(drawn.has('Ctrl')).toBe(true);
  });

  it('case 8 [guard]: every key-bound ability joins exactly one INPUT_BINDINGS row', () => {
    for (const a of CHARACTER_ABILITIES.filter((x) => x.action !== '')) {
      expect(INPUT_BINDINGS.filter((b) => b.action === a.action), a.id).toHaveLength(1);
    }
  });
});
