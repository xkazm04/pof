/**
 * Encounter Director (ECW Phase 10-B, idea 3e817d61). Given a focus archetype
 * and the bestiary roster, suggest a role-balanced encounter composition (pure,
 * deterministic) and compose a CLI prompt to author it in UE. Distinct from the
 * Remix facet (which authors a single enemy) — this designs a multi-enemy fight.
 */

export interface EncounterUnit {
  id: string;
  name: string;
  role: string;
  tier: string;
}

export interface EncounterSlot {
  role: string;
  name: string;
  entityId?: string;
  isFocus: boolean;
}

/** Lower = weaker. Used so an encounter never recruits a unit tougher than its focus. */
const TIER_RANK: Record<string, number> = {
  minion: 0,
  standard: 1,
  elite: 2,
  boss: 3,
  'raid-boss': 4,
};

/** A balanced ARPG fight wants frontline → pressure → control → support, in that order. */
const ROLE_PRIORITY = ['tank', 'melee', 'ranged', 'caster', 'healer', 'swarm'];

function tierRank(tier: string): number {
  return TIER_RANK[tier] ?? 1;
}

/**
 * Suggest an encounter composition of `size` units led by `focus`. Fills the
 * remaining slots with roster members of roles not yet present (then any role),
 * never picking a unit tougher than the focus. Deterministic: candidates are
 * ordered by role priority, then ascending tier, then name.
 */
export function suggestEncounterMix(
  focus: EncounterUnit,
  roster: EncounterUnit[],
  size = 4,
): EncounterSlot[] {
  const slots: EncounterSlot[] = [
    { role: focus.role, name: focus.name, entityId: focus.id, isFocus: true },
  ];
  const focusRank = tierRank(focus.tier);

  const candidates = roster
    .filter((u) => u.id !== focus.id && tierRank(u.tier) <= focusRank)
    .sort((a, b) => {
      const ra = ROLE_PRIORITY.indexOf(a.role);
      const rb = ROLE_PRIORITY.indexOf(b.role);
      if (ra !== rb) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
      if (tierRank(a.tier) !== tierRank(b.tier)) return tierRank(a.tier) - tierRank(b.tier);
      return a.name.localeCompare(b.name);
    });

  const usedRoles = new Set([focus.role]);
  const pick = (u: EncounterUnit) => {
    slots.push({ role: u.role, name: u.name, entityId: u.id, isFocus: false });
  };

  // Pass 1: one unit per missing role.
  for (const u of candidates) {
    if (slots.length >= size) break;
    if (usedRoles.has(u.role)) continue;
    pick(u);
    usedRoles.add(u.role);
  }
  // Pass 2: top up remaining slots with any unused candidate (roles may repeat).
  for (const u of candidates) {
    if (slots.length >= size) break;
    if (slots.some((s) => s.entityId === u.id)) continue;
    pick(u);
  }

  return slots;
}

/** Compose the CLI prompt that authors the suggested encounter in the UE project. */
export function buildEncounterPrompt(
  focusName: string,
  mix: EncounterSlot[],
  instruction: string,
): string {
  const trimmed = instruction.trim();
  const roster = mix
    .map((s) => `- ${s.name} (${s.role})${s.isFocus ? ' — focus' : ''}`)
    .join('\n');

  return [
    `Design and author a UE5 ARPG encounter built around the "${focusName}" archetype.`,
    '',
    'Suggested composition (role-balanced, none tougher than the focus):',
    roster,
    '',
    trimmed
      ? `Designer intent: ${trimmed}`
      : 'No extra intent given — use the suggested composition as-is.',
    '',
    'Requirements:',
    '- Reuse the existing encounter/spawn system (spawn volumes + wave config); do not invent a new one.',
    '- Spawn each unit via its existing AARPGEnemyCharacter subclass; do not duplicate enemy classes.',
    '- Stagger waves so the focus archetype anchors the fight and supports arrive as pressure.',
    '- Keep it data-driven (DataTable / config), not hard-coded actor placement, where the project already does so.',
  ].join('\n');
}
