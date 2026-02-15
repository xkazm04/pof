/**
 * Procedural Quest Generator — scans UE5 project actors + level design docs
 * and synthesizes meaningful quests from world state.
 *
 * Pipeline:
 *  1. Scan project classes to identify enemy, NPC, interactable, item actors
 *  2. Load level design docs for room graphs and spawn entries
 *  3. Synthesize quests by matching world actors to quest templates
 *  4. Generate dialogue trees for quest givers
 *  5. Check narrative coherence across generated quests
 */

import type {
  WorldActor,
  WorldScanResult,
  GeneratedQuest,
  QuestObjective,
  DialogueNode,
  DialogueChoice,
  QuestGenerationResult,
  QuestCategory,
  QuestDifficulty,
} from '@/types/quest-generation';
import type { RoomNode, RoomConnection, LevelDesignDocument } from '@/types/level-design';

// ── Actor classification ────────────────────────────────────────────────────

const ENEMY_PATTERNS = [
  /enemy/i, /monster/i, /creature/i, /boss/i, /minion/i, /zombie/i,
  /skeleton/i, /demon/i, /goblin/i, /dragon/i, /undead/i, /slime/i,
  /bandit/i, /hostile/i, /mob/i, /spawn/i,
];

const NPC_PATTERNS = [
  /npc/i, /merchant/i, /vendor/i, /shopkeep/i, /questgiver/i,
  /villager/i, /guard/i, /innkeeper/i, /blacksmith/i, /elder/i,
  /companion/i, /ally/i, /townfolk/i,
];

const INTERACTABLE_PATTERNS = [
  /interact/i, /lever/i, /switch/i, /door/i, /gate/i, /chest/i,
  /shrine/i, /altar/i, /portal/i, /button/i, /trap/i, /puzzle/i,
  /totem/i, /statue/i, /obelisk/i,
];

const ITEM_PATTERNS = [
  /item/i, /pickup/i, /loot/i, /drop/i, /collectible/i, /relic/i,
  /artifact/i, /key/i, /scroll/i, /potion/i, /weapon/i, /armor/i,
  /gem/i, /ore/i, /herb/i, /treasure/i,
];

function classifyActor(name: string, prefix: string): WorldActor['role'] {
  // Actor prefix ('A') classes are most relevant
  if (ENEMY_PATTERNS.some(r => r.test(name))) return 'enemy';
  if (NPC_PATTERNS.some(r => r.test(name))) return 'npc';
  if (INTERACTABLE_PATTERNS.some(r => r.test(name))) return 'interactable';
  if (ITEM_PATTERNS.some(r => r.test(name))) return 'item';
  if (/trigger/i.test(name)) return 'trigger';
  return 'other';
}

export function classifyActors(
  classes: Array<{ name: string; prefix: string; headerPath: string }>,
): WorldScanResult {
  const actors: WorldActor[] = [];

  for (const cls of classes) {
    // Only classify Actor-derived classes (prefix 'A') and UObject-derived
    if (cls.prefix !== 'A' && cls.prefix !== 'U') continue;
    const role = classifyActor(cls.name, cls.prefix);
    actors.push({
      className: cls.name,
      prefix: cls.prefix as 'A' | 'U' | 'F' | '',
      headerPath: cls.headerPath,
      role,
    });
  }

  return {
    actors,
    enemyClasses: actors.filter(a => a.role === 'enemy').map(a => a.className),
    npcClasses: actors.filter(a => a.role === 'npc').map(a => a.className),
    interactableClasses: actors.filter(a => a.role === 'interactable').map(a => a.className),
    itemClasses: actors.filter(a => a.role === 'item').map(a => a.className),
  };
}

// ── Quest synthesis ─────────────────────────────────────────────────────────

let nextId = 0;
function uid(): string { return `quest-${++nextId}`; }
function oid(): string { return `obj-${++nextId}`; }
function did(): string { return `dlg-${++nextId}`; }
function cid(): string { return `ch-${++nextId}`; }

