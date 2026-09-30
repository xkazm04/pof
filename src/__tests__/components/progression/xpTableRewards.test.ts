import { describe, it, expect } from 'vitest';
import {
  generateProgressionTable, progressionToCSV,
} from '@/components/modules/core-engine/sub_progression/_internals/XpTableGenerator/helpers';
import { rewardSchedule } from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';
import { LEVEL_REWARDS } from '@/components/modules/core-engine/sub_progression/_shared/data';

/** RFC-4180 field split: commas inside double quotes do not split; "" is a literal quote. */
function csvFields(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

describe('XP table exports every unlock (DT_ProgressionCurve CSV)', () => {
  it('case 5: all 15 rewards, 51 lines, Level 1..50 once each, 7 fields/row, co-level rewards in one UnlockReward cell', () => {
    const csv = progressionToCSV(
      generateProgressionTable(50, 100, 1.5, 10, 5, 3, new Map(), rewardSchedule(LEVEL_REWARDS)),
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(51);
    expect(csvFields(lines[0])).toEqual(['Level', 'XPRequired', 'XPTotal', 'HPBonus', 'ManaBonus', 'AttrPoints', 'UnlockReward']);
    const rows = lines.slice(1).map(csvFields);
    rows.forEach((f) => expect(f).toHaveLength(7));
    expect(rows.map((f) => Number(f[0]))).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    for (const r of LEVEL_REWARDS) expect(rows[r.level - 1][6]).toContain(r.name);
    // the cell is quoted in the raw line, and co-level rewards share it
    expect(lines[5]).toMatch(/,"Dodge Roll \(Ability\); Force Push \(Ability\)"$/);
    expect(rows[5][6]).toBe('');
  });
});
