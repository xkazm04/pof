import type { CatalogHandler } from './types';
import { affixesHandler } from './affixes';
import { bestiaryHandler } from './bestiary';
import { charactersHandler } from './characters';
import { codexHandler } from './codex';
import { currenciesHandler } from './currencies';
import { combatMapHandler } from './combat-map';
import { dialogTreesHandler } from './dialog-trees';
import { factionsHandler } from './factions';
import { itemsHandler } from './items';
import { inputSchemesHandler, playerMovementHandler } from './movement-input';
import { progressionCurvesHandler } from './progression-curves';
import { propsHandler } from './props';
import { questsHandler } from './quests';
import { spellbookHandler } from './spellbook';
import { stateGraphHandler } from './state-graph';
import { statusEffectsHandler } from './status-effects';
import { vendorsHandler } from './vendors';
import { vfxHandler } from './vfx';
import { zoneMapHandler } from './zone-map';

const handlers: CatalogHandler[] = [
  affixesHandler,
  bestiaryHandler,
  charactersHandler,
  codexHandler,
  currenciesHandler,
  combatMapHandler,
  dialogTreesHandler,
  factionsHandler,
  itemsHandler,
  inputSchemesHandler,
  playerMovementHandler,
  progressionCurvesHandler,
  propsHandler,
  questsHandler,
  spellbookHandler,
  stateGraphHandler,
  statusEffectsHandler,
  vendorsHandler,
  vfxHandler,
  zoneMapHandler,
];

export const catalogHandlers = new Map(handlers.map((handler) => [handler.catalogId, handler]));
export type { CatalogHandler, CatalogReport, SeedContext } from './types';
