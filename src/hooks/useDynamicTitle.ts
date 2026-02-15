'use client';

import { useEffect, useRef } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

const BASE_TITLE = 'POF';
const DONE_DISPLAY_MS = 4000;

// Cache original favicon href so we can restore it
let originalFaviconHref: string | null = null;

function setFavicon(color: string | null) {
  const link: HTMLLinkElement =
    document.querySelector('link[rel="icon"]') ??
    (() => {
      const el = document.createElement('link');
      el.rel = 'icon';
      document.head.appendChild(el);
      return el;
    })();

  // Save original on first call
  if (originalFaviconHref === null) {
    originalFaviconHref = link.href || '';
  }

  if (!color) {
    // Restore original
    link.href = originalFaviconHref;
    return;
  }

  // Generate a 32x32 canvas favicon with a colored dot
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Dark background circle
  ctx.fillStyle = '#0a0a0f';
  ctx.beginPath();
  ctx.arc(16, 16, 16, 0, Math.PI * 2);
  ctx.fill();

  // Inner colored dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(16, 16, 8, 0, Math.PI * 2);
  ctx.fill();

  // Glow effect
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(16, 16, 5, 0, Math.PI * 2);
  ctx.fill();

  link.href = canvas.toDataURL('image/png');
}

export function useDynamicTitle() {
  const sessions = useCLIPanelStore((s) => s.sessions);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRunningRef = useRef(0);

  useEffect(() => {
    const sessionList = Object.values(sessions);
    const runningCount = sessionList.filter((s) => s.isRunning).length;
    const totalSessions = sessionList.length;
    const prevRunning = prevRunningRef.current;

    // Clear any pending "done" timer
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }

    if (runningCount > 0) {
      // Tasks are running
      document.title = runningCount === 1
        ? `(Running) ${BASE_TITLE}`
        : `(${runningCount} running) ${BASE_TITLE}`;
      setFavicon('#fbbf24'); // amber while running
    } else if (prevRunning > 0 && runningCount === 0) {
      // Just finished — show "Done" briefly
      document.title = `(Done) ${BASE_TITLE}`;
      setFavicon('#4ade80'); // green on complete

      doneTimerRef.current = setTimeout(() => {
        // Revert to session count or base
        if (totalSessions > 1) {
          document.title = `(${totalSessions} sessions) ${BASE_TITLE}`;
        } else {
          document.title = BASE_TITLE;
        }
        setFavicon(null);
        doneTimerRef.current = null;
      }, DONE_DISPLAY_MS);
    } else if (totalSessions > 1) {
      document.title = `(${totalSessions} sessions) ${BASE_TITLE}`;
      setFavicon(null);
    } else {
      document.title = BASE_TITLE;
      setFavicon(null);
    }

    prevRunningRef.current = runningCount;

    return () => {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
      }
    };
  }, [sessions]);
}
