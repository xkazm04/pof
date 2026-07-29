import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  variantKeyForTask,
  composeTaskDispatch,
  STATIC_VARIANT_ID,
} from '@/lib/prompt-evolution/dispatch-resolve';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import { taskVariantBody } from '@/lib/cli-task-handlers';
import type { ProjectContext } from '@/lib/prompt-context';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { PromptVariant, ServedVariant } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

/**
 * The judged path — recipe (`generate`) dispatches are the only ones whose OUTPUT the
 * judge fleet scores, and they carry `prompt: ''` (the body is composed inside the
 * handler). These assert the extension: they resolve/serve variants, a served variant
 * really replaces the recipe body, and the static path is unchanged.
 */

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };
const ORIGIN = 'http://localhost:3000';
const MOD = 'arpg-inventory' as SubModuleId;

const ENTITY: StoredCatalogEntity = {
  id: 'itm-rusty-sword',
  catalogId: 'items',
  name: 'Rusty Sword',
  categoryPath: ['Weapons', 'Swords'],
  tags: ['common'],
  lifecycle: 'scaffolded',
  data: { itemType: 'weapon', rarity: 'common', damage: 5 },
};

/** Callback ids embed Date.now() — normalize so two composes are comparable. */
const normalize = (p: string) => p.replace(/cb-\d+-\d+/g, 'cb-TEST');

const VARIANT: PromptVariant = {
  id: 'var-recipe-b',
  moduleId: MOD,
  checklistItemId: 'items::author-python::itm-rusty-sword',
  label: 'user-edit variant (imperative)',
  prompt: 'CHALLENGER BODY — author the UARPGItemDefinition with an explicit field checklist.',
  origin: 'user-edit',
  style: 'imperative',
  parentId: null,
  active: true,
  createdAt: '2026-07-01T00:00:00.000Z',
};

/** Record every POST body; answer resolve with `served`, seed with an ack. */
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

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('variantKeyForTask — recipe dispatches', () => {
  it('keys a generate task by catalog::step::entity', () => {
    const task = TaskFactory.generate(MOD, ENTITY, 'author-python', ORIGIN, 'Items');
    expect(variantKeyForTask(task)).toEqual({
      moduleId: MOD,
      checklistItemId: 'items::author-python::itm-rusty-sword',
    });
  });

  it('keys each STEP of the same entity separately', () => {
    const a = TaskFactory.generate(MOD, ENTITY, 'author-python', ORIGIN, 'Items');
    const b = TaskFactory.generate(MOD, ENTITY, 'verify', ORIGIN, 'Items');
    expect(variantKeyForTask(a)!.checklistItemId).not.toBe(variantKeyForTask(b)!.checklistItemId);
  });

  it('keys each ENTITY separately — a variant embeds its own entity spec and must not leak', () => {
    const other: StoredCatalogEntity = { ...ENTITY, id: 'itm-iron-axe', name: 'Iron Axe' };
    const a = TaskFactory.generate(MOD, ENTITY, 'author-python', ORIGIN, 'Items');
    const b = TaskFactory.generate(MOD, other, 'author-python', ORIGIN, 'Items');
    expect(variantKeyForTask(a)!.checklistItemId).not.toBe(variantKeyForTask(b)!.checklistItemId);
  });

  it('keys an evaluate-track task by catalog::track::entity', () => {
    const task = TaskFactory.evaluateTrack(MOD, ENTITY, 'art-2d', ORIGIN, 'Art 2D');
    expect(variantKeyForTask(task)).toEqual({
      moduleId: MOD,
      checklistItemId: 'items::track:art-2d::itm-rusty-sword',
    });
  });
});

describe('taskVariantBody', () => {
  it('materializes the recipe step body for a generate task (which carries prompt: "")', () => {
    const task = TaskFactory.generate(MOD, ENTITY, 'author-python', ORIGIN, 'Items');
    expect(task.prompt).toBe('');
    const body = taskVariantBody(task, CTX);
    expect(body.length).toBeGreaterThan(200);
    expect(body).toContain('Rusty Sword');
    // The callback section is dispatch machinery, not wording under test.
    expect(body).not.toContain('@@CALLBACK');
  });

  it('leaves a checklist task on its own prompt', () => {
    const task = TaskFactory.checklist(MOD, 'ac-1', 'Static registry prompt.', 'Combat', ORIGIN);
    expect(taskVariantBody(task, CTX)).toBe('Static registry prompt.');
  });
});

describe('composeTaskDispatch — recipe path', () => {
  it('is byte-identical to the plain build when no variant exists', async () => {
    const { fetchMock } = recordingApi(null);
    vi.stubGlobal('fetch', fetchMock);
    const task = TaskFactory.generate(MOD, ENTITY, 'author-python', ORIGIN, 'Items');

    const { prompt, variantId } = await composeTaskDispatch(task, CTX);
    expect(variantId).toBe(STATIC_VARIANT_ID);
    expect(normalize(prompt)).toBe(normalize(buildTaskPrompt(task, CTX)));
  });

  it('serves the variant body instead of the recipe body, keeping the callback', async () => {
    const { fetchMock } = recordingApi({ variant: VARIANT, testId: 'ab-1', slot: 'B' });
    vi.stubGlobal('fetch', fetchMock);
    const task = TaskFactory.generate(MOD, ENTITY, 'author-python', ORIGIN, 'Items');

    const { prompt, variantId } = await composeTaskDispatch(task, CTX);
    expect(variantId).toBe('var-recipe-b');
    expect(prompt).toContain('CHALLENGER BODY');
    // The recipe's own wording is gone — the swap really happened.
    expect(prompt).not.toContain('Author a UARPGItemDefinition data asset for');
    // …and the dispatch machinery survives, stamped with the served variant so the
    // /api/catalog callback can book the trial.
    expect(prompt).toContain('@@CALLBACK');
    expect(prompt).toContain('var-recipe-b');
  });

  it('seeds the baseline from the RECIPE body on a first real dispatch', async () => {
    const { fetchMock, bodies } = recordingApi(null);
    vi.stubGlobal('fetch', fetchMock);
    const task = TaskFactory.generate(MOD, ENTITY, 'author-python', ORIGIN, 'Items');

    await composeTaskDispatch(task, CTX, { seed: true });
    await flush();

    const seed = bodies.find((b) => b.action === 'seed-baseline-variant');
    expect(seed).toBeDefined();
    expect(seed!.checklistItemId).toBe('items::author-python::itm-rusty-sword');
    // Not the empty string the task carried — the real composed recipe body.
    expect(String(seed!.prompt)).toBe(taskVariantBody(task, CTX));
    expect(String(seed!.prompt).length).toBeGreaterThan(200);
  });
});
