'use client';

import { useEffect, useRef } from 'react';
import { useCLIPanelStore } from './cliPanelStore';

/**
 * Recovery hook for CLI panel.
 * On mount, checks for sessions that were running before a refresh
 * and marks them as needing attention.
 */
export function useCLIRecovery(): void {
  const hasRecovered = useRef(false);
  const sessions = useCLIPanelStore((s) => s.sessions);
  const setSessionRunning = useCLIPanelStore((s) => s.setSessionRunning);

  useEffect(() => {
    if (hasRecovered.current) return;
    hasRecovered.current = true;

    // Mark any sessions that claim to be running as not running
    // (since the actual CLI process wouldn't survive a page refresh)
    for (const [id, session] of Object.entries(sessions)) {
      if (session.isRunning) {
        setSessionRunning(id, false);
      }
    }
  }, [sessions, setSessionRunning]);
}
