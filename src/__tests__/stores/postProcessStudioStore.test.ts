import { describe, it, expect, beforeEach } from 'vitest';
import { usePostProcessStudioStore } from '@/stores/postProcessStudioStore';

const EXPLAIN_KEY = 'pof.ppStudio.explainMode';

describe('postProcessStudioStore — explain mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePostProcessStudioStore.setState({ explainMode: false });
  });

  it('defaults to off', () => {
    expect(usePostProcessStudioStore.getState().explainMode).toBe(false);
  });

  it('toggleExplainMode flips the flag and persists the preference', () => {
    usePostProcessStudioStore.getState().toggleExplainMode();
    expect(usePostProcessStudioStore.getState().explainMode).toBe(true);
    expect(window.localStorage.getItem(EXPLAIN_KEY)).toBe('1');

    usePostProcessStudioStore.getState().toggleExplainMode();
    expect(usePostProcessStudioStore.getState().explainMode).toBe(false);
    expect(window.localStorage.getItem(EXPLAIN_KEY)).toBe('0');
  });

  it('init() restores a previously persisted explain-mode preference', () => {
    window.localStorage.setItem(EXPLAIN_KEY, '1');
    usePostProcessStudioStore.getState().init();
    expect(usePostProcessStudioStore.getState().explainMode).toBe(true);
  });

  it('init() leaves explain mode off when nothing is persisted', () => {
    usePostProcessStudioStore.getState().init();
    expect(usePostProcessStudioStore.getState().explainMode).toBe(false);
  });
});
