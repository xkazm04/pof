import { describe, it, expect, beforeEach } from 'vitest';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';

describe('useForgeStore', () => {
  beforeEach(() => {
    useForgeStore.setState({
      jobs: [],
      activeProviderId: 'triposr',
      promptHistory: [],
    });
  });

  it('starts with empty state', () => {
    const state = useForgeStore.getState();
    expect(state.jobs).toEqual([]);
    expect(state.activeProviderId).toBe('triposr');
    expect(state.promptHistory).toEqual([]);
  });

  it('adds a job with pending status', () => {
    const id = useForgeStore.getState().addJob({
      mode: 'text-to-3d',
      prompt: 'A sword',
      providerId: 'triposr',
    });

    expect(id).toBeTruthy();
    const { jobs } = useForgeStore.getState();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('pending');
    expect(jobs[0].progress).toBe(0);
    expect(jobs[0].prompt).toBe('A sword');
    expect(jobs[0].providerId).toBe('triposr');
  });

  it('adds jobs in reverse chronological order', () => {
    useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'First', providerId: 'triposr' });
    useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'Second', providerId: 'triposr' });

    const { jobs } = useForgeStore.getState();
    expect(jobs[0].prompt).toBe('Second');
    expect(jobs[1].prompt).toBe('First');
  });

  it('updates a job', () => {
    const id = useForgeStore.getState().addJob({
      mode: 'text-to-3d',
      prompt: 'A shield',
      providerId: 'triposr',
    });

    useForgeStore.getState().updateJob(id, {
      status: 'generating',
      progress: 50,
    });

    const job = useForgeStore.getState().jobs.find((j) => j.id === id);
    expect(job?.status).toBe('generating');
    expect(job?.progress).toBe(50);
  });

  it('removes a job', () => {
    const id = useForgeStore.getState().addJob({
      mode: 'text-to-3d',
      prompt: 'A helmet',
      providerId: 'triposr',
    });

    useForgeStore.getState().removeJob(id);
    expect(useForgeStore.getState().jobs).toHaveLength(0);
  });

  it('clears completed and failed jobs', () => {
    const id1 = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A', providerId: 'triposr' });
    const id2 = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'B', providerId: 'triposr' });
    useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'C', providerId: 'triposr' });

    useForgeStore.getState().updateJob(id1, { status: 'completed' });
    useForgeStore.getState().updateJob(id2, { status: 'failed' });

    useForgeStore.getState().clearCompleted();
    const { jobs } = useForgeStore.getState();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].prompt).toBe('C');
  });

  it('sets active provider', () => {
    useForgeStore.getState().setActiveProvider('meshy');
    expect(useForgeStore.getState().activeProviderId).toBe('meshy');
  });

  it('adds to prompt history without duplicates', () => {
    const { addToHistory } = useForgeStore.getState();
    addToHistory('sword');
    addToHistory('shield');
    addToHistory('sword'); // duplicate — should move to front

    const { promptHistory } = useForgeStore.getState();
    expect(promptHistory).toEqual(['sword', 'shield']);
  });

  it('limits prompt history to 50 entries', () => {
    const { addToHistory } = useForgeStore.getState();
    for (let i = 0; i < 60; i++) {
      addToHistory(`prompt-${i}`);
    }
    expect(useForgeStore.getState().promptHistory).toHaveLength(50);
    expect(useForgeStore.getState().promptHistory[0]).toBe('prompt-59');
  });
});
