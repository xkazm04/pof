/**
 * Diablo I's monster resistance law, parsed from `d1-resistance-law`'s own text. A LEAF module (imports only the canon)
 * so derive.ts and stepSeeds.ts share one parser without the derive → stepSeeds → sources import cycle (W40).
 */
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';

/** Diablo I's monster resistance law, read from `d1-resistance-law`'s own text. */
export function resistanceLaw(): { normal: number; resist: number; immune: number } {
  const body = DIABLO1_CANON.find((r) => r.id === 'd1-resistance-law')?.body;
  if (!body) throw new Error('canon rule d1-resistance-law is missing — the resistance seed has no law to read');
  const m = /normal \((\d+)%\), resistant \((\d+)%\) or immune \((\d+)%\)/.exec(body);
  if (!m) throw new Error('d1-resistance-law no longer states "normal (N%), resistant (N%) or immune (N%)" — refusing to guess');
  return { normal: Number(m[1]), resist: Number(m[2]), immune: Number(m[3]) };
}

/** Diablo I's element set, from the diablo1 profile's vocabulary (D14) — upper-cased like the monstdat flags. */
export const ELEMENTS = ['MAGIC', 'FIRE', 'LIGHTNING'] as const;

/** Per-element reduction from a monstdat `resistance` flag list (`IMMUNE_MAGIC,RESIST_FIRE`). */
export function resistanceByElement(flags: string): Record<(typeof ELEMENTS)[number], number> {
  const law = resistanceLaw();
  const set = new Set(flags.split(',').map((f) => f.trim()).filter(Boolean));
  const out = {} as Record<(typeof ELEMENTS)[number], number>;
  for (const el of ELEMENTS) {
    out[el] = set.has(`IMMUNE_${el}`) ? law.immune : set.has(`RESIST_${el}`) ? law.resist : law.normal;
  }
  return out;
}
