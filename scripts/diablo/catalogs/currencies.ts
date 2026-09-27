import { currencyEntities, seedCurrencySteps } from '@/lib/catalog/reference/currencySpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

export const currenciesHandler: CatalogHandler = {
  catalogId: 'currencies',
  standalonePromotion: true,
  pool: () => currencyEntities() as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    for (const wrapper of currencyEntities().filter((item) => !ctx.ids || ctx.ids.includes(item.entity.id))) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(seedCurrencySteps(wrapper.entity));
      const gaps = wrapper.entity.data.stepGaps as Record<string, string>;
      for (const [step, reason] of Object.entries(gaps)) ctx.print(`GAP ${wrapper.entity.id} · ${step}: ${reason}`);
      for (const question of wrapper.entity.data.openQuestions as string[]) ctx.print(`OPEN ${wrapper.entity.id}: ${question}`);
    }
  },
};
