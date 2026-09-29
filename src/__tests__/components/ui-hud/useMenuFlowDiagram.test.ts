import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderHook, render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useMenuFlowDiagram } from '@/components/modules/content/ui-hud/MenuFlowDiagram/useMenuFlowDiagram';
import { MenuFlowDiagram } from '@/components/modules/content/ui-hud/MenuFlowDiagram';

/**
 * The Menu Flow hook must not mint a flow that cannot compile (two screens named
 * 'Screen 4' become two UScreen4Widget classes) and every drawn route must carry a
 * trigger that names a real widget on its source screen, editable afterwards.
 */

afterEach(cleanup);

describe('useMenuFlowDiagram', () => {
  it('add -> delete -> add keeps every screen name unique', () => {
    const { result } = renderHook(() => useMenuFlowDiagram());
    act(() => result.current.addScreen());
    act(() => result.current.deleteScreen('scr-pause'));
    act(() => result.current.addScreen());

    const names = result.current.screens.map((s) => s.name);
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(names.length);
    const ids = result.current.screens.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a drawn route defaults to the first unused source widget, and its trigger can be changed', () => {
    const { result } = renderHook(() => useMenuFlowDiagram());
    act(() => result.current.startConnection('scr-main'));
    act(() => result.current.completeConnection('scr-pause'));

    const added = result.current.transitions.find((t) => t.fromId === 'scr-main' && t.toId === 'scr-pause');
    expect(added).toBeDefined();
    expect(added!.trigger).toBe('Play Button');

    act(() => result.current.updateTransition(added!.id, { trigger: 'Quit Button' }));
    expect(result.current.transitions.find((t) => t.id === added!.id)!.trigger).toBe('Quit Button');
  });
});

describe('MenuFlowDiagram export gate (wiring)', () => {
  const exportButton = () => screen.getByText('EXPORT_MENU_ARCHITECTURE').closest('button')!;

  it('a name that cannot compile disables Export until its one-click fix is applied', () => {
    const onGenerate = vi.fn();
    render(createElement(MenuFlowDiagram, { onGenerate, isGenerating: false }));
    expect(screen.getByTestId('menu-flow-lint-clean')).toBeTruthy();
    expect(exportButton().disabled).toBe(false);

    fireEvent.click(screen.getByText('Add Screen'));
    fireEvent.change(screen.getByDisplayValue('Screen 4'), { target: { value: '2nd Menu' } });
    expect(screen.getByTestId('menu-flow-export-blocked')).toBeTruthy();
    expect(exportButton().disabled).toBe(true);

    fireEvent.click(screen.getByText('Rename screen'));
    expect(screen.queryByTestId('menu-flow-export-blocked')).toBeNull();
    expect(exportButton().disabled).toBe(false);
    fireEvent.click(exportButton());
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('route triggers are a picker over the source screen widgets', () => {
    render(createElement(MenuFlowDiagram, { onGenerate: vi.fn(), isGenerating: false }));
    const picker = screen.getByLabelText('Trigger for Main Menu to Settings') as HTMLSelectElement;
    expect(Array.from(picker.options).map((o) => o.value)).toEqual(['Play Button', 'Settings Button', 'Quit Button']);
    fireEvent.change(picker, { target: { value: 'Play Button' } });
    expect((screen.getByLabelText('Trigger for Main Menu to Settings') as HTMLSelectElement).value).toBe('Play Button');
  });
});
