import { describe, it, expect, beforeEach } from 'vitest';
import { useBlenderStore } from '@/components/modules/visual-gen/blender-pipeline/useBlenderStore';

describe('useBlenderStore', () => {
  beforeEach(() => {
    useBlenderStore.setState({
      blenderPath: null,
      blenderVersion: null,
      isDetecting: false,
      scripts: [],
    });
  });

  it('starts with empty state', () => {
    const state = useBlenderStore.getState();
    expect(state.blenderPath).toBeNull();
    expect(state.blenderVersion).toBeNull();
    expect(state.isDetecting).toBe(false);
    expect(state.scripts).toEqual([]);
  });

  it('sets blender path and version', () => {
    useBlenderStore.getState().setBlenderPath('C:\\Program Files\\Blender\\blender.exe', '4.1.0');
    const state = useBlenderStore.getState();
    expect(state.blenderPath).toBe('C:\\Program Files\\Blender\\blender.exe');
    expect(state.blenderVersion).toBe('4.1.0');
  });

  it('sets blender path without version', () => {
    useBlenderStore.getState().setBlenderPath('/usr/bin/blender');
    const state = useBlenderStore.getState();
    expect(state.blenderPath).toBe('/usr/bin/blender');
    expect(state.blenderVersion).toBeNull();
  });

  it('clears blender path', () => {
    useBlenderStore.getState().setBlenderPath('/usr/bin/blender', '4.0');
    useBlenderStore.getState().setBlenderPath(null);
    const state = useBlenderStore.getState();
    expect(state.blenderPath).toBeNull();
    expect(state.blenderVersion).toBeNull();
  });

  it('sets detecting flag', () => {
    useBlenderStore.getState().setDetecting(true);
    expect(useBlenderStore.getState().isDetecting).toBe(true);
    useBlenderStore.getState().setDetecting(false);
    expect(useBlenderStore.getState().isDetecting).toBe(false);
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

  it('appends output to a script job', () => {
    const id = useBlenderStore.getState().addScript('convert.py', []);
    useBlenderStore.getState().appendOutput(id, 'Loading mesh...\n');
    useBlenderStore.getState().appendOutput(id, 'Exporting FBX...\n');

    const job = useBlenderStore.getState().scripts.find((j) => j.id === id);
    expect(job?.output).toBe('Loading mesh...\nExporting FBX...\n');
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
