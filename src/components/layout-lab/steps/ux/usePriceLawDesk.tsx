'use client';

import { useMemo, useState } from 'react';
import { useUxVariant } from './useUxVariant';
import { PriceLawPanel } from './PriceLawPanel';
import { PRICE_LAW_CATALOG, PRICE_LAW_STEPS, PRICE_LAW_UX, checkPriceLaw, priceLawDirection } from './economyPriceLaw';
import type { StepPanel } from '../StepFrame';
import type { LabEntity } from '../../useLabCatalogData';
import type { LabTheme } from '../../theme';

export interface PriceLawDesk {
  /** `[Price law]` while the desk is showing, else empty. */
  panels: StepPanel[];
  /** A direction the operator seeded into the Produce panel, if any. */
  seed?: string;
  /** Remount key for the Produce panel, bumped on every seed. 0 until the first seed. */
  seedKey: number;
}

/**
 * PROTOTYPE wiring for `?ux=price-law` (see `PriceLawPanel`). Off (no flag, another step or
 * catalog, or no stored `economy` block) it returns no panel and no seed, so `ArchetypeStep`
 * renders exactly as before and nothing is computed. On, it reads only the step's own `data`.
 */
export function usePriceLawDesk({ t, catalogId, entity, step, data }: {
  t: LabTheme;
  catalogId?: string;
  entity: LabEntity;
  step: string;
  data: Record<string, unknown>;
}): PriceLawDesk {
  const flag = useUxVariant(PRICE_LAW_UX);
  const on = flag && catalogId === PRICE_LAW_CATALOG && PRICE_LAW_STEPS.has(step) && !!data.economy && typeof data.economy === 'object';
  const [seed, setSeed] = useState<{ text: string; key: number } | null>(null);
  const r = useMemo(() => (on ? checkPriceLaw(data) : null), [on, data]);

  if (!r) return { panels: [], seedKey: seed?.key ?? 0, ...(seed ? { seed: seed.text } : {}) };

  const direction = priceLawDirection(entity.name, r);
  const onSeed = () => setSeed((s) => ({ text: direction, key: (s?.key ?? 0) + 1 }));
  return {
    panels: [{
      label: 'Price law',
      node: <PriceLawPanel t={t} r={r} seeded={!!direction && seed?.text === direction} onSeed={onSeed} />,
    }],
    seed: seed?.text,
    seedKey: seed?.key ?? 0,
  };
}
