/** Diablo I actor states derived from engine code rather than a reference data table. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import type { CatalogLink } from '@/lib/catalog/types';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import {
  DIABLO1_STATUS_LAWS,
  STATUS_SPECS_DATA,
  statusEntityId,
  statusLawId,
} from '@/lib/catalog/reference/statusSpecsData';

export type StatusAppliesTo = 'hero' | 'monster' | 'both';

export interface StatusSpecData {
  id: `d1-${string}`;
  name: string;
  appliesTo: StatusAppliesTo;
  source: string;
  duration: string;
  stacking: string;
  effect: string;
  removal: string;
  hellfire: boolean;
  lawBody: string;
  refs: readonly string[];
}

export type StatusSpec = StatusSpecData;
export const STATUS_SPECS: readonly StatusSpec[] = STATUS_SPECS_DATA;

export { DIABLO1_STATUS_LAWS, statusEntityId, statusLawId };

/** Spell rows that have an engine-state census row. The value is the promoted status entity id. */
export const SPELL_STATUS_ENTITY_IDS: Readonly<Record<string, string>> = {
  StoneCurse: 'd1-status-stone-curse-petrification',
  FireWall: 'd1-status-fire-wall-contact-damage',
  Inferno: 'd1-status-inferno-contact-damage',
  Apocalypse: 'd1-status-apocalypse-impact-not-status',
  ManaShield: 'd1-status-mana-shield',
  Infravision: 'd1-status-infravision',
  Teleport: 'd1-status-teleport-phasing-relocation',
  Phasing: 'd1-status-teleport-phasing-relocation',
  Invisibility: 'd1-status-invisibility-unused',
};

const spellLinks = (entityId: string): CatalogLink[] => Object.entries(SPELL_STATUS_ENTITY_IDS)
  .filter(([, statusId]) => statusId === entityId)
  .map(([spell]) => ({ catalogId: 'spellbook', entityId: `d1-${spell}`, role: 'source' }));

const engineFiles = (refs: readonly string[]): string => [...new Set(refs.map((ref) => {
  const path = /\/Source\/(.+?)(?::\d+)?$/.exec(ref)?.[1];
  return path ? `Source/${path}` : ref;
}))].map((path) => `engine: ${path}`).join(', ');

export type StatusCatalogEntity = IngestedEntity;
export interface StatusEntityWrapper { catalogId: 'status-effects'; entity: StatusCatalogEntity }

const NON_PROMOTED_ENGINE_HOOKS = new Set([
  'd1-etherealize-dead-hook',
  'd1-rage-two-phase-hook',
]);

/** The 29 reachable vanilla pseudo-wrappers. Expansion rows and dormant hooks remain census/canon only. */
export function statusEntities(): StatusEntityWrapper[] {
  return STATUS_SPECS.filter((spec) => !spec.hellfire && !NON_PROMOTED_ENGINE_HOOKS.has(spec.id)).map((spec) => {
    const id = statusEntityId(spec.id);
    return {
      catalogId: 'status-effects',
      entity: {
        id,
        catalogId: 'status-effects',
        name: spec.name,
        categoryPath: ['Diablo I', 'Engine states'],
        tags: ['diablo-state', spec.appliesTo],
        lifecycle: 'planned',
        links: spellLinks(id),
        data: {
          appliesTo: spec.appliesTo,
          source: spec.source,
          duration: spec.duration,
          stacking: spec.stacking,
          effect: spec.effect,
          removal: spec.removal,
        },
        provenance: {
          kind: 'ingest',
          sourceGame: DIABLO1.game,
          sourceProject: DIABLO1.project,
          sourceFile: engineFiles(spec.refs),
          sourceRow: spec.source,
          licenceNote: DIABLO1.licenceNote,
          ingestedAt: '2026-09-26T00:00:00.000Z',
          canonProfile: DIABLO1.canonProfile,
        },
      },
    };
  });
}

const CONTACT_DAMAGE = new Map<string, string>([
  ['d1-status-fire-wall-contact-damage', 'Fire'],
  ['d1-status-inferno-contact-damage', 'Fire'],
  ['d1-status-acid-puddle-contact-damage', 'Acid'],
  ['d1-status-lightning-wall-contact-damage', 'Lightning'],
]);
const CONTROL = new Set([
  'd1-status-stone-curse-petrification',
  'd1-status-monster-hit-recovery',
  'd1-status-hero-hit-recovery',
]);