/** Generate dungeon clear quests from combat rooms with spawn entries */
function generateClearQuests(
  rooms: RoomNode[],
  connections: RoomConnection[],
  worldScan: WorldScanResult,
  docName: string,
): GeneratedQuest[] {
  const quests: GeneratedQuest[] = [];
  const combatRooms = rooms.filter(r => r.type === 'combat' || r.type === 'boss');

  if (combatRooms.length === 0) return quests;

  // Group connected combat rooms into dungeon segments
  const segments = buildCombatSegments(combatRooms, connections);

  for (const segment of segments) {
    const totalSpawns = segment.flatMap(r => r.spawnEntries);
    const uniqueEnemies = [...new Set(totalSpawns.map(s => s.enemyClass))];
    const totalCount = totalSpawns.reduce((sum, s) => sum + s.count, 0);
    const hasBoss = segment.some(r => r.type === 'boss');
    const maxDifficulty = Math.max(...segment.map(r => r.difficulty)) as QuestDifficulty;

    if (totalCount === 0 && uniqueEnemies.length === 0) continue;

    const objectives: QuestObjective[] = [];

    // Kill objectives per enemy class
    for (const enemy of uniqueEnemies) {
      const count = totalSpawns.filter(s => s.enemyClass === enemy).reduce((sum, s) => sum + s.count, 0);
      objectives.push({
        id: oid(),
        type: 'kill',
        description: `Defeat ${count} ${formatClassName(enemy)}`,
        target: enemy,
        count,
        roomId: segment[0].id,
        roomName: segment[0].name,
        optional: false,
      });
    }

    // If boss room, add boss objective
    if (hasBoss) {
      const bossRoom = segment.find(r => r.type === 'boss')!;
      objectives.push({
        id: oid(),
        type: 'kill',
        description: `Defeat the boss in ${bossRoom.name}`,
        target: bossRoom.spawnEntries[0]?.enemyClass || 'Boss',
        count: 1,
        roomId: bossRoom.id,
        roomName: bossRoom.name,
        optional: false,
      });
    }

    const questName = hasBoss
      ? `Conquer ${segment[0].name}`
      : `Clear the ${docName} Ruins`;

    const giverNpc = worldScan.npcClasses[0] || undefined;

    quests.push({
      id: uid(),
      name: questName,
      category: hasBoss ? 'main' : 'bounty',
      description: `Eliminate ${totalCount} enemies across ${segment.length} area${segment.length > 1 ? 's' : ''} in ${docName}.`,
      difficulty: maxDifficulty,
      objectives,
      giverClass: giverNpc,
      giverRoomId: findNearestSafeRoom(segment[0].id, rooms, connections)?.id,
      roomPath: segment.map(r => r.id),
      dialogue: generateQuestDialogue(questName, giverNpc, 'clear', totalCount),
      sourceHint: `Generated from ${segment.length} combat rooms with ${totalSpawns.length} spawn entries`,
      rewards: generateRewards(maxDifficulty, hasBoss),
    });
  }

  return quests;
}

/** Generate fetch/collect quests from interactable/item actors and exploration rooms */
function generateFetchQuests(
  rooms: RoomNode[],
  _connections: RoomConnection[],
  worldScan: WorldScanResult,
  docName: string,
): GeneratedQuest[] {
  const quests: GeneratedQuest[] = [];
  const explorationRooms = rooms.filter(r => r.type === 'exploration' || r.type === 'puzzle');

  if (explorationRooms.length === 0 || worldScan.itemClasses.length === 0) return quests;

  // Create one fetch quest per item class
  for (const itemClass of worldScan.itemClasses.slice(0, 3)) {
    const targetRoom = explorationRooms[Math.floor(Math.random() * explorationRooms.length)];
    const difficulty = targetRoom.difficulty as QuestDifficulty;

    quests.push({
      id: uid(),
      name: `Recover the Lost ${formatClassName(itemClass)}`,
      category: 'fetch',
      description: `Search ${targetRoom.name} in ${docName} to find the ${formatClassName(itemClass)}.`,
      difficulty,
      objectives: [
        {
          id: oid(),
          type: 'reach-location',
          description: `Travel to ${targetRoom.name}`,
          target: targetRoom.id,
          count: 1,
          roomId: targetRoom.id,
          roomName: targetRoom.name,
          optional: false,
        },
        {
          id: oid(),
          type: 'collect',
          description: `Find the ${formatClassName(itemClass)}`,
          target: itemClass,
          count: 1,
          roomId: targetRoom.id,
          roomName: targetRoom.name,
          optional: false,
        },
      ],
      giverClass: worldScan.npcClasses[0] || undefined,
      roomPath: [targetRoom.id],
      dialogue: generateQuestDialogue(`Recover the Lost ${formatClassName(itemClass)}`, worldScan.npcClasses[0], 'fetch', 1),
      sourceHint: `Generated from item class ${itemClass} placed in exploration room ${targetRoom.name}`,
      rewards: generateRewards(difficulty, false),
    });
  }

  return quests;
}

