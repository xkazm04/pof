/** Aggregate Diablo I's per-class tables into the character entity PoF promotes. */
import { contentHash } from '@/lib/catalog/reference/hash';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const CLASS_FILE = /^classes\/([^/]+)\/(attributes|animations|starting_loadout|sounds|sprites)\.tsv$/;
const WEAPON_GRAPHICS = [
  'unarmed', 'unarmedShield', 'sword', 'swordShield', 'bow', 'axe', 'mace', 'maceShield', 'staff',
] as const;

function valueAt(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

function animationsOf(data: Record<string, unknown>): Record<string, unknown> {
  const attack = Object.fromEntries(WEAPON_GRAPHICS.map((graphic) => [graphic, {
    frames: valueAt(data, `animations.attack.${graphic}.frames`),
    actionFrame: valueAt(data, `animations.attack.${graphic}.actionFrame`),
  }]));
  return {
    attack,
    dungeon: {
      idleFrames: valueAt(data, 'animations.dungeon.idleFrames'),
      walkingFrames: valueAt(data, 'animations.dungeon.walkingFrames'),
    },
    block: { frames: valueAt(data, 'animations.block.frames') },
    death: { frames: valueAt(data, 'animations.death.frames') },
    cast: {
      frames: valueAt(data, 'animations.cast.frames'),
      actionFrame: valueAt(data, 'animations.cast.actionFrame'),
    },
    hitRecovery: { frames: valueAt(data, 'animations.hitRecovery.frames') },
    town: {
      idleFrames: valueAt(data, 'animations.town.idleFrames'),
      walkingFrames: valueAt(data, 'animations.town.walkingFrames'),
    },
  };
}

function startingLoadoutOf(data: Record<string, unknown>): Record<string, unknown> {
  return {
    skillId: valueAt(data, 'startingLoadout.skillId'),
    spellId: valueAt(data, 'startingLoadout.spellId'),
    spellLevel: valueAt(data, 'startingLoadout.spellLevel'),
    itemIds: [0, 1, 2, 3, 4].flatMap((index) => {
      const value = valueAt(data, `startingLoadout.itemIds[${index}]`);
      return value === undefined ? [] : [value];
    }),
    gold: valueAt(data, 'startingLoadout.gold'),
  };
}

/**
 * Replace stored class-table fragments with one aggregate per class. Non-class character
 * wrappers (the towners table) pass through unchanged.
 */
export function aggregateClassWrappers(wrappers: readonly ReferenceWrapper[]): ReferenceWrapper[] {
  const ordinary: ReferenceWrapper[] = [];
  const byFolder = new Map<string, ReferenceWrapper[]>();
  for (const wrapper of wrappers) {
    const match = CLASS_FILE.exec(wrapper.file);
    if (!match) {
      ordinary.push(wrapper);
      continue;
    }
    const group = byFolder.get(match[1]) ?? [];
    group.push(wrapper);
    byFolder.set(match[1], group);
  }

  const aggregates: ReferenceWrapper[] = [];
  for (const [folder, group] of byFolder) {
    const attributes = group.find((wrapper) => wrapper.file === `classes/${folder}/attributes.tsv`);
    if (!attributes) continue;
    const animations = group.find((wrapper) => wrapper.file === `classes/${folder}/animations.tsv`);
    const loadout = group.find((wrapper) => wrapper.file === `classes/${folder}/starting_loadout.tsv`);
    const speechSeen = new Set<string>();
    const heroSpeech = group.flatMap((wrapper) => {
      if (wrapper.file !== `classes/${folder}/sounds.tsv`) return [];
      const eventId = valueAt(wrapper.entity.data, 'heroSpeech[].eventId');
      if (!eventId || speechSeen.has(eventId)) return [];
      speechSeen.add(eventId);
      return [{ eventId }];
    });
    const files = [...new Set(group.map((wrapper) => wrapper.file))];
    const rows = group.map((wrapper) => wrapper.entity.provenance.sourceRow);
    const data: Record<string, unknown> = { ...attributes.entity.data };
    if (animations) data.animations = animationsOf(animations.entity.data);
    if (loadout) data.startingLoadout = startingLoadoutOf(loadout.entity.data);
    if (heroSpeech.length) data.heroSpeech = heroSpeech;

    aggregates.push({
      ...attributes,
      wrapperId: `${attributes.sourceId}:classes/${folder}:class-${folder}@aggregate`,
      file: `classes/${folder}`,
      rawHash: contentHash(group.map((wrapper) => wrapper.rawHash)),
      mappingVersion: contentHash(group.map((wrapper) => wrapper.mappingVersion)),
      entity: {
        ...attributes.entity,
        data,
        provenance: {
          ...attributes.entity.provenance,
          sourceFile: files.join(', '),
          sourceRow: rows.join('; '),
        },
      },
    });
  }

  return [...ordinary, ...aggregates];
}
