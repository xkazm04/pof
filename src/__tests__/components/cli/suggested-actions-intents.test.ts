import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────
// resolveCallback is the only network leg of a callback; everything else in
// cli-task (marker parsing, CLITaskType) stays real.
const resolveCallback = vi.fn();
vi.mock('@/lib/cli-task', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cli-task')>()),
  resolveCallback: (...a: unknown[]) => resolveCallback(...a),
}));

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

vi.mock('@/components/cli/taskRegistry', () => ({
  registerTaskStart: vi.fn(() => Promise.resolve({ success: true })),
  registerTaskComplete: vi.fn(() => Promise.resolve(undefined)),
  sendTaskHeartbeat: vi.fn(() => Promise.resolve(true)),
  getTaskStatus: vi.fn(() => Promise.resolve({ found: true, status: 'running', isStale: false })),
  clearSessionTasks: vi.fn(() => Promise.resolve(0)),
  attachTaskExecution: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/components/cli/skills', () => ({
  injectSkillsIntoPrompt: ({ basePrompt }: { basePrompt: string }) => ({ prompt: basePrompt }),
}));

import { generateSuggestions } from '@/components/cli/SuggestedActions';
import { useCLIPanelStore, type CLISessionState } from '@/components/cli/store/cliPanelStore';
import { useTaskQueue } from '@/components/cli/useTaskQueue';
import { MODULE_COLORS } from '@/lib/chart-colors';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A settled (not running) session with the given run facts layered on. */
function mk(facts: Record<string, unknown>): CLISessionState {
  return {
    id: 'tab-1',
    label: 'Combat CLI',
    projectPath: null,
    claudeSessionId: null,
    currentExecutionId: null,
    currentTaskId: null,
    isRunning: false,
    lastTaskSuccess: null,
    lastCallbackStatus: null,
    accentColor: MODULE_COLORS.core,
    createdAt: 0,
    lastActivityAt: 0,
    enabledSkills: [],
    ...facts,
  } as unknown as CLISessionState;
}

/** Every prompt string any suggestion action would send to Claude. */
function actionPrompts(session: CLISessionState): string[] {
  return generateSuggestions(session)
    .map((s) => (s.action as { prompt?: unknown }).prompt)
    .filter((p): p is string => typeof p === 'string');
}

const CLI_TASK_TYPES = [
  'checklist', 'quick-action', 'ask-claude', 'feature-fix', 'feature-review', 'module-scan',
  'wbp-starter', 'procgen-dungeon', 'biome-scatter', 'level-sync', 'mixamo-import',
  'character-setup', 'audio-import', 'generate', 'evaluate-track', 'draft-ability-spec',
  'generate-gas-effects', 'run-ai-tests', 'detect-stimuli', 'material-configurator',
] as const;

// ── generateSuggestions: suggestions derived from recorded run facts ────────

describe('generateSuggestions — acts on the run facts, never on sentinels', () => {
  it('a success whose @@CALLBACK never arrived offers collect-callback first, and no next-item', () => {
    const s = generateSuggestions(mk({
      lastTaskSuccess: true,
      lastTaskType: 'checklist',
      lastCallbackStatus: 'missing',
      moduleId: 'arpg-combat',
      sessionKey: 'arpg-combat-cli',
      lastDispatch: { prompt: 'Build the dodge roll.\n\n## Submission\n@@CALLBACK:cb-1\n{ "completed": true }\n@@END_CALLBACK', taskType: 'checklist' },
    }));
    expect(s[0]?.id).toBe('collect-callback');
    expect(s[0]?.action.type).toBe('resume');
    expect((s[0]?.action as { prompt: string }).prompt).toContain('@@CALLBACK:cb-1');
    expect(s.some((x) => x.id === 'next-item')).toBe(false);
  });

  it('retry re-dispatches the exact last prompt with its task type on a fresh session', () => {
    const s = generateSuggestions(mk({
      lastTaskSuccess: false,
      lastTaskType: 'feature-fix',
      moduleId: 'arpg-combat',
      lastDispatch: { prompt: 'P', taskType: 'feature-fix' },
    }));
    const retry = s.find((x) => x.id === 'retry');
    expect(retry?.action).toEqual({ type: 'redispatch', prompt: 'P', taskType: 'feature-fix', resume: false });
  });

  it('no action for any task type x outcome x callback status sends a "__" sentinel prompt', () => {
    const offenders: string[] = [];
    for (const taskType of CLI_TASK_TYPES) {
      for (const success of [true, false]) {
        for (const cb of ['confirmed', 'failed', 'missing', null] as const) {
          for (const withDispatch of [true, false]) {
            const session = mk({
              lastTaskSuccess: success,
              lastTaskType: taskType,
              lastCallbackStatus: cb,
              moduleId: 'arpg-combat',
              sessionKey: `arpg-combat-${taskType}`,
              lastDispatch: withDispatch ? { prompt: 'do it @@CALLBACK:cb-9', taskType } : undefined,
              pendingCallbacks: cb === 'failed' ? [{ callbackId: 'cb-9', payload: '{}' }] : [],
            });
            for (const p of actionPrompts(session)) {
              if (p.startsWith('__')) offenders.push(`${taskType}/${success}/${cb}/${withDispatch}: ${p}`);
            }
          }
        }
      }
    }
    // The four legacy sentinel sites emitted '__retry' / '__review:<id>' on these paths.
    expect(offenders).toEqual([]);
  });

  it('the review suggestion targets session.moduleId and reads the task type from lastTaskType, not the sessionKey suffix', () => {
    const s = generateSuggestions(mk({
      sessionKey: 'arpg-combat-rv-cli',
      moduleId: 'arpg-combat',
      lastTaskType: 'feature-fix',
      lastTaskSuccess: true,
      lastCallbackStatus: 'confirmed',
    }));
    // feature-fix success → re-review (the '-cli' suffix would have said 'checklist' → next-item).
    expect(s.some((x) => x.id === 'next-item')).toBe(false);
    const review = s.find((x) => x.id === 're-review');
    expect(review?.action).toEqual({ type: 'navigate', tab: 'overview', moduleId: 'arpg-combat' });
  });

  it('[guard] no completed run → no suggestions', () => {
    expect(generateSuggestions(mk({ lastTaskSuccess: null, lastTaskType: 'checklist', moduleId: 'arpg-combat' }))).toEqual([]);
  });
});

