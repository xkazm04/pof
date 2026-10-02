'use client';

import { resolveCallback } from '@/lib/cli-task';
import { logger } from '@/lib/logger';
import { useCLIPanelStore, type CLISessionState, type PendingCallback } from '@/components/cli/store/cliPanelStore';

/**
 * Post-run suggestion intents for the inline terminal's "Suggested" bar.
 *
 * Every suggestion is derived from facts the session recorded about its LAST run
 * (lastTaskType, lastTaskSuccess, lastCallbackStatus, moduleId, lastDispatch,
 * pendingCallbacks) — never from the sessionKey spelling, and never a sentinel
 * prompt: each action is something the host can execute truthfully.
 */

export type SuggestionIcon = 'retry' | 'next' | 'play' | 'callback';

export type SuggestionAction =
  /** Send `prompt` to this terminal again (resume=false → a fresh Claude session). */
  | { type: 'redispatch'; prompt: string; taskType?: string; resume: boolean }
  /** Continue the same Claude session with `prompt`. */
  | { type: 'resume'; prompt: string; taskType?: string }
  /** Re-POST the retained callback payloads — no new run, no tokens. */
  | { type: 'resubmit-callback' }
  /** Switch the owning module's view to `tab` (no moduleId → the session's own module). */
  | { type: 'navigate'; tab: string; moduleId?: string };

/**
 * Where a navigate suggestion lands: the action's module, else the module the
 * session belongs to. Never untargeted — no module anywhere → null (no jump).
 */
export function tabJumpTarget(
  action: { type: 'navigate'; tab: string; moduleId?: string },
  sessionModuleId: string | undefined,
): { moduleId: string; tab: string } | null {
  const moduleId = action.moduleId ?? sessionModuleId;
  return moduleId ? { moduleId, tab: action.tab } : null;
}

export interface Suggestion {
  id: string;
  label: string;
  description: string;
  icon: SuggestionIcon;
  action: SuggestionAction;
}

type TaskFamily = 'checklist' | 'review' | 'fix' | 'other';

function taskFamily(taskType: string | undefined): TaskFamily {
  switch (taskType) {
    case 'checklist': return 'checklist';
    case 'feature-review':
    case 'module-scan': return 'review';
    case 'feature-fix': return 'fix';
    default: return 'other';
  }
}

/** Callback ids a dispatched prompt asked Claude to submit (its `@@CALLBACK:<id>` markers). */
export function callbackIdsIn(prompt: string | undefined): string[] {
  if (!prompt) return [];
  const ids = new Set<string>();
  for (const m of prompt.matchAll(/@@CALLBACK:(\S+)/g)) ids.add(m[1]);
  return [...ids];
}

const COLLECT_HEAD = 'Your previous run finished without submitting its structured result.';

/** The resume prompt that asks Claude to emit only the missing callback block(s). */
export function buildCollectCallbackPrompt(callbackIds: string[]): string {
  const markers = callbackIds.map((id) => `@@CALLBACK:${id}`).join(', ');
  return [
    COLLECT_HEAD,
    'Do NOT redo the work. Using the results you already produced, output ONLY the required submission',
    `block(s) now — ${markers} — each followed by its JSON body and a closing @@END_CALLBACK line,`,
    'exactly as the Submission section of the original task specified.',
  ].join('\n');
}

function isCollectPrompt(prompt: string): boolean {
  return prompt.startsWith(COLLECT_HEAD);
}

function reviewSuggestion(id: string, label: string, description: string, moduleId: string | undefined): Suggestion | null {
  if (!moduleId) return null;
  return { id, label, description, icon: 'retry', action: { type: 'navigate', tab: 'overview', moduleId } };
}

function successSuggestions(family: TaskFamily, moduleId: string | undefined): (Suggestion | null)[] {
  switch (family) {
    case 'checklist':
      return [
        { id: 'next-item', label: 'Run next checklist item', description: 'Continue with the next incomplete item', icon: 'next', action: { type: 'navigate', tab: 'roadmap' } },
        reviewSuggestion('review-module', 'Open feature review', 'Check every feature’s implementation status', moduleId),
      ];
    case 'review':
      return [
        { id: 'fix-missing', label: 'Fix first missing feature', description: 'Address the top-priority missing item', icon: 'play', action: { type: 'navigate', tab: 'overview' } },
        { id: 'start-checklist', label: 'Start roadmap checklist', description: 'Work through implementation tasks in order', icon: 'next', action: { type: 'navigate', tab: 'roadmap' } },
      ];
    case 'fix':
      return [reviewSuggestion('re-review', 'Verify in feature review', 'Confirm the fix improved feature status, then pick the next issue', moduleId)];
    default:
      return [reviewSuggestion('review-module', 'Open feature review', 'Check features for updated status', moduleId)];
  }
}

