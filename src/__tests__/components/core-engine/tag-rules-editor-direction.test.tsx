import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { TagRulesEditor } from '@/components/modules/core-engine/sub_ability/blueprint/TagRulesEditor';
import { WiringGraphEditor } from '@/components/modules/core-engine/sub_ability/blueprint/WiringGraphEditor';
import { SEED_EFFECTS, SEED_LOADOUT } from '@/components/modules/core-engine/sub_ability/blueprint/data';
import { deriveDefaultSpec } from '@/lib/ability/spec';
import type { TagRule } from '@/lib/ability/spec';

// setup.ts has no afterEach(cleanup).
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const FIREBALL = 'Ability.Fire.Fireball';
const derived = () => deriveDefaultSpec('spellbook', { id: 'off-fire-01', tag: FIREBALL, damage: 35, cooldown: 3 }).tagRules;

describe('TagRulesEditor reads rules ability-owned', () => {
  it('rows read "blocked by <gating tag>"; Unmatched is judged on the gating tag only', () => {
    render(<TagRulesEditor abilityTag={FIREBALL} rules={derived()} onChange={() => {}} effects={SEED_EFFECTS} loadout={SEED_LOADOUT} />);
    expect(screen.getByText('blocked by State.Dead')).toBeTruthy();
    expect(screen.getByText('blocked by State.Stunned')).toBeTruthy();
    // SEED_EFFECTS grants State.Stunned (GE_Stun) but nothing grants State.Dead,
    // so exactly the State.Dead row's list marker is flagged (ByTitle only sees
    // SVG <title>s that sit directly under <svg>, so the diagram's circle marker
    // is not counted). The ability tag is never flagged: it is the rule's owner,
    // not a tag an effect should grant — the old subject-first reading flagged
    // it on every row (3 list markers).
    expect(screen.queryAllByTitle(/Unmatched/)).toHaveLength(1);
    expect(screen.getByTitle(/Unmatched/).parentElement?.querySelector('input')?.value).toBe('State.Dead');
  });

  it('Add Rule creates a rule owned by the bound ability', () => {
    const onChange = vi.fn<(rules: TagRule[]) => void>();
    render(<TagRulesEditor abilityTag={FIREBALL} rules={derived()} onChange={onChange} effects={SEED_EFFECTS} loadout={SEED_LOADOUT} />);
    fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(3);
    expect(next[2].sourceTag).toBe(FIREBALL);
  });
});

describe('WiringGraphEditor draws effect->rule wires from the gating tag', () => {
  it('GE_Stun is wired to the rule State.Stunned gates', () => {
    render(<WiringGraphEditor attributes={[]} relationships={[]} effects={SEED_EFFECTS} tagRules={derived()} />);
    // No attributes/relationships → the only possible wires are effect->rule.
    expect(screen.getByText(/^1 wires$/)).toBeTruthy();
  });
});
