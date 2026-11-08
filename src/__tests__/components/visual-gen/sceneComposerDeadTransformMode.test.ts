/** `transformMode` / `setTransformMode` had zero readers outside the store's own declaration. */
import { describe, it, expect } from 'vitest';
import { useSceneComposerStore } from '@/components/modules/visual-gen/scene-composer/useSceneComposerStore';

describe('scene composer store surface', () => {
  it('carries no transform mode', () => {
    const state = useSceneComposerStore.getState();
    expect('transformMode' in state).toBe(false);
    expect('setTransformMode' in state).toBe(false);
  });
});
