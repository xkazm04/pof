/**
 * Forced-failure suite for `blender-execute-outcomes-go-nowhere`.
 *
 * At HEAD~1 `deleteObject` / `duplicateObject` were
 * `await tryApiFetch(EXECUTE, …)` with the Result DISCARDED, twelve lines under
 * the store's own comment about never swallowing a failure — so confirming a
 * destructive delete gave zero feedback whether the object was removed, never
 * found, or Blender was offline. The generated Python was `if obj:` with no
 * `else`, hand-escaped with `.replace(/"/g,'\\"')`, so a name containing `\`
 * addressed the WRONG object and the missing `else` made that silent. And
 * `SceneExporter` printed "Exported: …" off a bare transport OK.
 *
 * There is no `actionError` field at HEAD~1, so every assertion here is red.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSceneComposerStore } from '@/components/modules/visual-gen/scene-composer/useSceneComposerStore';
import { SceneExporter } from '@/components/modules/visual-gen/scene-composer/SceneExporter';
import { useBlenderStore } from '@/components/modules/visual-gen/blender-pipeline/useBlenderStore';
import {
  deleteObjectScript,
  duplicateObjectScript,
} from '@/lib/blender-mcp/scripts/scene-objects';
import {
  exportSceneScript,
  EXPORT_OK_MARKER,
} from '@/lib/blender-mcp/scripts/export-scene';

const EXECUTE = '/api/blender-mcp/execute';

/** Bodies posted to the execute route, in order. */
let sentCode: string[] = [];

function mockExecute(reply: (code: string) => unknown) {
  sentCode = [];
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes(EXECUTE)) {
      const code = JSON.parse(String(init?.body)).code as string;
      sentCode.push(code);
      return { json: async () => reply(code) };
    }
    // Scene refresh
    return {
      json: async () => ({
        success: true,
        data: { objects: [], collections: [], frameRange: [1, 250] },
      }),
    };
  }) as unknown as typeof fetch;
}

const okOutput = (output: string) => ({ success: true, data: { output } });
const failure = (error: string) => ({ success: false, error });

