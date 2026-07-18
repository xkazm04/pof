import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AudioEvent } from './AudioEventCatalog';

interface AudioEventCatalogState {
  /**
   * Per-scene catalogs, keyed by the audio scene (doc) id. Each scene owns its
   * own event catalog — editing events under one scene no longer mutates the
   * catalog shown under every other scene.
   */
  byScene: Record<string, AudioEvent[]>;
  /**
   * Legacy pre-scoping global catalog. Before the catalog was scene-scoped it
   * lived here as a single shared list. Retained (via the persist migration
   * below) so a scene that has never been edited under the new model still
   * shows the user's previously-curated events on first view — existing data
   * is never wiped, it is attributed to whichever scene first opens the tab.
   */
  legacyEvents: AudioEvent[] | null;
  /**
   * The curated catalog for a scene, or null when the scene has none yet (the
   * component then seeds defaults). Falls back to the legacy global catalog so
   * pre-scoping curation carries forward.
   */
  getEvents: (sceneId: string) => AudioEvent[] | null;
  setEvents: (sceneId: string, events: AudioEvent[]) => void;
}

/**
 * Persisted home for the curated event catalog, scoped per audio scene.
 *
 * Previously a single global list: AudioView mounts tab panels conditionally,
 * so local-only state was wiped on every Painter ↔ Catalog tab switch, and the
 * later "fix" (one global persisted list) meant editing events under one scene
 * silently corrupted every other scene's catalog. Keying by scene id gives each
 * scene an independent, reload-surviving catalog.
 */
export const useAudioEventCatalogStore = create<AudioEventCatalogState>()(
  persist(
    (set, get) => ({
      byScene: {},
      legacyEvents: null,
      getEvents: (sceneId) => {
        const own = get().byScene[sceneId];
        if (own) return own;
        // First read of an un-scoped scene: inherit the pre-scoping global
        // catalog so existing curation is preserved rather than discarded.
        return get().legacyEvents;
      },
      setEvents: (sceneId, events) =>
        set((s) => ({ byScene: { ...s.byScene, [sceneId]: events } })),
    }),
    {
      name: 'pof-audio-event-catalog',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted, version) => {
        // v0 shape: { events: AudioEvent[] | null } — a single global catalog.
        // Preserve it as legacyEvents so each scene inherits it on first view.
        if (version === 0 && persisted && typeof persisted === 'object') {
          const old = persisted as { events?: AudioEvent[] | null };
          return { byScene: {}, legacyEvents: old.events ?? null } as Partial<AudioEventCatalogState>;
        }
        return persisted as Partial<AudioEventCatalogState>;
      },
    },
  ),
);
