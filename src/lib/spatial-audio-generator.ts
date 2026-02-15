// ── Spatial Audio Generator ──────────────────────────────────────────────────
// Derives AudioScene zones + emitters from level design room geometry.
// Maps room types → reverb presets, detects encounter keywords → emitters.

import type { RoomNode, RoomConnection, RoomType, PacingCurve } from '@/types/level-design';
import type { AudioZone, SoundEmitter, ReverbPreset } from '@/types/audio-scene';

// ── Room type → acoustic profile mapping ─────────────────────────────────────

interface AcousticProfile {
  reverb: ReverbPreset;
  occlusionMode: AudioZone['occlusionMode'];
  attenuationBase: number;
  priority: number;
  color: string;
  soundscapePrefix: string;
}

const ROOM_ACOUSTICS: Record<RoomType, AcousticProfile> = {
  combat: {
    reverb: 'metal-corridor',
    occlusionMode: 'medium',
    attenuationBase: 2000,
    priority: 6,
    color: '#ef4444',
    soundscapePrefix: 'Tense combat atmosphere',
  },
  boss: {
    reverb: 'stone-chamber',
    occlusionMode: 'high',
    attenuationBase: 3000,
    priority: 8,
    color: '#eab308',
    soundscapePrefix: 'Epic boss arena',
  },
  puzzle: {
    reverb: 'small-room',
    occlusionMode: 'medium',
    attenuationBase: 1500,
    priority: 5,
    color: '#a855f7',
    soundscapePrefix: 'Contemplative puzzle chamber',
  },
  exploration: {
    reverb: 'large-hall',
    occlusionMode: 'low',
    attenuationBase: 2500,
    priority: 4,
    color: '#22c55e',
    soundscapePrefix: 'Open exploration space',
  },
  safe: {
    reverb: 'small-room',
    occlusionMode: 'low',
    attenuationBase: 1200,
    priority: 3,
    color: '#3b82f6',
    soundscapePrefix: 'Calm safe haven',
  },
  transition: {
    reverb: 'metal-corridor',
    occlusionMode: 'high',
    attenuationBase: 800,
    priority: 2,
    color: '#6b7280',
    soundscapePrefix: 'Narrow corridor passage',
  },
  cutscene: {
    reverb: 'large-hall',
    occlusionMode: 'medium',
    attenuationBase: 2000,
    priority: 7,
    color: '#ec4899',
    soundscapePrefix: 'Cinematic scene',
  },
  hub: {
    reverb: 'large-hall',
    occlusionMode: 'low',
    attenuationBase: 3500,
    priority: 5,
    color: '#14b8a6',
    soundscapePrefix: 'Bustling hub area',
  },
};

// ── Keyword-based emitter detection ──────────────────────────────────────────

interface EmitterTemplate {
  keywords: RegExp;
  name: string;
  type: SoundEmitter['type'];
  soundCueRef: string;
  volumeMultiplier: number;
  attenuationRadius: number;
  cooldownSeconds: number;
  spawnChance: number;
}

