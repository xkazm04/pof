/**
 * role="option" rows contained three real buttons; an option may hold no interactive
 * content, so assistive tech flattens or drops them.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SceneTree } from '@/components/modules/visual-gen/scene-composer/SceneTree';
import { useSceneComposerStore } from '@/components/modules/visual-gen/scene-composer/useSceneComposerStore';

beforeEach(() => {
  useSceneComposerStore.setState({
    sceneInfo: { objects: [{ name: 'Cube', type: 'MESH', visible: true }] } as never,
    selectedObject: 'Cube',
    lastError: null,
    actionError: null,
    actionResult: null,
  });
});

afterEach(cleanup);

describe('SceneTree semantics', () => {
  it('is a plain list whose select button reports selection', () => {
    render(<SceneTree />);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByRole('list', { name: 'Scene objects' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cube/, pressed: true })).toBeTruthy();
  });
});
