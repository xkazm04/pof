// ── Quest objective types ──

export type QuestObjectiveType = 'kill' | 'collect' | 'interact' | 'reach-location' | 'escort' | 'defend' | 'talk';

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;
  /** Target class name (e.g., AEnemyCharacter) or room id */
  target: string;
  /** Required count for kill/collect objectives */
  count: number;
  /** Room where this objective takes place */
  roomId?: string;
  roomName?: string;
  optional: boolean;
}

// ── Dialogue node ──

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId: string | null;
  condition?: string;
  questEffect?: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices: DialogueChoice[];
}

// ── Generated quest ──

export type QuestDifficulty = 1 | 2 | 3 | 4 | 5;
export type QuestCategory = 'main' | 'side' | 'bounty' | 'exploration' | 'fetch';

export interface GeneratedQuest {
  id: string;
  name: string;
  category: QuestCategory;
  description: string;
  difficulty: QuestDifficulty;
  objectives: QuestObjective[];
  /** NPC that gives this quest */
  giverClass?: string;
  giverRoomId?: string;
  /** Rooms traversed in order */
  roomPath: string[];
  /** Dialogue tree for the quest giver */
  dialogue: DialogueNode[];
  /** How the quest was generated */
  sourceHint: string;
  /** Reward suggestions */
  rewards: string[];
}

// ── World scan results ──

export interface WorldActor {
  className: string;
  prefix: 'A' | 'U' | 'F' | '';
  headerPath: string;
  /** Inferred role based on class name patterns */
  role: 'enemy' | 'npc' | 'interactable' | 'item' | 'trigger' | 'other';
}

export interface WorldScanResult {
  actors: WorldActor[];
  enemyClasses: string[];
  npcClasses: string[];
  interactableClasses: string[];
  itemClasses: string[];
}

// ── Full generation result ──

export interface QuestGenerationResult {
  generatedAt: string;
  worldScan: WorldScanResult;
  levelDocId: number | null;
  levelDocName: string | null;
  quests: GeneratedQuest[];
  coherenceNotes: string[];
}
