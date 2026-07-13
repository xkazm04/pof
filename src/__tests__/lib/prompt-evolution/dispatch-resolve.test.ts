import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveActivePrompt,
  composeTaskDispatch,
  variantKeyForTask,
  STATIC_VARIANT_ID,
} from '@/lib/prompt-evolution/dispatch-resolve';
import { TaskFactory } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { PromptVariant } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.7.2',
};
const ORIGIN = 'http://localhost:3000';
const MOD = 'arpg-combat' as SubModuleId;

function mockApi(value: PromptVariant | null, opts: { fail?: boolean } = {}) {
  return vi.fn(async () => {
    if (opts.fail) throw new Error('network down');
    return {
      json: async () => ({ success: true, data: value }),
    } as unknown as Response;
  });
}

const VARIANT: PromptVariant = {
  id: 'var-abc',
  moduleId: MOD,
  checklistItemId: 'combat-hit-detect',
  label: 'user-edit variant (imperative)',
  prompt: 'You MUST implement melee hit detection with a TSet dedup — adopted variant.',
  origin: 'user-edit',
  style: 'imperative',
  parentId: null,
  active: true,
  createdAt: '2026-07-01T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('variantKeyForTask', () => {
  it('keys a checklist task by (module, itemId)', () => {
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static prompt.', 'Combat', ORIGIN);
    expect(variantKeyForTask(task)).toEqual({ moduleId: MOD, checklistItemId: 'combat-hit-detect' });
  });

  it('returns null for a quick-action task (no per-item prompt key → always static)', () => {
    const task = TaskFactory.quickAction(MOD, 'List loot tables.', 'Loot');
    expect(variantKeyForTask(task)).toBeNull();
  });
});

describe('resolveActivePrompt', () => {
  it('resolves the adopted variant prompt + id when one exists', async () => {
    vi.stubGlobal('fetch', mockApi(VARIANT));
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);
    const res = await resolveActivePrompt(task);
    expect(res.variantId).toBe('var-abc');
    expect(res.prompt).toContain('adopted variant');
  });

  it('falls back to the static prompt when no variant is adopted', async () => {
    vi.stubGlobal('fetch', mockApi(null));
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);
    const res = await resolveActivePrompt(task);
    expect(res.variantId).toBe(STATIC_VARIANT_ID);
    expect(res.prompt).toBe('Static registry prompt.');
  });

  it('falls back to the static prompt on an API error (never blocks the run)', async () => {
    vi.stubGlobal('fetch', mockApi(null, { fail: true }));
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);
    const res = await resolveActivePrompt(task);
    expect(res.variantId).toBe(STATIC_VARIANT_ID);
    expect(res.prompt).toBe('Static registry prompt.');
  });

  it('never hits the API for a task type with no per-item key', async () => {
    const fetchSpy = mockApi(VARIANT);
    vi.stubGlobal('fetch', fetchSpy);
    const task = TaskFactory.quickAction(MOD, 'List loot tables.', 'Loot');
    const res = await resolveActivePrompt(task);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.variantId).toBe(STATIC_VARIANT_ID);
  });
});

describe('composeTaskDispatch', () => {
  it('builds the composed prompt from the adopted variant and records its id in the callback', async () => {
    vi.stubGlobal('fetch', mockApi(VARIANT));
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);
    const { prompt, variantId } = await composeTaskDispatch(task, CTX);
    expect(variantId).toBe('var-abc');
    // The variant text (not the static prompt) is what dispatches.
    expect(prompt).toContain('adopted variant');
    expect(prompt).not.toContain('Static registry prompt.');
    // The resolved variant id is stamped into the completion callback payload.
    expect(prompt).toContain('var-abc');
  });

  it('composes with the static prompt + "static" marker on fallback', async () => {
    vi.stubGlobal('fetch', mockApi(null));
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);
    const { prompt, variantId } = await composeTaskDispatch(task, CTX);
    expect(variantId).toBe(STATIC_VARIANT_ID);
    expect(prompt).toContain('Static registry prompt.');
    expect(prompt).toContain('"static"');
  });
});
