'use client';

import { useEffect, useRef } from 'react';
import { useCLIPanelStore, type CLISessionState } from '@/components/cli/store/cliPanelStore';
import type { ActivitySummary } from '@/components/layout-lab/activityModel';
import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import {
  fromCliSessions,
  fromLabActivity,
  initialTabAttention,
  reduceTabAttention,
  type TabSignal,
  type TabTone,
} from '@/lib/shell/tabAttention';

const LEGACY_BASE_TITLE = 'POF';
const NO_SESSIONS: Record<string, CLISessionState> = {};

const TONE_COLOR: Record<TabTone, string | null> = {
  none: null,
  running: STATUS_WARNING,
  attention: STATUS_WARNING,
  success: STATUS_SUCCESS,
  error: STATUS_ERROR,
};

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
    link.href = originalFaviconHref;
    return;
  }

  // A 32x32 canvas favicon: a coloured dot with a soft glow.
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(16, 16, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(16, 16, 5, 0, Math.PI * 2);
  ctx.fill();

  link.href = canvas.toDataURL('image/png');
}

const isVisible = () => document.visibilityState !== 'hidden';

/** Owns document.title + favicon for one mount: reduces signals, repaints only on tone change. */
function createTitleController(base: string) {
  let state = initialTabAttention(base);
  let painted: TabTone = 'none';
  let last: TabSignal = { running: 0, ended: [], rest: null };
  let timer: ReturnType<typeof setTimeout> | null = null;

  const apply = (signal: TabSignal) => {
    last = { ...signal, ended: [] };
    if (timer) { clearTimeout(timer); timer = null; }
    state = reduceTabAttention(state, signal, isVisible(), Date.now());
    if (document.title !== state.title) document.title = state.title;
    if (state.tone !== painted) {
      painted = state.tone;
      setFavicon(TONE_COLOR[painted]);
    }
    if (state.expiresAt !== null) {
      timer = setTimeout(() => apply(last), Math.max(0, state.expiresAt - Date.now()));
    }
  };
  const onVisibility = () => apply(last);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    apply,
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) clearTimeout(timer);
      if (document.title !== base) document.title = base;
      if (painted !== 'none') setFavicon(null);
    },
  };
}

/**
 * Tab title + favicon for running work (see `src/lib/shell/tabAttention.ts`).
 * - `useDynamicTitle()` — legacy shell: CLI sessions from cliPanelStore, base title 'POF'.
 * - `useDynamicTitle(summary)` — lab shell: the ActivityChip's summary, base = the document's
 *   own title at mount (left untouched while nothing runs or ends).
 */
export function useDynamicTitle(labSummary?: ActivitySummary) {
  const isLab = labSummary !== undefined;
  const sessions = useCLIPanelStore((s) => (isLab ? NO_SESSIONS : s.sessions));
  const controllerRef = useRef<ReturnType<typeof createTitleController> | null>(null);
  const prevRef = useRef<Record<string, CLISessionState> | ActivitySummary | null>(null);

  useEffect(() => {
    const ctl = createTitleController(isLab ? document.title : LEGACY_BASE_TITLE);
    controllerRef.current = ctl;
    return () => {
      ctl.dispose();
      controllerRef.current = null;
    };
  }, [isLab]);

  useEffect(() => {
    const prev = prevRef.current;
    if (labSummary) {
      prevRef.current = labSummary;
      controllerRef.current?.apply(fromLabActivity(prev as ActivitySummary | null, labSummary));
    } else {
      prevRef.current = sessions;
      controllerRef.current?.apply(fromCliSessions(prev as Record<string, CLISessionState> | null, sessions));
    }
  }, [labSummary, sessions]);
}