/** Generate interaction quests from interactable actors */
function generateInteractionQuests(
  rooms: RoomNode[],
  connections: RoomConnection[],
  worldScan: WorldScanResult,
  docName: string,
): GeneratedQuest[] {
  const quests: GeneratedQuest[] = [];

  if (worldScan.interactableClasses.length === 0) return quests;

  // Puzzle rooms with interactable actors become interaction quests
  const puzzleRooms = rooms.filter(r => r.type === 'puzzle');

  for (const room of puzzleRooms.slice(0, 2)) {
    const interactable = worldScan.interactableClasses[0];
    const difficulty = room.difficulty as QuestDifficulty;

    quests.push({
      id: uid(),
      name: `Secrets of ${room.name}`,
      category: 'exploration',
      description: `Investigate the ${formatClassName(interactable)} in ${room.name} to uncover hidden knowledge.`,
      difficulty,
      objectives: [
        {
          id: oid(),
          type: 'reach-location',
          description: `Navigate to ${room.name}`,
          target: room.id,
          count: 1,
          roomId: room.id,
          roomName: room.name,
          optional: false,
        },
        {
          id: oid(),
          type: 'interact',
          description: `Activate the ${formatClassName(interactable)}`,
          target: interactable,
          count: 1,
          roomId: room.id,
          roomName: room.name,
          optional: false,
        },
      ],
      giverClass: worldScan.npcClasses[0] || undefined,
      roomPath: [room.id],
      dialogue: generateQuestDialogue(`Secrets of ${room.name}`, worldScan.npcClasses[0], 'interact', 1),
      sourceHint: `Generated from puzzle room ${room.name} with interactable ${interactable}`,
      rewards: generateRewards(difficulty, false),
    });
  }

  return quests;
}

/** Generate multi-zone traversal quests from difficulty arcs */
function generateTraversalQuests(
  rooms: RoomNode[],
  connections: RoomConnection[],
  difficultyArc: string[],
  worldScan: WorldScanResult,
  docName: string,
): GeneratedQuest[] {
  const quests: GeneratedQuest[] = [];

  if (difficultyArc.length < 3) return quests;

  // Full level traversal as a main quest
  const arcRooms = difficultyArc
    .map(id => rooms.find(r => r.id === id))
    .filter((r): r is RoomNode => r != null);

  if (arcRooms.length < 3) return quests;

  const objectives: QuestObjective[] = [];
  for (const room of arcRooms) {
    objectives.push({
      id: oid(),
      type: 'reach-location',
      description: `Reach ${room.name}`,
      target: room.id,
      count: 1,
      roomId: room.id,
      roomName: room.name,
      optional: room.type === 'safe' || room.type === 'transition',
    });
  }

  const maxDifficulty = Math.max(...arcRooms.map(r => r.difficulty)) as QuestDifficulty;

  quests.push({
    id: uid(),
    name: `Journey Through ${docName}`,
    category: 'main',
    description: `Traverse all ${arcRooms.length} zones of ${docName}, from the entrance to the final chamber.`,
    difficulty: maxDifficulty,
    objectives,
    giverClass: worldScan.npcClasses[0] || undefined,
    giverRoomId: arcRooms[0]?.id,
    roomPath: difficultyArc,
    dialogue: generateQuestDialogue(`Journey Through ${docName}`, worldScan.npcClasses[0], 'traverse', arcRooms.length),
    sourceHint: `Generated from ${docName} difficulty arc with ${arcRooms.length} zones`,
    rewards: generateRewards(maxDifficulty, true),
  });

  return quests;
}

// ── Dialogue generation ─────────────────────────────────────────────────────

