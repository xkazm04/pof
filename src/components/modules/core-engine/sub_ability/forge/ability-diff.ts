/** ── Ability Refinement Diff ─────────────────────────────────────────────── *
 * Computes what a refine pass changed between a prior ForgedAbility and the
 * regenerated one, so the forge can show a side-by-side preview of changed
 * stats, tags, and code instead of silently swapping the result.
 *
 * Stats reuse the shared genome diff engine (label / from → to / signed delta);
 * tags are reported as added/removed sets; code is a line-level LCS diff.
 * ────────────────────────────────────────────────────────────────────────── */

import {
  diffGenomes, type DiffFieldSpec, type GenomeFieldDelta,
} from '@/lib/genome/genome-diff';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

/* ── Stat-level diff (numeric + categorical) ──────────────────────────────── */

const RADAR_AXES = ['Damage', 'Range', 'AOE', 'Speed', 'Efficiency'] as const;

export const ABILITY_STAT_SPECS: DiffFieldSpec<ForgedAbility>[] = [
  { group: 'Stats', label: 'Damage', get: (a) => a.stats.baseDamage },
  { group: 'Stats', label: 'Mana', get: (a) => a.stats.manaCost },
  { group: 'Stats', label: 'Cooldown', get: (a) => a.stats.cooldownSec, unit: 's' },
  { group: 'Stats', label: 'Damage Type', get: (a) => a.stats.damageType },
  { group: 'Timing', label: 'Anim Duration', get: (a) => a.comboEntry.animDuration, unit: 's', decimals: 2 },
  { group: 'Timing', label: 'Damage Start', get: (a) => a.comboEntry.damageWindow[0], unit: 's', decimals: 2 },
  { group: 'Timing', label: 'Damage End', get: (a) => a.comboEntry.damageWindow[1], unit: 's', decimals: 2 },
  { group: 'Timing', label: 'Recovery', get: (a) => a.comboEntry.recovery, unit: 's', decimals: 2 },
  { group: 'Timing', label: 'Combo Mult', get: (a) => a.comboEntry.comboMultiplier, unit: '×', decimals: 2 },
  ...RADAR_AXES.map((axis, i): DiffFieldSpec<ForgedAbility> => ({
    group: 'Profile',
    label: axis,
    get: (a) => a.radarValues[i] ?? 0,
    percent: true,
  })),
];

/** Field-level stat changes between the prior ability and the refined one. */
export function diffAbilityStats(prior: ForgedAbility, next: ForgedAbility): GenomeFieldDelta[] {
  return diffGenomes(prior, next, ABILITY_STAT_SPECS);
}

/* ── Tag-level diff (added / removed sets) ─────────────────────────────────── */

export interface TagChange {
  group: 'Ability Tag' | 'Cooldown Tag' | 'Owned Tags' | 'Blocked Tags';
  added: string[];
  removed: string[];
}

function setDiff(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((t) => !beforeSet.has(t)),
    removed: before.filter((t) => !afterSet.has(t)),
  };
}

/** A single tag (abilityTag/cooldownTag) reads as removed-old + added-new. */
function singleTagChange(group: TagChange['group'], before: string, after: string): TagChange | null {
  if (before === after) return null;
  return {
    group,
    added: after ? [after] : [],
    removed: before ? [before] : [],
  };
}

/** Tag grants/blocks that changed during a refine. Only non-empty groups returned. */
export function diffAbilityTags(prior: ForgedAbility, next: ForgedAbility): TagChange[] {
  const changes: TagChange[] = [];

  const abilityTag = singleTagChange('Ability Tag', prior.tags.abilityTag, next.tags.abilityTag);
  if (abilityTag) changes.push(abilityTag);

  const cooldownTag = singleTagChange('Cooldown Tag', prior.tags.cooldownTag, next.tags.cooldownTag);
  if (cooldownTag) changes.push(cooldownTag);

  const owned = setDiff(prior.tags.ownedTags, next.tags.ownedTags);
  if (owned.added.length || owned.removed.length) changes.push({ group: 'Owned Tags', ...owned });

  const blocked = setDiff(prior.tags.blockedTags, next.tags.blockedTags);
  if (blocked.added.length || blocked.removed.length) changes.push({ group: 'Blocked Tags', ...blocked });

  return changes;
}

/* ── Code-level diff (line LCS) ────────────────────────────────────────────── */

export type DiffLineType = 'add' | 'del' | 'eq';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

export interface CodeChangeSummary {
  added: number;
  removed: number;
}

function splitLines(src: string): string[] {
  return src.length ? src.split('\n') : [];
}

/**
 * Line-level diff via a classic LCS table. Returns the lines in order with each
 * tagged as kept (`eq`), inserted (`add`), or dropped (`del`) — the shape a
 * unified +/- diff view renders directly.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of LCS of a[i:] and b[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'eq', text: a[i] });
      i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) { out.push({ type: 'del', text: a[i] }); i++; }
  while (j < m) { out.push({ type: 'add', text: b[j] }); j++; }
  return out;
}

export interface DiffGap {
  type: 'gap';
  /** Number of unchanged lines elided. */
  count: number;
}

export type DiffRow = DiffLine | DiffGap;

/**
 * Collapse long runs of unchanged lines so a regenerated file shows only the
 * changed hunks plus `context` lines of surrounding code, with elided runs
 * replaced by a gap marker ("⋯ N unchanged lines").
 */
export function collapseDiff(lines: DiffLine[], context = 2): DiffRow[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, idx) => {
    if (line.type === 'eq') return;
    const lo = Math.max(0, idx - context);
    const hi = Math.min(lines.length - 1, idx + context);
    for (let k = lo; k <= hi; k++) keep[k] = true;
  });

  const rows: DiffRow[] = [];
  let gap = 0;
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      if (gap > 0) { rows.push({ type: 'gap', count: gap }); gap = 0; }
      rows.push(lines[i]);
    } else {
      gap++;
    }
  }
  if (gap > 0) rows.push({ type: 'gap', count: gap });
  return rows;
}

/** Count of inserted / dropped lines for a diff summary badge. */
export function summarizeLines(lines: DiffLine[]): CodeChangeSummary {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === 'add') added++;
    else if (l.type === 'del') removed++;
  }
  return { added, removed };
}

/* ── Convenience ───────────────────────────────────────────────────────────── */

/** True when a refine produced any visible stat, tag, or code change. */
export function abilityHasChanges(prior: ForgedAbility, next: ForgedAbility): boolean {
  if (diffAbilityStats(prior, next).length > 0) return true;
  if (diffAbilityTags(prior, next).length > 0) return true;
  return prior.headerCode !== next.headerCode || prior.cppCode !== next.cppCode;
}