function nonPipelineKind(entity: StatusCatalogEntity): string {
  const data = entity.data;
  const duration = String(data.duration ?? '').toLowerCase();
  const source = String(data.source ?? '').toLowerCase();
  const effect = String(data.effect ?? '').toLowerCase();
  if (duration.includes('permanent')) return 'persistent-mutation';
  if (duration.startsWith('instant') || effect.includes('no state is applied')) return 'instant-operation';
  if (source.includes('item power') || duration.includes('while an identified')) return 'equipment-effect';
  if (effect.includes('no implemented') || effect.includes('no assignment')) return 'unreachable-engine-hook';
  if (source.includes('monstergoal') || effect.includes('ai goal')) return 'ai-state';
  if (effect.includes('map') || source.includes('fountain') || source.includes('shrine')) return 'world-or-resource-state';
  return 'engine-owned-state';
}

function removalMode(entity: StatusCatalogEntity): string {
  const duration = String(entity.data.duration ?? '').toLowerCase();
  if (entity.id === 'd1-status-stone-curse-petrification') return 'duration';
  if (entity.id.endsWith('hit-recovery')) return 'animation';
  if (duration.includes('permanent')) return 'persistent';
  if (duration.startsWith('instant')) return 'immediate';
  if (duration.includes('equipped')) return 'source-removed';
  return 'owner-specific';
}

function stamp(entity: StatusCatalogEntity, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance.sourceGame,
    sourceFile: entity.provenance.sourceFile,
    sourceRow: entity.provenance.sourceRow,
    columns,
  };
}

/** Seed only values the census can state. Missing PoF numeric budgets remain explicit reference gaps. */
export function seedStatusSteps(entity: StatusCatalogEntity): StepSeed[] {
  if (entity.catalogId !== 'status-effects' || !entity.id.startsWith('d1-status-')) return [];
  const sourceDamageType = CONTACT_DAMAGE.get(entity.id);
  const isControl = CONTROL.has(entity.id);
  const kind = sourceDamageType ? 'damage-over-time' : isControl ? 'control' : nonPipelineKind(entity);
  const links = entity.links ?? [];
  const effect: Record<string, unknown> = {
    tag: entity.id,
    kind,
    stacking: entity.data.stacking,
    removal: { mode: removalMode(entity), onRemove: entity.data.removal },
    ...(sourceDamageType ? {
      magnitude: REFERENCE_GAP,
      period: REFERENCE_GAP,
      duration: REFERENCE_GAP,
      sourceDamageType,
    } : {}),
  };
  const seeds: StepSeed[] = [{
    catalogId: 'status-effects', entityId: entity.id, step: 'Effect Logic',
    data: {
      effect,
      links,
      [SOURCED_FIELD]: stamp(entity, ['source', 'duration', 'stacking', 'effect', 'removal']),
    },
    gaps: [
      'tag: Diablo I has no shared actor-status tag; the catalog entity id is the only common identity',
      ...(sourceDamageType ? [
        'magnitude: the census does not state one fixed per-tick hit for every source and level',
        'period/duration: the engine states game ticks and source-dependent formulas, while the PoF step requires fixed seconds',
      ] : []),
    ],
  }];

  if (sourceDamageType) {
    seeds.push({
      catalogId: 'status-effects', entityId: entity.id, step: 'Balance',
      data: {
        balance: { kind: 'damage-over-time', dps: REFERENCE_GAP, tierTarget: REFERENCE_GAP },
        [SOURCED_FIELD]: stamp(entity, ['effect', 'duration', '(law d1-status-overview-law)']),
      },
      gaps: [
        'dps: collision damage depends on its owning missile/source and the census supplies no single DPS',
        'tierTarget: Diablo I engine state has no PoF tier-100 balance target',
      ],
    });
  } else if (isControl) {
    seeds.push({
      catalogId: 'status-effects', entityId: entity.id, step: 'Balance',
      data: {
        balance: {
          kind: 'control',
          controlBudget: {
            controlKind: entity.id.includes('stone-curse') ? 'petrify' : 'hit-recovery',
            magnitude: REFERENCE_GAP,
            durationSec: REFERENCE_GAP,
            immunityTag: REFERENCE_GAP,
            immunityWindowSec: REFERENCE_GAP,
            terminationMode: removalMode(entity),
          },
        },
        [SOURCED_FIELD]: stamp(entity, ['duration', 'effect', 'removal']),
      },
      gaps: [
        'magnitude/durationSec: the engine supplies a formula or actor animation, not one fixed PoF control budget in seconds',
        'immunityTag/immunityWindowSec: Diablo I has eligibility checks but no post-control anti-chain-lock window',
      ],
    });
  } else {
    seeds[0].gaps.push(
      `Balance: engine kind "${kind}" is neither damage-over-time nor control, the only shapes accepted by the status-effects Balance checker`,
    );
  }
  return seeds;
}