function generateQuestDialogue(
  questName: string,
  npcClass: string | undefined,
  questType: 'clear' | 'fetch' | 'interact' | 'traverse',
  count: number,
): DialogueNode[] {
  const speaker = npcClass ? formatClassName(npcClass) : 'Quest Giver';
  const nodes: DialogueNode[] = [];

  // Opening node
  const openingTexts: Record<string, string> = {
    clear: `Adventurer, the ruins are overrun with ${count} hostiles. I need someone brave enough to clear them out.`,
    fetch: `I've lost something precious in the depths. Would you retrieve it for me?`,
    interact: `There's an ancient mechanism deep within. Activate it, and great power awaits.`,
    traverse: `The path ahead spans ${count} zones. Only the worthy reach the end.`,
  };

  const acceptNode = did();
  const declineNode = did();
  const openingId = did();

  nodes.push({
    id: openingId,
    speaker,
    text: openingTexts[questType],
    choices: [
      { id: cid(), text: 'I accept the challenge.', nextNodeId: acceptNode, questEffect: 'accept' },
      { id: cid(), text: 'Tell me more about this task.', nextNodeId: did(), condition: undefined },
      { id: cid(), text: 'Not right now.', nextNodeId: declineNode },
    ],
  });

  // Accept node
  nodes.push({
    id: acceptNode,
    speaker,
    text: `Excellent! ${questName} begins now. Return to me when the deed is done.`,
    choices: [{ id: cid(), text: '[Leave]', nextNodeId: null }],
  });

  // Decline node
  nodes.push({
    id: declineNode,
    speaker,
    text: 'I understand. Come back when you are ready.',
    choices: [{ id: cid(), text: '[Leave]', nextNodeId: null }],
  });

  return nodes;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatClassName(name: string): string {
  // Strip A/U prefix, split PascalCase
  let clean = name;
  if (/^[AUF][A-Z]/.test(clean)) clean = clean.slice(1);
  return clean.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function buildCombatSegments(
  combatRooms: RoomNode[],
  connections: RoomConnection[],
): RoomNode[][] {
  // Group connected combat rooms into segments
  const visited = new Set<string>();
  const segments: RoomNode[][] = [];
  const adjacency = new Map<string, string[]>();

  for (const conn of connections) {
    if (!adjacency.has(conn.fromId)) adjacency.set(conn.fromId, []);
    adjacency.get(conn.fromId)!.push(conn.toId);
    if (conn.bidirectional) {
      if (!adjacency.has(conn.toId)) adjacency.set(conn.toId, []);
      adjacency.get(conn.toId)!.push(conn.fromId);
    }
  }

  const combatIds = new Set(combatRooms.map(r => r.id));

  for (const room of combatRooms) {
    if (visited.has(room.id)) continue;
    const segment: RoomNode[] = [];
    const stack = [room];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (visited.has(curr.id)) continue;
      visited.add(curr.id);
      segment.push(curr);
      const neighbors = adjacency.get(curr.id) || [];
      for (const nId of neighbors) {
        if (!visited.has(nId) && combatIds.has(nId)) {
          const neighbor = combatRooms.find(r => r.id === nId);
          if (neighbor) stack.push(neighbor);
        }
      }
    }
    if (segment.length > 0) segments.push(segment);
  }

  return segments;
}

function findNearestSafeRoom(
  startId: string,
  rooms: RoomNode[],
  connections: RoomConnection[],
): RoomNode | undefined {
  // BFS for nearest safe/hub room
  const visited = new Set<string>();
  const queue = [startId];
  const adjacency = new Map<string, string[]>();

  for (const conn of connections) {
    if (!adjacency.has(conn.fromId)) adjacency.set(conn.fromId, []);
    adjacency.get(conn.fromId)!.push(conn.toId);
    if (conn.bidirectional) {
      if (!adjacency.has(conn.toId)) adjacency.set(conn.toId, []);
      adjacency.get(conn.toId)!.push(conn.fromId);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const room = rooms.find(r => r.id === id);
    if (room && (room.type === 'safe' || room.type === 'hub')) return room;
    const neighbors = adjacency.get(id) || [];
    for (const nId of neighbors) {
      if (!visited.has(nId)) queue.push(nId);
    }
  }

  return undefined;
}

function generateRewards(difficulty: QuestDifficulty, isMajor: boolean): string[] {
  const xpBase = difficulty * 100;
  const goldBase = difficulty * 50;
  const rewards = [
    `${isMajor ? xpBase * 3 : xpBase} XP`,
    `${isMajor ? goldBase * 3 : goldBase} Gold`,
  ];
  if (difficulty >= 4) rewards.push('Rare Equipment');
  if (isMajor) rewards.push('Unique Weapon or Armor');
  return rewards;
}

/** Check for narrative coherence issues across quests */
function checkCoherence(quests: GeneratedQuest[]): string[] {
  const notes: string[] = [];

  // Check for duplicate room targets across quests
  const roomUsage = new Map<string, string[]>();
  for (const q of quests) {
    for (const rid of q.roomPath) {
      if (!roomUsage.has(rid)) roomUsage.set(rid, []);
      roomUsage.get(rid)!.push(q.name);
    }
  }
  for (const [roomId, questNames] of roomUsage) {
    if (questNames.length > 2) {
      notes.push(`Room ${roomId} is referenced by ${questNames.length} quests — may feel repetitive`);
    }
  }

  // Check for contradictory objectives (kill same enemy in two quests)
  const killTargets = new Map<string, string[]>();
  for (const q of quests) {
    for (const obj of q.objectives) {
      if (obj.type === 'kill') {
        if (!killTargets.has(obj.target)) killTargets.set(obj.target, []);
        killTargets.get(obj.target)!.push(q.name);
      }
    }
  }
  for (const [target, questNames] of killTargets) {
    if (questNames.length > 1) {
      notes.push(`${formatClassName(target)} is a kill target in ${questNames.length} quests — ensure spawn counts support concurrent objectives`);
    }
  }

  // Check main quest count
  const mainQuests = quests.filter(q => q.category === 'main');
  if (mainQuests.length > 3) {
    notes.push(`${mainQuests.length} main quests generated — consider downgrading some to side quests`);
  }

  // Check for quests with no NPC giver
  const noGiver = quests.filter(q => !q.giverClass);
  if (noGiver.length > 0) {
    notes.push(`${noGiver.length} quest${noGiver.length > 1 ? 's have' : ' has'} no NPC giver — create quest giver NPCs or use item/trigger-based activation`);
  }

  if (notes.length === 0) {
    notes.push('No coherence issues detected across generated quests');
  }

  return notes;
}

// ── Main generation pipeline ────────────────────────────────────────────────

export function generateQuests(
  scannedClasses: Array<{ name: string; prefix: string; headerPath: string }>,
  levelDoc: LevelDesignDocument | null,
): QuestGenerationResult {
  nextId = 0;
  const worldScan = classifyActors(scannedClasses);
  const quests: GeneratedQuest[] = [];

  if (levelDoc) {
    const { rooms, connections, difficultyArc, name: docName } = levelDoc;

    // Generate each quest type
    quests.push(...generateClearQuests(rooms, connections, worldScan, docName));
    quests.push(...generateFetchQuests(rooms, connections, worldScan, docName));
    quests.push(...generateInteractionQuests(rooms, connections, worldScan, docName));
    quests.push(...generateTraversalQuests(rooms, connections, difficultyArc, worldScan, docName));
  } else {
    // No level doc — generate basic quests from actors only
    if (worldScan.enemyClasses.length > 0) {
      for (const enemy of worldScan.enemyClasses.slice(0, 3)) {
        quests.push({
          id: uid(),
          name: `Hunt the ${formatClassName(enemy)}`,
          category: 'bounty',
          description: `Track down and eliminate ${formatClassName(enemy)} threats.`,
          difficulty: 2,
          objectives: [{
            id: oid(),
            type: 'kill',
            description: `Defeat 5 ${formatClassName(enemy)}`,
            target: enemy,
            count: 5,
            optional: false,
          }],
          roomPath: [],
          dialogue: generateQuestDialogue(`Hunt the ${formatClassName(enemy)}`, worldScan.npcClasses[0], 'clear', 5),
          sourceHint: `Generated from enemy class ${enemy}`,
          rewards: generateRewards(2, false),
        });
      }
    }
  }

  const coherenceNotes = checkCoherence(quests);

  return {
    generatedAt: new Date().toISOString(),
    worldScan,
    levelDocId: levelDoc?.id ?? null,
    levelDocName: levelDoc?.name ?? null,
    quests,
    coherenceNotes,
  };
}
