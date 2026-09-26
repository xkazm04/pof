import { seededEntities } from '@/lib/catalog/seed';
import { dialogueTrees, seedDialogSteps, type DialogueTreesResult } from '@/lib/catalog/reference/dialogueTrees';
import { heroBarkTrees, seedHeroBarkSteps, type HeroBarkTreesResult } from '@/lib/catalog/reference/heroBarks';
import { monsterTalkTrees, seedMonsterTalkSteps, type MonsterTalkTreesResult } from '@/lib/catalog/reference/monsterTalk';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler, CatalogReport } from './types';

let dialogueReport: DialogueTreesResult | null = null;
let heroBarkReport: HeroBarkTreesResult | null = null;
let monsterTalkReport: MonsterTalkTreesResult | null = null;

export const dialogTreesHandler: CatalogHandler = {
  catalogId: 'dialog-trees',
  pool: (_db, _sourceId, wrappers) => {
    dialogueReport = dialogueTrees(wrappers);
    heroBarkReport = heroBarkTrees(wrappers);
    monsterTalkReport = monsterTalkTrees(wrappers);
    return [
      ...dialogueReport.wrappers,
      ...monsterTalkReport.wrappers,
      ...heroBarkReport.wrappers,
    ] as unknown as ReferenceWrapper[];
  },
  seed: (ctx) => {
    for (const item of seededEntities('dialog-trees').filter(
      (entity) => entity.id.startsWith('d1-dialog-') && (!ctx.ids || ctx.ids.includes(entity.id)),
    )) {
      const entity = item as unknown as ReferenceWrapper['entity'];
      ctx.emit(entity.data.talker === 'monster'
        ? seedMonsterTalkSteps(entity)
        : entity.data.talker === 'hero'
          ? seedHeroBarkSteps(entity)
          : seedDialogSteps(entity));
    }
  },
  report: (): CatalogReport => ({
    dialogueReport,
    monsterTalkReport,
    afterSummary: [
      ...(dialogueReport?.skipped.map((item) => `   SKIPPED ${item.towner}: ${item.reason}`) ?? []),
      ...(dialogueReport?.unresolved.map((item) => `   UNRESOLVED ${item.towner}: line ${item.line}`) ?? []),
      ...(monsterTalkReport?.skipped.map((item) => `   SKIPPED ${item.monster}: ${item.reason}`) ?? []),
      ...(monsterTalkReport?.unresolved.map((item) => `   UNRESOLVED ${item.monster}: line ${item.line}`) ?? []),
      ...(heroBarkReport?.missingMappings.map((item) => `   SILENT ${item.hero}: speech ${item.speechId}`) ?? []),
    ],
  }),
};