beforeEach(() => {
  useSceneComposerStore.setState({
    sceneInfo: null,
    selectedObject: null,
    isRefreshing: false,
    lastError: null,
    actionError: null,
    failedAction: null,
    actionResult: null,
    hasRefreshed: false,
  });
  useBlenderStore.setState({ scripts: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Scene Composer object operations report their outcome', () => {
  it('surfaces a failed delete instead of silently refreshing', async () => {
    mockExecute(() => failure("Object 'Cube' not found — nothing was deleted"));

    await useSceneComposerStore.getState().deleteObject('Cube');

    const s = useSceneComposerStore.getState();
    expect(s.actionError).toContain('Could not delete');
    expect(s.actionError).toContain('not found');
    // A failed delete must NOT refresh — a tree that reloads identically is
    // exactly how "nothing happened" used to look like success.
    expect(s.hasRefreshed).toBe(false);
    expect(s.failedAction).toEqual({ op: 'delete', name: 'Cube' });
  });

  it('surfaces a failed duplicate the same way', async () => {
    mockExecute(() => failure('Not connected to Blender'));

    await useSceneComposerStore.getState().duplicateObject('Lamp');

    const s = useSceneComposerStore.getState();
    expect(s.actionError).toContain('Could not duplicate');
    expect(s.actionError).toContain('Not connected');
    expect(s.hasRefreshed).toBe(false);
  });

  it('confirms a successful delete with what Blender printed, then refreshes', async () => {
    mockExecute(() => okOutput('Deleted object: Cube\n'));

    await useSceneComposerStore.getState().deleteObject('Cube');

    const s = useSceneComposerStore.getState();
    expect(s.actionError).toBeNull();
    expect(s.actionResult).toBe('Deleted object: Cube');
    expect(s.hasRefreshed).toBe(true);
  });

  it('records both operations in the Script History panel', async () => {
    mockExecute(() => okOutput('ok'));

    await useSceneComposerStore.getState().deleteObject('Cube');
    await useSceneComposerStore.getState().duplicateObject('Cube');

    const names = useBlenderStore.getState().scripts.map((j) => j.scriptName);
    expect(names).toContain('Delete object: Cube');
    expect(names).toContain('Duplicate object: Cube');
    expect(
      useBlenderStore.getState().scripts.every((j) => j.status === 'completed'),
    ).toBe(true);
  });

  it('marks the history row failed when the script raises', async () => {
    mockExecute(() => failure('ValueError: not found'));

    await useSceneComposerStore.getState().deleteObject('Ghost');

    const job = useBlenderStore.getState().scripts[0];
    expect(job.status).toBe('failed');
    expect(job.error).toContain('ValueError');
  });
});

describe('the generated object scripts escape and raise', () => {
  it('round-trips a name containing a backslash and a double quote', () => {
    const name = 'weird\\name"with quotes';
    const code = deleteObjectScript(name);
    // `py()` doubles the backslash — the old `.replace(/"/g,'\\"')` did not, so
    // Python saw `\n`/`\b` escapes and addressed a different object.
    expect(code).toContain('bpy.data.objects.get("weird\\\\name\\"with quotes")');
    expect(code).not.toContain('get("weird\\name');
  });

  it('raises rather than doing nothing when the object is missing', () => {
    for (const code of [deleteObjectScript('Cube'), duplicateObjectScript('Cube')]) {
      expect(code).toContain('if not obj:');
      expect(code).toContain('raise ValueError');
      // The `if obj:`-with-no-else shape is what made a no-op look like success.
      expect(code).not.toMatch(/^if obj:$/m);
    }
  });

  it('never interpolates the name into an f-string (a brace would break it)', () => {
    const code = deleteObjectScript('Cube{0}');
    expect(code).not.toMatch(/print\(f".*Cube\{0\}/);
    expect(code).toContain('print("Deleted object: Cube{0}")');
  });

  it('sends the escaping script, not a hand-rolled literal', async () => {
    mockExecute(() => okOutput('ok'));
    await useSceneComposerStore.getState().deleteObject('a\\b');
    expect(sentCode[0]).toBe(deleteObjectScript('a\\b'));
  });
});

describe('SceneExporter stops claiming "Exported" from a bare transport OK', () => {
  const setup = () => {
    render(<SceneExporter />);
    fireEvent.change(screen.getByPlaceholderText(/output file path/i), {
      target: { value: 'C:/out/scene.glb' },
    });
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
  };

  it('reports Blender\'s own FINISHED confirmation when it is present', async () => {
    mockExecute(() => okOutput(`${EXPORT_OK_MARKER}C:/out/scene.glb\n`));
    setup();
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(
        /Blender reported the export finished/i,
      ),
    );
  });

  it('says it could not confirm when the script printed no confirmation', async () => {
    // Transport OK, addon accepted the code, nothing printed. Previously this
    // rendered as `Exported: ` — a success message for an unverified write.
    mockExecute(() => okOutput(''));
    setup();
    await waitFor(() => {
      const text = screen.getByRole('status').textContent ?? '';
      expect(text).toMatch(/could not confirm/i);
      expect(text).not.toMatch(/^Exported:/);
    });
  });

  it('reports the failure reason when the export raises', async () => {
    mockExecute(() => failure("Blender's exporter returned {'CANCELLED'}"));
    setup();
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Export failed:.*CANCELLED/),
    );
  });

  it('records the export in the Script History panel', async () => {
    mockExecute(() => okOutput(`${EXPORT_OK_MARKER}C:/out/scene.glb`));
    setup();
    await waitFor(() =>
      expect(
        useBlenderStore.getState().scripts.map((j) => j.scriptName),
      ).toContain('Export scene (gltf)'),
    );
  });

  it('the export script fails loudly instead of assuming FINISHED', () => {
    const code = exportSceneScript({ outputPath: 'C:/out/scene.glb', format: 'gltf' });
    expect(code).toContain("if 'FINISHED' not in status:");
    expect(code).toContain('raise RuntimeError');
    expect(code).toContain(EXPORT_OK_MARKER);
  });
});
