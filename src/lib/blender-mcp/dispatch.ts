import { tryApiFetch } from '@/lib/api-utils';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { useBlenderStore } from '@/components/modules/visual-gen/blender-pipeline/useBlenderStore';

/**
 * THE dispatcher for `/api/blender-mcp/execute`.
 *
 * Every Python script PoF sends to Blender must go through here, because this
 * is also what records it in the Script History panel — the panel presented to
 * the user as the record of what PoF ran in their Blender. Call sites that
 * fetched the route directly were invisible there (the panel would still say
 * "No scripts have been run yet" after a real dispatch), and several of them
 * discarded the `Result` entirely, so a failed script and a successful one were
 * indistinguishable on screen.
 *
 * It lives in lib (not in the `ScriptRunner` component file) so non-UI modules do
 * not import a React component to send a script; `ScriptRunner.tsx` re-exports it.
 *
 * `src/__tests__/lib/blender-mcp/execute-dispatch-guard.test.ts` enforces this:
 * a NEW raw fetch of the execute route fails the build.
 */
export async function executeViaMCP(scriptName: string, scriptCode: string) {
  const { addScript, updateScript } = useBlenderStore.getState();
  const jobId = addScript(scriptName, []);

  const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: scriptCode }),
  });

  if (result.ok) {
    updateScript(jobId, {
      status: 'completed',
      output: result.data.output,
      completedAt: Date.now(),
    });
  } else {
    updateScript(jobId, {
      status: 'failed',
      error: result.error,
      completedAt: Date.now(),
    });
  }

  return result;
}
