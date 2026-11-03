'use client';

import { useEffect, useRef } from 'react';

/**
 * One take audible at a time (registry `voice-io` / `media-playback`: exclusivity is claimed at request
 * time). A capture-phase `play` listener on the room pauses every other <audio> inside it; media events do
 * not bubble, so a React `onPlay` on the container would never see them.
 */
export function useExclusivePlayback<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onPlay = (e: Event) => {
      for (const a of root.querySelectorAll('audio')) if (a !== e.target && !a.paused) a.pause();
    };
    root.addEventListener('play', onPlay, true);
    return () => root.removeEventListener('play', onPlay, true);
  }, []);
  return ref;
}
