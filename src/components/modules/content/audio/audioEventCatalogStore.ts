import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AudioEvent } from './AudioEventCatalog';

interface AudioEventCatalogState {
  /** null = the user has never edited the catalog; the component seeds defaults. */
  events: AudioEvent[] | null;
  setEvents: (events: AudioEvent[]) => void;
}

/**
 * Persisted home for the curated event catalog. It used to live in
 * AudioEventCatalog's local useState while AudioView mounts the tab panels
 * conditionally — a routine Painter ↔ Catalog tab switch unmounted the
 * component and silently wiped every custom event, trigger, priority, and
 * tag the user had curated. Persisting also survives reloads.
 */
export const useAudioEventCatalogStore = create<AudioEventCatalogState>()(
  persist(
    (set) => ({
      events: null,
      setEvents: (events) => set({ events }),
    }),
    { name: 'pof-audio-event-catalog', storage: createJSONStorage(() => localStorage) },
  ),
);
