import { describe, it, expect, vi, afterEach } from 'vitest';
import { composeTaskDispatch, variantKeyForTask, STATIC_VARIANT_ID } from '@/lib/prompt-evolution/dispatch-resolve';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import { buildPostProcessPrompt } from '@/lib/prompts/post-process';
import { toStackSpec } from '@/lib/post-process-studio/stack-spec';
import { DEFAULT_EFFECTS } from '@/lib/post-process-studio/effects';
import { GET, POST } from '@/app/api/post-process-studio/route';
import type { PPStudioEffect } from '@/types/post-process-studio';
import type { ProjectContext } from '@/lib/prompt-context';

/**
 * Post-process on the CLITask rail (the material-configurator three-part move):
 * one builder, one task type, one variant key — and the server-side second
 * builder retired.
 */

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };

function effects(): PPStudioEffect[] {
  return DEFAULT_EFFECTS.map((e) => ({ ...e, params: e.params.map((p) => ({ ...p })) }));
}

function mockApi() {
  return vi.fn(async () => ({ json: async () => ({ success: true, data: null }) }) as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('post-process on the CLITask rail', () => {
  it('the task prompt is byte-identical to the single builder (no second header, no wiring block)', async () => {
    const spec = toStackSpec(effects(), '1080p');
    const task = TaskFactory.postProcess('materials', spec, 'Generate PP Volume');
    const composed = buildTaskPrompt(task, CTX);
    expect(composed).toBe(buildPostProcessPrompt(spec, CTX));
    expect(composed).not.toContain('@@CALLBACK');

    vi.stubGlobal('fetch', mockApi());
    const dispatched = await composeTaskDispatch(task, CTX);
    expect(dispatched.variantId).toBe(STATIC_VARIANT_ID);
    expect(dispatched.prompt).toBe(composed);
  });

  it('variantKeyForTask keys the variant by the whole spec', () => {
    const a = TaskFactory.postProcess('materials', toStackSpec(effects(), '1440p'), 'PP');
    const b = TaskFactory.postProcess('materials', toStackSpec(effects(), '1440p'), 'PP');
    const tweaked = effects().map((e) =>
      e.id === 'vignette' ? { ...e, params: e.params.map((p) => ({ ...p, value: 0.41 })) } : e,
    );
    const c = TaskFactory.postProcess('materials', toStackSpec(tweaked, '1440p'), 'PP');

    const ka = variantKeyForTask(a)?.checklistItemId ?? '';
    expect(ka.startsWith('post-process::')).toBe(true);
    expect(variantKeyForTask(b)?.checklistItemId).toBe(ka);
    expect(variantKeyForTask(c)?.checklistItemId).not.toBe(ka);
  });
});

describe('/api/post-process-studio — the second builder is retired', () => {
  it("POST {action:'generate'} no longer builds a prompt (400)", async () => {
    // Before retirement this was `POST(new Request(... {action:'generate', effects}))` → 200
    // with a second, generic prompt. The retired handler takes no body: every action is 400.
    const res = await POST();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json).not.toHaveProperty('data.prompt');
  });

  it('[guard] GET still serves the 7 presets', async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.presets).toHaveLength(7);
  });
});