const EMITTER_TEMPLATES: EmitterTemplate[] = [
  {
    keywords: /fire|fireplace|torch|flame|brazier|candle/i,
    name: 'Crackling Fire',
    type: 'loop',
    soundCueRef: '/Game/Audio/Ambience/SFX_Fire_Loop',
    volumeMultiplier: 0.7,
    attenuationRadius: 400,
    cooldownSeconds: 0,
    spawnChance: 1,
  },
  {
    keywords: /water|waterfall|fountain|stream|river|drip/i,
    name: 'Flowing Water',
    type: 'loop',
    soundCueRef: '/Game/Audio/Ambience/SFX_Water_Loop',
    volumeMultiplier: 0.8,
    attenuationRadius: 600,
    cooldownSeconds: 0,
    spawnChance: 1,
  },
  {
    keywords: /forge|anvil|blacksmith|hammer|smelt/i,
    name: 'Forge Ambience',
    type: 'loop',
    soundCueRef: '/Game/Audio/Ambience/SFX_Forge_Loop',
    volumeMultiplier: 0.6,
    attenuationRadius: 500,
    cooldownSeconds: 0,
    spawnChance: 1,
  },
  {
    keywords: /wind|breeze|gust|draft|howl/i,
    name: 'Wind Ambience',
    type: 'ambient',
    soundCueRef: '/Game/Audio/Ambience/SFX_Wind_Ambient',
    volumeMultiplier: 0.5,
    attenuationRadius: 800,
    cooldownSeconds: 0,
    spawnChance: 1,
  },
  {
    keywords: /crystal|magic|arcane|glow|rune|enchant/i,
    name: 'Arcane Hum',
    type: 'loop',
    soundCueRef: '/Game/Audio/Ambience/SFX_Arcane_Hum',
    volumeMultiplier: 0.4,
    attenuationRadius: 350,
    cooldownSeconds: 0,
    spawnChance: 1,
  },
  {
    keywords: /gate|door|portcullis|mechanism|lever/i,
    name: 'Mechanical Creak',
    type: 'oneshot',
    soundCueRef: '/Game/Audio/SFX/SFX_Mechanism_Creak',
    volumeMultiplier: 0.8,
    attenuationRadius: 500,
    cooldownSeconds: 5,
    spawnChance: 0.3,
  },
  {
    keywords: /trap|spike|dart|pressure|trigger/i,
    name: 'Trap Warning',
    type: 'oneshot',
    soundCueRef: '/Game/Audio/SFX/SFX_Trap_Warning',
    volumeMultiplier: 0.9,
    attenuationRadius: 300,
    cooldownSeconds: 3,
    spawnChance: 0.5,
  },
  {
    keywords: /crow|bird|owl|bat|insect|cricket/i,
    name: 'Creature Sounds',
    type: 'ambient',
    soundCueRef: '/Game/Audio/Ambience/SFX_Creatures_Ambient',
    volumeMultiplier: 0.3,
    attenuationRadius: 600,
    cooldownSeconds: 8,
    spawnChance: 0.6,
  },
  {
    keywords: /chain|prison|dungeon|cell|cage/i,
    name: 'Rattling Chains',
    type: 'ambient',
    soundCueRef: '/Game/Audio/Ambience/SFX_Chains_Rattle',
    volumeMultiplier: 0.4,
    attenuationRadius: 400,
    cooldownSeconds: 10,
    spawnChance: 0.4,
  },
  {
    keywords: /crowd|merchant|vendor|npc|tavern|inn|market/i,
    name: 'Crowd Chatter',
    type: 'loop',
    soundCueRef: '/Game/Audio/Ambience/SFX_Crowd_Loop',
    volumeMultiplier: 0.5,
    attenuationRadius: 700,
    cooldownSeconds: 0,
    spawnChance: 1,
  },
  {
    keywords: /music|bard|instrument|lute|drum/i,
    name: 'Background Music',
    type: 'music',
    soundCueRef: '/Game/Audio/Music/MUS_Background_Layer',
    volumeMultiplier: 0.4,
    attenuationRadius: 800,
    cooldownSeconds: 0,
    spawnChance: 1,
  },
];

// ── Pacing → ambient overlay ─────────────────────────────────────────────────

interface PacingOverlay {
  extraEmitterName: string;
  soundCueRef: string;
  type: SoundEmitter['type'];
  volumeMultiplier: number;
}

const PACING_OVERLAYS: Partial<Record<PacingCurve, PacingOverlay>> = {
  peak: {
    extraEmitterName: 'Tension Stinger',
    soundCueRef: '/Game/Audio/Music/MUS_Tension_Layer',
    type: 'music',
    volumeMultiplier: 0.3,
  },
  rest: {
    extraEmitterName: 'Calm Ambience',
    soundCueRef: '/Game/Audio/Ambience/SFX_Calm_Pad',
    type: 'ambient',
    volumeMultiplier: 0.25,
  },
  buildup: {
    extraEmitterName: 'Rising Tension',
    soundCueRef: '/Game/Audio/Music/MUS_Buildup_Layer',
    type: 'music',
    volumeMultiplier: 0.2,
  },
};

