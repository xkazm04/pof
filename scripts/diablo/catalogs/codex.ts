import { loreBooks, seedLoreSteps } from '@/lib/catalog/reference/loreBooks';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

let unresolved: { entry: string; line: string }[] = [];

export const codexHandler: CatalogHandler = {
  catalogId: 'codex',
  pool: (_db, _sourceId, wrappers) => {
    const report = loreBooks(wrappers);
    unresolved = report.unresolved;
    return report.wrappers as unknown as ReferenceWrapper[];
  },
  seed: (ctx) => {
    const report = loreBooks(listWrappers(ctx.db, { sourceId: ctx.sourceId }));
    for (const item of report.unresolved) ctx.print(`UNRESOLVED ${item.entry}: line ${item.line}`);
    for (const wrapper of report.wrappers.filter((item) => !ctx.ids || ctx.ids.includes(item.entity.id))) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(seedLoreSteps(wrapper.entity));
    }
  },
  report: () => ({
    beforeSummary: unresolved.map((item) => `UNRESOLVED ${item.entry}: line ${item.line}`),
  }),
};
