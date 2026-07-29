import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveActivePrompt,
  composeTaskDispatch,
  variantKeyForTask,
  STATIC_VARIANT_ID,
} from '@/lib/prompt-evolution/dispatch-resolve';
import { TaskFactory } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { PromptVariant, ServedVariant } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.7.2',
};
const ORIGIN = 'http://localhost:3000';
const MOD = 'arpg-combat' as SubModuleId;

/** The server answers `resolve-dispatch-variant` with a {@link ServedVariant} envelope. */
function mockApi(value: ServedVariant | null, opts: { fail?: boolean } = {}) {
  return vi.fn(async () => {
    if (opts.fail) throw new Error('network down');
    return {
      json: async () => ({ success: true, data: value }),
    } as unknown as Response;
  });
}

/** Wrap a variant as the adopted-version serve (no live A/B test). */
function adopted(variant: PromptVariant): ServedVariant {
  return { variant, testId: null, slot: null };
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
    vi.stubGlobal('fetch', mockApi(adopted(VARIANT)));
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
    const fetchSpy = mockApi(adopted(VARIANT));
    vi.stubGlobal('fetch', fetchSpy);
    const task = TaskFactory.quickAction(MOD, 'List loot tables.', 'Loot');
    const res = await resolveActivePrompt(task);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.variantId).toBe(STATIC_VARIANT_ID);
  });
});

describe('baseline auto-seeding (loop fuel)', () => {
  /** Record every POST body so we can assert what the dispatch path asked the server. */
  function recordingApi(served: ServedVariant | null) {
    const bodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      bodies.push(body);
      const data = body.action === 'resolve-dispatch-variant' ? served : { variant: VARIANT, seeded: true };
      return { json: async () => ({ success: true, data }) } as unknown as Response;
    });
    return { fetchMock, bodies };
  }

  /** Let the fire-and-forget seed POST land before asserting. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('seeds v1 from the EXACT prompt the run served when the item has no variant', async () => {
    const { fetchMock, bodies } = recordingApi(null);
    vi.stubGlobal('fetch', fetchMock);
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);

    const res = await resolveActivePrompt(task, { seed: true });
    await flush();

    // The run itself is untouched — still the static path, byte for byte.
    expect(res.variantId).toBe(STATIC_VARIANT_ID);
    expect(res.prompt).toBe('Static registry prompt.');
    // …and the baseline captured is exactly that text under the item's key.
    const seed = bodies.find((b) => b.action === 'seed-baseline-variant');
    expect(seed).toBeDefined();
    expect(seed).toMatchObject({
      moduleId: MOD,
      checklistItemId: 'combat-hit-detect',
      prompt: 'Static registry prompt.',
    });
  });

  it('does not seed when a variant is already adopted (never forks a second baseline)', async () => {
    const { fetchMock, bodies } = recordingApi(adopted(VARIANT));
    vi.stubGlobal('fetch', fetchMock);
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);

    await resolveActivePrompt(task, { seed: true });
    await flush();

    expect(bodies.some((b) => b.action === 'seed-baseline-variant')).toBe(false);
  });

  it('never seeds from a preview (no opts) — opening the inspector must not mutate the DB', async () => {
    const { fetchMock, bodies } = recordingApi(null);
    vi.stubGlobal('fetch', fetchMock);
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);

    await composeTaskDispatch(task, CTX);
    await flush();

    expect(bodies.some((b) => b.action === 'seed-baseline-variant')).toBe(false);
  });

  it('resolves without awaiting the seed write (a failing seed never blocks a run)', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { action?: string };
      if (body.action === 'seed-baseline-variant') throw new Error('seed write failed');
      return { json: async () => ({ success: true, data: null }) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);

    const { prompt, variantId } = await composeTaskDispatch(task, CTX, { seed: true });
    await flush();

    expect(variantId).toBe(STATIC_VARIANT_ID);
    expect(prompt).toContain('Static registry prompt.');
  });
});

describe('composeTaskDispatch', () => {
  it('builds the composed prompt from the adopted variant and records its id in the callback', async () => {
    vi.stubGlobal('fetch', mockApi(adopted(VARIANT)));
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);
    const { prompt, variantId } = await composeTaskDispatch(task, CTX);
    expect(variantId).toBe('var-abc');
    // The variant text (not the static prompt) is what dispatches.
    expect(prompt).toContain('adopted variant');
    expect(prompt).not.toContain('Static registry prompt.');
    // The resolved variant id is stamped into the completion callback payload.
    expect(prompt).toContain('var-abc');
  });

  it('stamps the id of the arm a running A/B test served, not the adopted version', async () => {
    // The server picked slot B of a live test; that arm's text must dispatch and
    // its id must reach the callback, or the trial can never be attributed.
    const armB: PromptVariant = { ...VARIANT, id: 'var-arm-b', prompt: 'Arm B text — served by the test.', active: false };
    vi.stubGlobal('fetch', mockApi({ variant: armB, testId: 'ab-1', slot: 'B' }));
    const task = TaskFactory.checklist(MOD, 'combat-hit-detect', 'Static registry prompt.', 'Combat', ORIGIN);
    const { prompt, variantId } = await composeTaskDispatch(task, CTX);
    expect(variantId).toBe('var-arm-b');
    expect(prompt).toContain('Arm B text');
    expect(prompt).toContain('var-arm-b');
    expect(prompt).not.toContain('var-abc');
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