// ── Difficulty modifiers ─────────────────────────────────────────────────────

function getDifficultyModifiers(difficulty: number): {
  attenuationScale: number;
  occlusionBump: number;
  volumeScale: number;
} {
  switch (difficulty) {
    case 1: return { attenuationScale: 0.8, occlusionBump: 0, volumeScale: 0.7 };
    case 2: return { attenuationScale: 0.9, occlusionBump: 0, volumeScale: 0.8 };
    case 3: return { attenuationScale: 1.0, occlusionBump: 0, volumeScale: 1.0 };
    case 4: return { attenuationScale: 1.1, occlusionBump: 1, volumeScale: 1.1 };
    case 5: return { attenuationScale: 1.3, occlusionBump: 1, volumeScale: 1.2 };
    default: return { attenuationScale: 1.0, occlusionBump: 0, volumeScale: 1.0 };
  }
}

const OCCLUSION_LEVELS: AudioZone['occlusionMode'][] = ['none', 'low', 'medium', 'high', 'full'];

function bumpOcclusion(mode: AudioZone['occlusionMode'], bump: number): AudioZone['occlusionMode'] {
  const idx = OCCLUSION_LEVELS.indexOf(mode);
  return OCCLUSION_LEVELS[Math.min(idx + bump, OCCLUSION_LEVELS.length - 1)];
}

// ── Connection analysis for transition zones ─────────────────────────────────

function countConnections(roomId: string, connections: RoomConnection[]): number {
  return connections.filter((c) => c.fromId === roomId || c.toId === roomId).length;
}

// ── Main generator ───────────────────────────────────────────────────────────

export interface SpatialAudioGeneratorInput {
  rooms: RoomNode[];
  connections: RoomConnection[];
  levelName: string;
}

export interface SpatialAudioGeneratorResult {
  zones: AudioZone[];
  emitters: SoundEmitter[];
  globalReverbPreset: ReverbPreset;
  soundPoolSize: number;
  maxConcurrentSounds: number;
  /** Per-room breakdown of what was generated and why */
  report: RoomAudioReport[];
}

export interface RoomAudioReport {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  zoneId: string;
  reverbPreset: ReverbPreset;
  occlusionMode: string;
  emitterCount: number;
  emitterNames: string[];
  reasoning: string;
}

let emitterIdCounter = 0;
let zoneIdCounter = 0;

function genZoneId(): string {
  return `zone-auto-${++zoneIdCounter}-${Date.now().toString(36)}`;
}

function genEmitterId(): string {
  return `emitter-auto-${++emitterIdCounter}-${Date.now().toString(36)}`;
}

/**
 * Generate spatial audio zones and emitters from level design room data.
 * Maps room types to acoustic profiles and scans encounter descriptions
 * for contextual sound emitter placement.
 */
