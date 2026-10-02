import type { AudioSceneDocument } from '@/types/audio-scene';

/**
 * The ONE UE audio runtime vocabulary every audio generator writes against.
 *
 * Four generators put C++ into the same `Source/<Module>/Audio/` folder: the
 * deterministic codegen (`audio-codegen.ts`), and the scene, zone/soundscape and
 * event-catalog CLI prompts (`prompts/audio-scene.ts`, `prompts/audio-events.ts`).
 * They used to name the same concepts twice and ask for up to three pool-owning
 * UGameInstanceSubsystems. This module names each class once, and the class
 * names are the ones the codegen ALREADY emits — the codegen is not edited to
 * import this; `audio-runtime-contract.test.ts` parses its output against these
 * entries as the drift guard.
 *
 * Budget law: UAudioSceneManager owns the sound pool size and the voice limit
 * (the scene's `soundPoolSize` / `maxConcurrentSounds`). Event playback — the
 * pool, priority queue, per-event concurrency and cooldowns — runs in
 * UAudioEventRouter, a plain UObject whose Outer is the manager. The manager's
 * files are codegen output and are regenerated, so no prompt asks the CLI to
 * edit them.
 */

export interface AudioRuntimeClass {
  className: string;
  header: string;
  base: string;
  role: string;
  /** True when `generateAudioCode` emits this class (the CLI must not edit it). */
  generated: boolean;
}

export const AUDIO_RUNTIME = {
  manager: {
    className: 'UAudioSceneManager', header: 'AudioSceneManager.h', base: 'UGameInstanceSubsystem', generated: true,
    role: 'the ONE audio subsystem and owner of the sound pool and the priority queue budget',
  },
  reverbPresets: {
    className: 'UAudioReverbPresets', header: 'AudioReverbPresets.h', base: 'UDataAsset', generated: true,
    role: 'named reverb presets (the scene\'s zone presets)',
  },
  attenuation: {
    className: 'UAudioZoneAttenuation', header: 'AudioZoneAttenuation.h', base: 'UDataAsset', generated: true,
    role: 'per-zone attenuation settings',
  },
  zoneVolume: {
    className: 'ASceneAudioVolume', header: 'SceneAudioVolume.h', base: 'AAudioVolume', generated: true,
    role: 'one audio volume per zone: reverb, priority, occlusion',
  },
  emitterSpawner: {
    className: 'ASceneEmitterSpawner', header: 'SceneEmitterSpawner.h', base: 'AActor', generated: true,
    role: 'spawns the scene emitters (cue, pitch/volume randomisation, spawn chance, cooldown)',
  },
  ambientLayer: {
    className: 'UProceduralAmbientManager', header: 'ProceduralAmbientLayer.h', base: 'UActorComponent', generated: true,
    role: 'MetaSound ambient layers per zone (FAmbientLayerConfig) with crossfades',
  },
  eventRouter: {
    className: 'UAudioEventRouter', header: 'AudioEventRouter.h', base: 'UObject', generated: false,
    role: 'event playback: PlayEvent, pool, priority queue, per-event concurrency and cooldowns',
  },
} as const satisfies Record<string, AudioRuntimeClass>;

/** The classes the deterministic codegen emits — the files the CLI must never edit. */
export const GENERATED_AUDIO_CLASSES: readonly AudioRuntimeClass[] =
  Object.values(AUDIO_RUNTIME).filter((c) => c.generated);

export type AudioSceneBudget = Pick<AudioSceneDocument, 'soundPoolSize' | 'maxConcurrentSounds'>;

export interface EventBudget {
  /** Sum of every event's max concurrent instances. */
  declaredVoices: number;
  limit: number;
  /** Voices the catalog can demand beyond the scene limit (0 when it fits). */
  overBy: number;
}

/** Sum of every event's max concurrent instances — the voices the catalog can demand at once. */
export function declaredVoices(events: readonly { concurrency: number }[]): number {
  return events.reduce((sum, e) => sum + Math.max(0, e.concurrency), 0);
}

/** Reconcile the catalog's declared voices against the scene's global voice limit. */
export function eventBudget(
  events: readonly { concurrency: number }[],
  scene: Pick<AudioSceneBudget, 'maxConcurrentSounds'>,
): EventBudget {
  const voices = declaredVoices(events);
  const limit = scene.maxConcurrentSounds;
  return { declaredVoices: voices, limit, overBy: Math.max(0, voices - limit) };
}

/** The one-line reconciliation the event prompt carries. */
export function eventBudgetLine(budget: EventBudget): string {
  return budget.overBy > 0
    ? `${budget.declaredVoices} declared voices exceed the scene limit of ${budget.limit} (by ${budget.overBy}), so priority decides which voice is stolen when the limit binds.`
    : `${budget.declaredVoices} declared voices fit within the scene limit of ${budget.limit}; priority still orders the queue.`;
}

function budgetText(scene: AudioSceneBudget | null | undefined): string {
  return scene
    ? `sound pool of ${scene.soundPoolSize} and voice limit of ${scene.maxConcurrentSounds}`
    : 'sound pool and voice limit read at runtime';
}

/**
 * The shared prompt section: which classes exist, which are generated, who owns
 * the budget. Every audio prompt builder includes it verbatim.
 */
export function runtimeContractBlock(scene: AudioSceneBudget | null | undefined, moduleName: string): string {
  const m = AUDIO_RUNTIME.manager;
  const r = AUDIO_RUNTIME.eventRouter;
  const generated = GENERATED_AUDIO_CLASSES.filter((c) => c !== m)
    .map((c) => `- **${c.className}** : ${c.base} (${c.header}) — ${c.role}`)
    .join('\n');
  return `### Audio Runtime Contract (one manager, one budget)
All audio classes live in Source/${moduleName}/Audio/ under exactly these names. Never create a parallel class for the same concept under another name.
- **${m.className}** (UGameInstanceSubsystem, ${m.header}) — ${m.role}: ${budgetText(scene)} (GetSoundPoolSize() / GetMaxConcurrentSounds()).
${generated}
- **${r.className}** (UObject, not a subsystem; ${r.header}) — ${r.role}. Its Outer is the ${m.className}; it sizes its pool from GetSoundPoolSize() and caps active voices at GetMaxConcurrentSounds().

Rules:
- ${m.header} / AudioSceneManager.cpp and the headers listed above are generated by PoF's Audio Scene codegen ("Auto-generated from POF Audio Scene Editor") — do not edit them where they exist; build on their public API.
- ${m.className} is the ONLY UGameInstanceSubsystem for audio. Never add another subsystem, manager or component that owns a sound pool or its own voice limit.`;
}
