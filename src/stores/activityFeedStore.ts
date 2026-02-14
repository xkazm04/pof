'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── Activity event types ──

export type ActivityEventType =
  | 'cli-complete'
  | 'cli-error'
  | 'quality-change'
  | 'build-result'
  | 'evaluator-recommendation'
  | 'checklist-progress';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: number;
  title: string;
  description: string;
  moduleId?: string;
  /** Whether the user has dismissed/read this event */
  dismissed: boolean;
  /** Optional metadata for rendering */
  meta?: {
    success?: boolean;
    score?: number;
    prevScore?: number;
    priority?: string;
    prompt?: string;
  };
}

interface ActivityFeedState {
  events: ActivityEvent[];
  /** Whether the feed panel is open */
  isOpen: boolean;

  addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp' | 'dismissed'>) => void;
  dismissEvent: (id: string) => void;
  dismissAll: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

let _eventCounter = 0;

export const useActivityFeedStore = create<ActivityFeedState>()(
  persist(
    (set) => ({
      events: [],
      isOpen: false,

      addEvent: (event) =>
        set((state) => ({
          events: [
            {
              ...event,
              id: `evt-${Date.now()}-${_eventCounter++}`,
              timestamp: Date.now(),
              dismissed: false,
            },
            ...state.events,
          ].slice(0, 50), // Keep last 50 events
        })),

      dismissEvent: (id) =>
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, dismissed: true } : e,
          ),
        })),

      dismissAll: () =>
        set((state) => ({
          events: state.events.map((e) => ({ ...e, dismissed: true })),
        })),

      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
    }),
    {
      name: 'pof-activity-feed',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        events: state.events.slice(0, 30), // Persist fewer to keep storage small
      }),
    },
  ),
);
