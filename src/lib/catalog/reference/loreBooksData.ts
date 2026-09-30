/** Engine-derived lore-book vocabulary. This table contains identifiers and source locations, never book prose. */
export type LoreSource = 'library' | 'quest-book' | 'journal' | 'epilogue';

export interface LoreVolumeSpec {
  line: string;
  where: string;
}

export interface LoreBookSpec {
  title: string;
  source: LoreSource;
  volumes: readonly LoreVolumeSpec[];
  quest?: string;
  references: readonly string[];
}

const classes = (stem: string, where: string): LoreVolumeSpec[] => [
  { line: `TEXT_${stem}`, where: `${where}; Warrior or Barbarian reading` },
  { line: `TEXT_R${stem}`, where: `${where}; Rogue or Bard reading` },
  { line: `TEXT_M${stem}`, where: `${where}; Sorcerer reading` },
  { line: `TEXT_H${stem}`, where: `${where}; Monk reading` },
];

const spells = (suffix: string, ordinal: string): LoreVolumeSpec[] => [
  { line: `TEXT_BOOK${suffix}`, where: `Read the ${ordinal} OBJ_L5BOOKS tome on dungeon level 24; Warrior or Barbarian reading` },
  { line: `TEXT_RBOOK${suffix}`, where: `Read the ${ordinal} OBJ_L5BOOKS tome on dungeon level 24; Rogue reading` },
  { line: `TEXT_MBOOK${suffix}`, where: `Read the ${ordinal} OBJ_L5BOOKS tome on dungeon level 24; Sorcerer reading` },
  { line: `TEXT_OBOOK${suffix}`, where: `Read the ${ordinal} OBJ_L5BOOKS tome on dungeon level 24; Monk reading` },
  { line: `TEXT_BBOOK${suffix}`, where: `Read the ${ordinal} OBJ_L5BOOKS tome on dungeon level 24; Bard reading` },
];

