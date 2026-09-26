import type { CatalogHandler } from './types';
import { affixesHandler } from './affixes';
import { charactersHandler } from './characters';
import { codexHandler } from './codex';
import { combatMapHandler } from './combat-map';
import { dialogTreesHandler } from './dialog-trees';
import { itemsHandler } from './items';
import { progressionCurvesHandler } from './progression-curves';
import { propsHandler } from './props';
import { questsHandler } from './quests';
import { spellbookHandler } from './spellbook';
import { statusEffectsHandler } from './status-effects';
import { vendorsHandler } from './vendors';
import { zoneMapHandler } from './zone-map';

const handlers: CatalogHandler[] = [
  affixesHandler,
  charactersHandler,
  codexHandler,
  combatMapHandler,
  dialogTreesHandler,
  itemsHandler,
  progressionCurvesHandler,
  propsHandler,
  questsHandler,
  spellbookHandler,
  statusEffectsHandler,
  vendorsHandler,
  zoneMapHandler,
];

export const catalogHandlers = new Map(handlers.map((handler) => [handler.catalogId, handler]));
export type { CatalogHandler, CatalogReport, SeedContext } from './types';
