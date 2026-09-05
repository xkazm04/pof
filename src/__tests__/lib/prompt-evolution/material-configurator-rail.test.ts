import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  composeTaskDispatch,
  variantKeyForTask,
  STATIC_VARIANT_ID,
} from '@/lib/prompt-evolution/dispatch-resolve';
import { TaskFactory, buildTaskPrompt, materialConfiguratorVariantKey } from '@/lib/cli-task';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import type { ProjectContext } from '@/lib/prompt-context';
import type { PromptVariant, ServedVariant } from '@/types/prompt-evolution';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';

/**
 * Phase 1 of the standalone-builder migration: the material configurator.
 *
 * The governing risk (`software-engineering/quality-gates`) is a fitness signal
 * measuring the wrong surface. A prompt dispatched by a raw `sendPrompt` is
 * INVISIBLE to prompt evolution: no variant can be adopted for it, no A/B can be
 * run on it, and the inspector cannot show what actually ships. These tests pin
 * the three things that migration has to be true for:
 *   1. the composed dispatch is byte-identical to the standalone builder's output
 *      when nothing is adopted (so the migration changed no prompt wording);
 *   2. the PREVIEW path composes the identical string (one composition path);
 *   3. `variantKeyForTask` sees the type, and an adopted variant is served.
 */

const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.8.0',
};

const CONFIG: MaterialConfiguratorConfig = {
  surfaceType: 'metal',
  features: ['emissive'],
  outputType: 'master',
  params: {
    roughness: { name: 'Roughness', min: 0, max: 1, defaultValue: 0.35, step: 0.01 },
    metallic: { name: 'Metallic', min: 0, max: 1, defaultValue: 1, step: 0.01 },
  },
};

function mockApi(value: ServedVariant | null) {
  return vi.fn(async () => ({ json: async () => ({ success: true, data: value }) }) as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('material-configurator on the CLITask rail', () => {
  it('variantKeyForTask sees the type — a variant CAN be adopted for it', () => {
    const task = TaskFactory.materialConfigurator('materials', CONFIG, 'Material Config');
    expect(variantKeyForTask(task)).toEqual({
      moduleId: 'materials',
      checklistItemId: materialConfiguratorVariantKey(CONFIG),
    });
  });

  it('keys the variant by the CONFIGURATION, not just the surface — the prompt embeds it', () => {
    const other: MaterialConfiguratorConfig = {
      ...CONFIG,
      params: { ...CONFIG.params, roughness: { ...CONFIG.params.roughness, defaultValue: 0.9 } },
    };
    // Same surface + output type, different parameter defaults → a DIFFERENT key,
    // so a variant seeded for one configuration is never served to the other.
    expect(materialConfiguratorVariantKey(other)).not.toBe(materialConfiguratorVariantKey(CONFIG));
    expect(materialConfiguratorVariantKey(CONFIG)).toMatch(/^material-configurator::master::metal::[0-9a-f]{8}$/);
    // …and it is stable across calls (a key that drifts loses every prior trial).
    expect(materialConfiguratorVariantKey({ ...CONFIG })).toBe(materialConfiguratorVariantKey(CONFIG));
  });

  it('dispatches byte-identically to the standalone builder when nothing is adopted', async () => {
    vi.stubGlobal('fetch', mockApi(null));
    const task = TaskFactory.materialConfigurator('materials', CONFIG, 'Material Config');
    const { prompt, variantId } = await composeTaskDispatch(task, CTX);

    expect(variantId).toBe(STATIC_VARIANT_ID);
    expect(prompt).toBe(buildMaterialConfiguratorPrompt(CONFIG, CTX));
  });

  it('the PREVIEW is byte-identical to the DISPATCH (one composition path)', async () => {
    vi.stubGlobal('fetch', mockApi(null));
    const task = TaskFactory.materialConfigurator('materials', CONFIG, 'Material Config');
    // The inspector's call shape: composeTaskDispatch with NO options (never seeds).
    const preview = await composeTaskDispatch(task, CTX);
    // The dispatch path's call shape (useModuleCLI.execute).
    const dispatch = await composeTaskDispatch(task, CTX, { seed: true });
    expect(preview.prompt).toBe(dispatch.prompt);
  });

  it('serves an adopted variant in place of the builder body', async () => {
    const variant: PromptVariant = {
      id: 'var-mat-1',
      moduleId: 'materials',
      checklistItemId: materialConfiguratorVariantKey(CONFIG),
      label: 'terser metal master',
      prompt: 'ADOPTED VARIANT BODY for the metal master material.',
      origin: 'user-edit',
      style: 'imperative',
      parentId: null,
      active: true,
      createdAt: '2026-09-05T00:00:00.000Z',
    };
    vi.stubGlobal('fetch', mockApi({ variant, testId: null, slot: null }));

    const task = TaskFactory.materialConfigurator('materials', CONFIG, 'Material Config');
    const { prompt, variantId } = await composeTaskDispatch(task, CTX);

    expect(variantId).toBe('var-mat-1');
    expect(prompt).toBe('ADOPTED VARIANT BODY for the metal master material.');
  });

  it('the handler adds NO callback/wiring section of its own (the builder owns the whole prompt)', () => {
    const task = TaskFactory.materialConfigurator('materials', CONFIG, 'Material Config');
    const composed = buildTaskPrompt(task, CTX);
    expect(composed).not.toContain('@@CALLBACK');
    expect(composed).toBe(buildMaterialConfiguratorPrompt(CONFIG, CTX));
  });
});