export const LORE_BOOK_SPECS: readonly LoreBookSpec[] = [
  {
    title: 'The Great Conflict', source: 'library',
    volumes: [{ line: 'TEXT_BOOK11', where: 'Read OBJ_STORYBOOK on dungeon level 4 when story-book group 0 is selected' }],
    references: ['Source/objects.cpp:213', 'Source/objects.cpp:232', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'The Wages of Sin are War', source: 'library',
    volumes: [{ line: 'TEXT_BOOK12', where: 'Read OBJ_STORYBOOK on dungeon level 8 when story-book group 0 is selected' }],
    references: ['Source/objects.cpp:214', 'Source/objects.cpp:232', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'The Tale of the Horadrim', source: 'library',
    volumes: [{ line: 'TEXT_BOOK13', where: 'Read OBJ_STORYBOOK on dungeon level 12 when story-book group 0 is selected' }],
    references: ['Source/objects.cpp:215', 'Source/objects.cpp:232', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'The Dark Exile', source: 'library',
    volumes: [{ line: 'TEXT_BOOK21', where: 'Read OBJ_STORYBOOK on dungeon level 4 when story-book group 1 is selected' }],
    references: ['Source/objects.cpp:216', 'Source/objects.cpp:233', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'The Sin War', source: 'library',
    volumes: [{ line: 'TEXT_BOOK22', where: 'Read OBJ_STORYBOOK on dungeon level 8 when story-book group 1 is selected' }],
    references: ['Source/objects.cpp:217', 'Source/objects.cpp:233', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'The Binding of the Three', source: 'library',
    volumes: [{ line: 'TEXT_BOOK23', where: 'Read OBJ_STORYBOOK on dungeon level 12 when story-book group 1 is selected' }],
    references: ['Source/objects.cpp:218', 'Source/objects.cpp:233', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'The Realms Beyond', source: 'library',
    volumes: [{ line: 'TEXT_BOOK31', where: 'Read OBJ_STORYBOOK on dungeon level 4 when story-book group 2 is selected' }],
    references: ['Source/objects.cpp:219', 'Source/objects.cpp:234', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'Tale of the Three', source: 'library',
    volumes: [{ line: 'TEXT_BOOK32', where: 'Read OBJ_STORYBOOK on dungeon level 8 when story-book group 2 is selected' }],
    references: ['Source/objects.cpp:220', 'Source/objects.cpp:234', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'The Black King', source: 'library',
    volumes: [{ line: 'TEXT_BOOK33', where: 'Read OBJ_STORYBOOK on dungeon level 12 when story-book group 2 is selected' }],
    references: ['Source/objects.cpp:221', 'Source/objects.cpp:234', 'Source/objects.cpp:1391', 'Source/objects.cpp:3374', 'Source/objects.cpp:3825'],
  },
  {
    title: 'Mythical Book', source: 'quest-book', quest: 'Q_SCHAMB',
    volumes: classes('BONER', 'Read OBJ_BOOK2R while Q_SCHAMB is available'),
    references: ['Source/objects.cpp:1969', 'Source/objects.cpp:1989', 'Source/objects.cpp:2014', 'Source/objects.cpp:3853', 'Source/objects.cpp:3854', 'Source/objects.cpp:4825'],
  },
  {
    title: 'Book of the Blind', source: 'quest-book', quest: 'Q_BLIND',
    volumes: classes('BLINDING', 'Read OBJ_BLINDBOOK while Q_BLIND is available'),
    references: ['Source/objects.cpp:1930', 'Source/objects.cpp:1963', 'Source/objects.cpp:3857', 'Source/objects.cpp:3882', 'Source/objects.cpp:4865'],
  },
  {
    title: 'Book of Blood', source: 'quest-book', quest: 'Q_BLOOD',
    volumes: classes('BLOODY', 'Read OBJ_BLOODBOOK while Q_BLOOD is available'),
    references: ['Source/objects.cpp:1936', 'Source/objects.cpp:1963', 'Source/objects.cpp:3885', 'Source/objects.cpp:3910', 'Source/objects.cpp:4867'],
  },
  {
    title: 'Steel Tome', source: 'quest-book', quest: 'Q_WARLORD',
    volumes: classes('BLOODWAR', 'Read OBJ_STEELTOME while Q_WARLORD is available'),
    references: ['Source/objects.cpp:1944', 'Source/objects.cpp:1963', 'Source/objects.cpp:3920', 'Source/objects.cpp:3945', 'Source/objects.cpp:4884'],
  },
  {
    title: 'Journal: The Meeting', source: 'journal', quest: 'Q_NAKRUL',
    volumes: [{ line: 'TEXT_BOOK4', where: 'Read the OBJ_L5BOOKS story book placed on dungeon level 21' }],
    references: ['Source/objects.cpp:223', 'Source/objects.cpp:671', 'Source/objects.cpp:3374', 'Source/objects.cpp:3393', 'Source/objects.cpp:3828'],
  },
  {
    title: 'Journal: The Tirade', source: 'journal', quest: 'Q_NAKRUL',
    volumes: [{ line: 'TEXT_BOOK5', where: 'Read the first OBJ_L5BOOKS story book placed on dungeon level 22' }],
    references: ['Source/objects.cpp:224', 'Source/objects.cpp:671', 'Source/objects.cpp:3374', 'Source/objects.cpp:3393', 'Source/objects.cpp:3830'],
  },
  {
    title: 'Journal: His Power Grows', source: 'journal', quest: 'Q_NAKRUL',
    volumes: [{ line: 'TEXT_BOOK6', where: 'Read the second OBJ_L5BOOKS story book placed on dungeon level 22' }],
    references: ['Source/objects.cpp:225', 'Source/objects.cpp:671', 'Source/objects.cpp:3374', 'Source/objects.cpp:3393', 'Source/objects.cpp:3831'],
  },
  {
    title: 'Journal: NA-KRUL', source: 'journal', quest: 'Q_NAKRUL',
    volumes: [{ line: 'TEXT_BOOK7', where: 'Read the first OBJ_L5BOOKS story book placed on dungeon level 23' }],
    references: ['Source/objects.cpp:226', 'Source/objects.cpp:671', 'Source/objects.cpp:3374', 'Source/objects.cpp:3393', 'Source/objects.cpp:3833'],
  },
  {
    title: 'Journal: The End', source: 'journal', quest: 'Q_NAKRUL',
    volumes: [{ line: 'TEXT_BOOK8', where: 'Read the second OBJ_L5BOOKS story book placed on dungeon level 23' }],
    references: ['Source/objects.cpp:227', 'Source/objects.cpp:671', 'Source/objects.cpp:3374', 'Source/objects.cpp:3393', 'Source/objects.cpp:3834'],
  },
  {
    title: 'IDI_FULLNOTE', source: 'journal', quest: 'Q_NAKRUL',
    volumes: [{ line: 'TEXT_BOOK9', where: 'Use the reconstructed-note quest item from inventory or stash' }],
    references: ['Source/inv.cpp:963', 'Source/inv.cpp:988', 'Source/inv.cpp:2210', 'Source/inv.cpp:2221', 'Source/qol/stash.cpp:514'],
  },
  {
    title: 'A Spellbook', source: 'quest-book', quest: 'Q_NAKRUL',
    volumes: [...spells('A', 'first'), ...spells('B', 'second'), ...spells('C', 'third')],
    references: ['Source/objects.cpp:228', 'Source/objects.cpp:596', 'Source/objects.cpp:668', 'Source/objects.cpp:767', 'Source/objects.cpp:772', 'Source/objects.cpp:3344', 'Source/objects.cpp:3374', 'Source/objects.cpp:3382', 'Source/objects.cpp:3393'],
  },
  {
    title: 'Introduction', source: 'epilogue',
    volumes: [{ line: 'TEXT_INTRO', where: 'Talk to TOWN_TAVERN before the player has visited dungeon level 1' }],
    references: ['Source/towners.cpp:212', 'Source/towners.cpp:215'],
  },
] as const;