/** Derive the post-run suggestions for a session. Pure; [] until a run completed. */
export function generateSuggestions(session: CLISessionState): Suggestion[] {
  const { lastTaskSuccess, moduleId, lastDispatch } = session;
  if (lastTaskSuccess === null) return [];

  const family = taskFamily(session.lastTaskType);
  const cbStatus = session.lastCallbackStatus ?? null;
  const pending = session.pendingCallbacks ?? [];
  const expectedIds = callbackIdsIn(lastDispatch?.prompt);
  const out: (Suggestion | null)[] = [];

  // A result Claude DID emit but whose POST failed: recover it without a new run.
  if (pending.length > 0 && cbStatus !== 'confirmed') {
    out.push({
      id: 'resubmit-callback',
      label: 'Resubmit result',
      description: `Re-send the ${pending.length === 1 ? 'unsubmitted result' : `${pending.length} unsubmitted results`} — no new run`,
      icon: 'callback',
      action: { type: 'resubmit-callback' },
    });
  }

  if (lastTaskSuccess) {
    const missing = cbStatus === 'missing' && expectedIds.length > 0;
    if (missing) {
      // The run "finished" but never reported: it is not done. Ask the same session for the result.
      out.push({
        id: 'collect-callback',
        label: 'Collect missing result',
        description: 'The run ended without its structured result — ask Claude to submit it (not recorded yet)',
        icon: 'callback',
        action: { type: 'resume', prompt: buildCollectCallbackPrompt(expectedIds), taskType: lastDispatch?.taskType },
      });
    } else if (cbStatus !== 'failed') {
      out.push(...successSuggestions(family, moduleId));
    }
  } else {
    if (lastDispatch) {
      // A collect run only makes sense inside its session; everything else replays fresh.
      const action: SuggestionAction = isCollectPrompt(lastDispatch.prompt)
        ? { type: 'resume', prompt: lastDispatch.prompt, taskType: lastDispatch.taskType }
        : { type: 'redispatch', prompt: lastDispatch.prompt, taskType: lastDispatch.taskType, resume: false };
      out.push({ id: 'retry', label: 'Retry task', description: 'Send the same prompt again', icon: 'retry', action });
    }
    if (family === 'checklist' || family === 'fix') {
      out.push({
        id: 'skip-next',
        label: 'Skip to next item',
        description: 'Move on and come back to this later',
        icon: 'next',
        action: { type: 'navigate', tab: family === 'checklist' ? 'roadmap' : 'overview' },
      });
    }
  }

  return out.filter((s): s is Suggestion => s !== null).slice(0, 3);
}

/** Sessions with a resubmit in flight — a double-click must not double-POST. */
const resubmitting = new Set<string>();

/**
 * Re-POST the session's retained callback payloads (see useTaskQueue
 * onCallbacksUnresolved). No Claude run is started. The outcome is recorded on the
 * session through the store — 'confirmed' when every payload landed, otherwise
 * 'failed' with the still-unresolved payloads kept for another try. Note a payload
 * the server REJECTED on validation will fail identically; this recovers transport
 * and transient server failures. Returns the recorded status, or null if nothing ran.
 */
export async function resubmitPendingCallbacks(sessionId: string): Promise<'confirmed' | 'failed' | null> {
  const session = useCLIPanelStore.getState().sessions[sessionId];
  const pending = session?.pendingCallbacks ?? [];
  if (!session || session.isRunning || pending.length === 0 || resubmitting.has(sessionId)) return null;
  resubmitting.add(sessionId);
  try {
    const results = await Promise.all(
      pending.map(async (p) => ({ p, res: await resolveCallback(p.callbackId, p.payload) })),
    );
    const remaining: PendingCallback[] = [];
    for (const { p, res } of results) {
      if (res.success) continue;
      remaining.push(p);
      logger.warn(`[cli] callback resubmit failed (${p.callbackId}): ${res.error ?? 'unknown error'}`);
    }
    useCLIPanelStore.getState().recordCallbackResubmit(sessionId, session.runSeq ?? 0, remaining);
    return remaining.length === 0 ? 'confirmed' : 'failed';
  } finally {
    resubmitting.delete(sessionId);
  }
}
