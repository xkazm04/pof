/** Aggregate Diablo's per-level cumulative XP threshold rows into one progression curve. */
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

type CurveEntity = ReferenceWrapper['entity'];

export interface ExperienceCurveWrapper {
  catalogId: 'progression-curves';
  entity: CurveEntity;
}

interface LevelThreshold {
  level: number;
  experience: number;
  wrapper: ReferenceWrapper;
}

/** One pseudo-wrapper whose levels are ordered numerically, ready for guarded promotion. */
export function experienceCurve(wrappers: readonly ReferenceWrapper[]): ExperienceCurveWrapper[] {
  const thresholds: LevelThreshold[] = wrappers
    .filter((wrapper) => wrapper.catalogId === 'progression-curves')
    .map((wrapper) => ({
      level: Number(wrapper.entity.data.level),
      experience: Number(wrapper.entity.data.experienceToReach),
      wrapper,
    }))
    .filter(({ level, experience }) => Number.isFinite(level) && Number.isFinite(experience))
    .sort((a, b) => a.level - b.level);

  if (thresholds.length === 0) return [];
  const first = thresholds[0].wrapper.entity;
  const provenance = first.provenance;
  const levels = thresholds.map(({ level, experience }) => ({ level, experience }));
  return [{
    catalogId: 'progression-curves',
    entity: {
      ...first,
      id: 'd1-xp-curve',
      name: 'Diablo I experience curve',
      links: [],
      data: { levels, maxLevel: levels.at(-1)!.level },
      ...(provenance ? {
        provenance: {
          ...provenance,
          sourceRow: thresholds.map(({ wrapper }) => wrapper.entity.provenance?.sourceRow ?? wrapper.key).join('; '),
        },
      } : {}),
    },
  }];
}
