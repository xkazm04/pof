import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ScreenEditor } from '@/components/modules/content/ui-hud/MenuFlowDiagram/ScreenEditor';
import type { ScreenNode } from '@/components/modules/content/ui-hud/MenuFlowDiagram/types';

/**
 * Each widget becomes a UPROPERTY(meta=(BindWidget)) member of the screen's class, and
 * the trigger dropdown keys its options by name: two widgets with one name are a
 * duplicate member and a duplicate React key. The editor must not mint one.
 */

afterEach(cleanup);

const screen: ScreenNode = { id: 's1', name: 'Main', type: 'main-menu', x: 0, y: 0, widgets: ['Play Button'] };

function addWidget(name: string) {
  const onUpdate = vi.fn();
  const { container } = render(createElement(ScreenEditor, { screen, onUpdate, onClose: () => {} }));
  const input = container.querySelector('input[placeholder]') as HTMLInputElement;
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return onUpdate;
}

describe('ScreenEditor widget names', () => {
  it('refuses a widget whose name is already on the screen (any case, any padding)', () => {
    expect(addWidget('Play Button')).not.toHaveBeenCalled();
    cleanup();
    expect(addWidget('  play button ')).not.toHaveBeenCalled();
  });

  it('still adds a new name', () => {
    const onUpdate = addWidget('Quit Button');
    expect(onUpdate).toHaveBeenCalledWith({ widgets: ['Play Button', 'Quit Button'] });
  });
});