export function generateSpatialAudio(input: SpatialAudioGeneratorInput): SpatialAudioGeneratorResult {
  const { rooms, connections } = input;
  const zones: AudioZone[] = [];
  const emitters: SoundEmitter[] = [];
  const report: RoomAudioReport[] = [];

  // Reset counters
  emitterIdCounter = 0;
  zoneIdCounter = 0;

  for (const room of rooms) {
    const profile = ROOM_ACOUSTICS[room.type];
    const diffMods = getDifficultyModifiers(room.difficulty);
    const connCount = countConnections(room.id, connections);

    // Adjust reverb for highly-connected rooms (more open feel)
    let finalReverb = profile.reverb;
    if (connCount >= 4 && profile.reverb !== 'outdoor') {
      finalReverb = 'large-hall';
    }

    // Adjust occlusion based on difficulty + connection count
    let finalOcclusion = bumpOcclusion(profile.occlusionMode, diffMods.occlusionBump);
    if (connCount <= 1) {
      // Dead-end rooms feel more enclosed
      finalOcclusion = bumpOcclusion(finalOcclusion, 1);
    }

    // Calculate zone dimensions — base on room type, scale with difficulty
    const baseWidth = room.type === 'transition' ? 120 : room.type === 'boss' ? 250 : 180;
    const baseHeight = room.type === 'transition' ? 80 : room.type === 'boss' ? 220 : 150;

    const zoneId = genZoneId();

    // Build soundscape description from room data
    const soundscape = buildSoundscapeDescription(room, profile, connCount);

    const zone: AudioZone = {
      id: zoneId,
      name: `${room.name} Audio Zone`,
      shape: room.type === 'transition' ? 'rect' : 'rect',
      x: room.x,
      y: room.y,
      width: baseWidth,
      height: baseHeight,
      soundscapeDescription: soundscape,
      reverbPreset: finalReverb,
      reverbDecayTime: 1.0,
      reverbDiffusion: 0.7,
      reverbWetDry: 0.4,
      attenuationRadius: Math.round(profile.attenuationBase * diffMods.attenuationScale),
      occlusionMode: finalOcclusion,
      priority: profile.priority,
      color: profile.color,
      linkedFiles: room.linkedFiles ?? [],
    };
    zones.push(zone);

    // ── Generate emitters for this room ────────────────────────────────────

    const roomEmitters: SoundEmitter[] = [];
    const searchText = `${room.name} ${room.description} ${room.encounterDesign}`.toLowerCase();

    // Keyword-based emitter detection from room description
    for (const template of EMITTER_TEMPLATES) {
      if (template.keywords.test(searchText)) {
        const emitter: SoundEmitter = {
          id: genEmitterId(),
          name: `${room.name} — ${template.name}`,
          type: template.type,
          x: room.x + 20 + roomEmitters.length * 30,
          y: room.y + 20 + roomEmitters.length * 20,
          soundCueRef: template.soundCueRef,
          attenuationRadius: template.attenuationRadius,
          volumeMultiplier: Math.min(template.volumeMultiplier * diffMods.volumeScale, 2),
          pitchMin: 0.95,
          pitchMax: 1.05,
          spawnChance: template.spawnChance,
          cooldownSeconds: template.cooldownSeconds,
          zoneId,
        };
        roomEmitters.push(emitter);
      }
    }

    // Room type–based default ambient emitter (if no keyword matches)
    if (roomEmitters.length === 0) {
      const defaultEmitter = getDefaultEmitterForType(room.type, room.name, zoneId, room.x, room.y, diffMods.volumeScale);
      if (defaultEmitter) {
        roomEmitters.push(defaultEmitter);
      }
    }

    // Pacing overlay emitter
    const pacingOverlay = PACING_OVERLAYS[room.pacing];
    if (pacingOverlay) {
      roomEmitters.push({
        id: genEmitterId(),
        name: `${room.name} — ${pacingOverlay.extraEmitterName}`,
        type: pacingOverlay.type,
        x: room.x + baseWidth / 2,
        y: room.y + baseHeight / 2,
        soundCueRef: pacingOverlay.soundCueRef,
        attenuationRadius: Math.round(profile.attenuationBase * 0.6),
        volumeMultiplier: pacingOverlay.volumeMultiplier,
        pitchMin: 1.0,
        pitchMax: 1.0,
        spawnChance: 1,
        cooldownSeconds: 0,
        zoneId,
      });
    }

    emitters.push(...roomEmitters);

    // Build report entry
    const reasoning = buildReasoningText(room, profile, finalReverb, finalOcclusion, connCount, diffMods);
    report.push({
      roomId: room.id,
      roomName: room.name,
      roomType: room.type,
      zoneId,
      reverbPreset: finalReverb,
      occlusionMode: finalOcclusion,
      emitterCount: roomEmitters.length,
      emitterNames: roomEmitters.map((e) => e.name.split(' — ')[1] ?? e.name),
      reasoning,
    });
  }

  // Determine global reverb from the most common room type
  const typeCounts = new Map<RoomType, number>();
  for (const room of rooms) {
    typeCounts.set(room.type, (typeCounts.get(room.type) ?? 0) + 1);
  }
  const dominantType = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'exploration';
  const globalReverb = ROOM_ACOUSTICS[dominantType].reverb;

  return {
    zones,
    emitters,
    globalReverbPreset: globalReverb,
    soundPoolSize: Math.max(32, rooms.length * 4),
    maxConcurrentSounds: Math.max(16, rooms.length * 2),
    report,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSoundscapeDescription(room: RoomNode, profile: AcousticProfile, connCount: number): string {
  const parts: string[] = [profile.soundscapePrefix];

  if (room.description) {
    parts.push(room.description.slice(0, 100));
  }

  if (connCount >= 4) {
    parts.push('with echoing sounds from multiple passageways');
  } else if (connCount <= 1) {
    parts.push('enclosed with muffled outside sounds');
  }

  if (room.difficulty >= 4) {
    parts.push('with ominous, high-tension ambience');
  } else if (room.difficulty <= 2) {
    parts.push('with subtle background ambience');
  }

  if (room.encounterDesign) {
    const snippet = room.encounterDesign.slice(0, 80).replace(/\n/g, ' ');
    parts.push(`— ${snippet}`);
  }

  return parts.join(', ');
}

function getDefaultEmitterForType(
  type: RoomType,
  roomName: string,
  zoneId: string,
  x: number,
  y: number,
  volumeScale: number,
): SoundEmitter | null {
  const defaults: Partial<Record<RoomType, { name: string; cue: string; emitType: SoundEmitter['type'] }>> = {
    combat: { name: 'Combat Ambience', cue: '/Game/Audio/Ambience/SFX_Combat_Ambient', emitType: 'ambient' },
    boss: { name: 'Boss Arena Rumble', cue: '/Game/Audio/Ambience/SFX_Boss_Rumble', emitType: 'loop' },
    puzzle: { name: 'Puzzle Ambience', cue: '/Game/Audio/Ambience/SFX_Puzzle_Ambient', emitType: 'ambient' },
    exploration: { name: 'Exploration Ambience', cue: '/Game/Audio/Ambience/SFX_Explore_Ambient', emitType: 'ambient' },
    safe: { name: 'Safe Zone Ambience', cue: '/Game/Audio/Ambience/SFX_Safe_Ambient', emitType: 'ambient' },
    hub: { name: 'Hub Activity', cue: '/Game/Audio/Ambience/SFX_Hub_Activity', emitType: 'loop' },
  };

  const def = defaults[type];
  if (!def) return null;

  return {
    id: genEmitterId(),
    name: `${roomName} — ${def.name}`,
    type: def.emitType,
    x: x + 40,
    y: y + 40,
    soundCueRef: def.cue,
    attenuationRadius: 500,
    volumeMultiplier: Math.min(0.5 * volumeScale, 2),
    pitchMin: 0.98,
    pitchMax: 1.02,
    spawnChance: 1,
    cooldownSeconds: 0,
    zoneId,
  };
}

function buildReasoningText(
  room: RoomNode,
  profile: AcousticProfile,
  finalReverb: ReverbPreset,
  finalOcclusion: AudioZone['occlusionMode'],
  connCount: number,
  diffMods: ReturnType<typeof getDifficultyModifiers>,
): string {
  const parts: string[] = [];

  parts.push(`"${room.type}" room → ${profile.reverb} reverb`);

  if (finalReverb !== profile.reverb) {
    parts.push(`adjusted to ${finalReverb} (${connCount} connections = more open)`);
  }

  if (finalOcclusion !== profile.occlusionMode) {
    parts.push(`occlusion bumped to ${finalOcclusion} (difficulty ${room.difficulty}${connCount <= 1 ? ', dead-end' : ''})`);
  }

  if (diffMods.attenuationScale !== 1.0) {
    parts.push(`attenuation scaled ${diffMods.attenuationScale}x for difficulty ${room.difficulty}`);
  }

  return parts.join('; ');
}