// ── useTaskQueue: a failed callback payload is retained, not thrown away ────

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  close() { /* noop */ }
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

describe('useTaskQueue — unresolved callbacks surface to the host', () => {
  const realES = globalThis.EventSource;
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    apiFetch.mockResolvedValue({ executionId: 'exec-1', streamUrl: '/stream?executionId=exec-1', logFilePath: null, model: null, effort: null });
  });
  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { EventSource: unknown }).EventSource = realES;
    apiFetch.mockReset();
    resolveCallback.mockReset();
  });

  it('a result whose @@CALLBACK POST fails reports [{callbackId, payload}] once via onCallbacksUnresolved', async () => {
    resolveCallback.mockResolvedValue({ success: false, error: 'HTTP 500' });
    const onCallbacksUnresolved = vi.fn();
    const onTaskComplete = vi.fn();
    const { result } = renderHook(() => useTaskQueue({
      instanceId: 'inst-cb', projectPath: '/proj', taskQueue: [], autoStart: false, enabledSkills: [],
      onTaskComplete, onCallbacksUnresolved,
    } as Parameters<typeof useTaskQueue>[0]));

    await act(async () => { await result.current.submitPrompt('P', false, { taskType: 'checklist' }); });
    const es = FakeEventSource.instances.at(-1)!;
    await act(async () => {
      es.emit({ type: 'message', data: { type: 'assistant', content: 'done\n@@CALLBACK:cb-1\n{"completed":true}\n@@END_CALLBACK\n' }, timestamp: 1 });
      es.emit({ type: 'result', data: { isError: false, sessionId: 's1' }, timestamp: 2 });
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(onCallbacksUnresolved).toHaveBeenCalledTimes(1);
    expect(onCallbacksUnresolved).toHaveBeenCalledWith([{ callbackId: 'cb-1', payload: '{"completed":true}' }]);
    expect(onTaskComplete).toHaveBeenCalledWith('interactive', true, { callbackStatus: 'failed' });
  });
});

// ── resubmitPendingCallbacks: token-free recovery through the store ─────────

const loadIntents = () => import('@/components/cli/suggestionIntents');

describe('resubmitPendingCallbacks — re-POSTs retained payloads without a new run', () => {
  const failedRun = () => mk({
    id: 'tab-rs',
    lastTaskSuccess: true,
    lastTaskType: 'checklist',
    lastCallbackStatus: 'failed',
    moduleId: 'arpg-combat',
    runSeq: 3,
    runPhase: 'idle',
    lastDispatch: { prompt: 'x @@CALLBACK:cb-1', taskType: 'checklist' },
    pendingCallbacks: [{ callbackId: 'cb-1', payload: '{"completed":true}' }],
  });

  beforeEach(() => {
    useCLIPanelStore.setState({ sessions: { 'tab-rs': failedRun() }, tabOrder: ['tab-rs'], activeTabId: 'tab-rs', maximizedTabId: null });
  });
  afterEach(() => { resolveCallback.mockReset(); });

  it('a successful re-POST confirms the run, drops the pending payloads and the resubmit suggestion', async () => {
    const { resubmitPendingCallbacks } = await loadIntents();
    expect(generateSuggestions(useCLIPanelStore.getState().sessions['tab-rs']).some((x) => x.id === 'resubmit-callback')).toBe(true);
    resolveCallback.mockResolvedValue({ success: true, data: {} });

    await resubmitPendingCallbacks('tab-rs');

    const sess = useCLIPanelStore.getState().sessions['tab-rs'] as CLISessionState & { pendingCallbacks?: unknown };
    expect(resolveCallback).toHaveBeenCalledWith('cb-1', '{"completed":true}');
    expect(sess.lastCallbackStatus).toBe('confirmed');
    expect(sess.pendingCallbacks).toEqual([]);
    expect(generateSuggestions(sess).some((x) => x.id === 'resubmit-callback')).toBe(false);
  });

  it('a failing re-POST keeps the status failed and the payloads for another try', async () => {
    const { resubmitPendingCallbacks } = await loadIntents();
    resolveCallback.mockResolvedValue({ success: false, error: 'HTTP 500' });

    await resubmitPendingCallbacks('tab-rs');

    const sess = useCLIPanelStore.getState().sessions['tab-rs'] as CLISessionState & { pendingCallbacks?: unknown };
    expect(sess.lastCallbackStatus).toBe('failed');
    expect(sess.pendingCallbacks).toEqual([{ callbackId: 'cb-1', payload: '{"completed":true}' }]);
  });

  it('[guard] nothing new reaches localStorage — partialize strips lastDispatch and pendingCallbacks', () => {
    const partialize = useCLIPanelStore.persist.getOptions().partialize!;
    const persisted = JSON.stringify(partialize(useCLIPanelStore.getState()));
    expect(persisted).toContain('tab-rs');
    expect(persisted).not.toContain('lastDispatch');
    expect(persisted).not.toContain('pendingCallbacks');
  });
});
