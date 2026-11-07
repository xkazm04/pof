import { describe, it, expect, beforeEach } from 'vitest';
import { useBlenderStore } from '@/components/modules/visual-gen/blender-pipeline/useBlenderStore';

describe('useBlenderStore', () => {
  beforeEach(() => {
    useBlenderStore.setState({ scripts: [] });
  });

  it('holds only the dispatched-script history: no Blender path/version/detecting state nothing writes', () => {
    // blenderPath, blenderVersion, isDetecting and their setters had zero production writers;
    // the truthful Blender version is GET /api/visual-gen/blender/detect (see lib/blender-mcp/types.ts).
    const keys = Object.keys(useBlenderStore.getState()).sort();
    expect(keys).toEqual(['addScript', 'clearCompleted', 'removeScript', 'scripts', 'updateScript']);
    expect(useBlenderStore.getState().scripts).toEqual([]);
  });

  it('adds a script job with running status', () => {
    const id = useBlenderStore.getState().addScript('convert.py', ['--input', 'mesh.fbx']);
    expect(id).toBeTruthy();

    const { scripts } = useBlenderStore.getState();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].scriptName).toBe('convert.py');
    expect(scripts[0].args).toEqual(['--input', 'mesh.fbx']);
    expect(scripts[0].status).toBe('running');
    expect(scripts[0].output).toBe('');
    expect(scripts[0].startedAt).toBeGreaterThan(0);
  });

  it('adds scripts in reverse chronological order', () => {
    useBlenderStore.getState().addScript('first.py', []);
    useBlenderStore.getState().addScript('second.py', []);

    const { scripts } = useBlenderStore.getState();
    expect(scripts[0].scriptName).toBe('second.py');
    expect(scripts[1].scriptName).toBe('first.py');
  });

  it('updates a script job', () => {
    const id = useBlenderStore.getState().addScript('lod.py', []);
    useBlenderStore.getState().updateScript(id, {
      status: 'completed',
      completedAt: Date.now(),
    });

    const job = useBlenderStore.getState().scripts.find((j) => j.id === id);
    expect(job?.status).toBe('completed');
    expect(job?.completedAt).toBeGreaterThan(0);
  });

  it('removes a script job', () => {
    const id = useBlenderStore.getState().addScript('test.py', []);
    useBlenderStore.getState().removeScript(id);
    expect(useBlenderStore.getState().scripts).toHaveLength(0);
  });

  it('clears completed and failed scripts', () => {
    const id1 = useBlenderStore.getState().addScript('a.py', []);
    const id2 = useBlenderStore.getState().addScript('b.py', []);
    useBlenderStore.getState().addScript('c.py', []);

    useBlenderStore.getState().updateScript(id1, { status: 'completed' });
    useBlenderStore.getState().updateScript(id2, { status: 'failed' });

    useBlenderStore.getState().clearCompleted();
    const { scripts } = useBlenderStore.getState();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].scriptName).toBe('c.py');
  });
});
