import { describe, it, expect } from 'vitest';
import {
  lintMenuFlow,
  applyMenuFlowFix,
  exportBlockers,
  type MenuFlowIssue,
} from '@/components/modules/content/ui-hud/MenuFlowDiagram/menuFlowLint';
import { DEFAULT_MENU_FLOW } from '@/components/modules/content/ui-hud/MenuFlowDiagram/constants';
import { screenIdentifier, buildMenuFlowPrompt } from '@/lib/prompts/menu-flow';
import type { MenuFlowConfig, ScreenNode, ScreenTransition } from '@/components/modules/content/ui-hud/MenuFlowDiagram/types';

/**
 * Menu Flow lint: a topology that cannot compile (duplicate or invalid UCLASS / UENUM
 * identifiers) blocks Export; one that compiles but is dubious (unreachable screen,
 * trigger naming no widget on the source screen) warns. Every issue has a one-click fix.
 */

const MAIN: ScreenNode = { id: 'main', name: 'Main Menu', type: 'main-menu', x: 0, y: 0, widgets: ['Play Button', 'Settings Button', 'Quit Button'] };
const SETTINGS: ScreenNode = { id: 'settings', name: 'Settings', type: 'settings', x: 0, y: 0, widgets: ['Back Button'] };
const scr = (id: string, name: string, widgets: string[] = []): ScreenNode => ({ id, name, type: 'custom', x: 0, y: 0, widgets });
const tr = (id: string, fromId: string, toId: string, trigger: string, bidirectional = false): ScreenTransition =>
  ({ id, fromId, toId, trigger, bidirectional });

const MAIN_SETTINGS = tr('t1', 'main', 'settings', 'Settings Button', true);

function duplicateFlow(): MenuFlowConfig {
  return {
    screens: [MAIN, SETTINGS, scr('a', 'Screen 4'), scr('b', 'Screen 4')],
    transitions: [MAIN_SETTINGS, tr('t2', 'main', 'b', 'Play Button'), tr('t3', 'main', 'a', 'Quit Button')],
  };
}

const CTX = { projectName: 'Did', projectPath: 'C:/Proj', ueVersion: '5.5' };

describe('lintMenuFlow', () => {
  it('flags two screens that strip to the same identifier as a duplicate-identifier error', () => {
    const cfg: MenuFlowConfig = {
      screens: [MAIN, SETTINGS, scr('a', 'Screen 4'), scr('b', 'Screen 4')],
      transitions: [MAIN_SETTINGS, tr('t2', 'main', 'b', 'Play Button')],
    };
    expect(lintMenuFlow(cfg)).toContainEqual(expect.objectContaining({
      kind: 'duplicate-identifier', severity: 'error', identifier: 'Screen4', screenIds: ['a', 'b'],
    }));
  });

  it('flags a name whose identifier starts with a digit or is empty, using the prompt builder rule', () => {
    const digit = lintMenuFlow({
      screens: [MAIN, scr('d', '2nd Menu')],
      transitions: [tr('t1', 'main', 'd', 'Play Button')],
    });
    expect(digit).toContainEqual(expect.objectContaining({ kind: 'invalid-identifier', severity: 'error', screenIds: ['d'] }));

    const empty = lintMenuFlow({
      screens: [MAIN, scr('e', '!!!')],
      transitions: [tr('t1', 'main', 'e', 'Play Button')],
    });
    expect(empty).toContainEqual(expect.objectContaining({ kind: 'invalid-identifier', severity: 'error', screenIds: ['e'] }));

    // The same rule the codegen prompt uses: the prompt asks for exactly these identifiers.
    expect(screenIdentifier('2nd Menu')).toBe('2ndMenu');
    expect(screenIdentifier('!!!')).toBe('');
    const prompt = buildMenuFlowPrompt({ screens: [MAIN, scr('d', '2nd Menu')], transitions: [] }, CTX);
    expect(prompt).toContain(`U${screenIdentifier('2nd Menu')}Widget`);
    expect(prompt).toContain(`One entry per screen: ${screenIdentifier('Main Menu')}, ${screenIdentifier('2nd Menu')}`);
  });

  it('warns about a screen with no path from the root (bidirectional edges walk both ways)', () => {
    const cfg: MenuFlowConfig = {
      screens: [MAIN, SETTINGS, scr('x', 'Orphan'), scr('y', 'Via Back', ['Back Button'])],
      // y is reached only through the reverse half of a bidirectional edge
      transitions: [MAIN_SETTINGS, tr('t2', 'y', 'settings', 'Back Button', true)],
    };
    const unreachable = lintMenuFlow(cfg).filter((i) => i.kind === 'unreachable');
    expect(unreachable).toEqual([expect.objectContaining({ kind: 'unreachable', severity: 'warning', screenIds: ['x'] })]);
  });

  it('warns when a transition trigger names no widget on its source screen', () => {
    const cfg: MenuFlowConfig = {
      screens: [MAIN, SETTINGS, scr('b', 'Credits')],
      transitions: [MAIN_SETTINGS, tr('t-b', 'main', 'b', 'Button Click')],
    };
    expect(lintMenuFlow(cfg)).toContainEqual(expect.objectContaining({
      kind: 'unbound-trigger', severity: 'warning', transitionId: 't-b',
    }));
  });

  it('[guard] the shipped default flow is clean', () => {
    expect(lintMenuFlow(DEFAULT_MENU_FLOW)).toEqual([]);
  });
});

describe('applyMenuFlowFix / exportBlockers', () => {
  const find = (issues: MenuFlowIssue[], kind: MenuFlowIssue['kind']) => issues.find((i) => i.kind === kind)!;

  it('renames the later duplicate, links an unreachable screen from the root, and blocks export only on errors', () => {
    const cfg = duplicateFlow();
    const dup = find(lintMenuFlow(cfg), 'duplicate-identifier');
    const fixed = applyMenuFlowFix(cfg, dup);
    expect(lintMenuFlow(fixed).some((i) => i.kind === 'duplicate-identifier')).toBe(false);
    expect(fixed.screens.find((s) => s.id === 'a')!.name).toBe('Screen 4');
    expect(fixed.screens.find((s) => s.id === 'b')!.name).not.toBe('Screen 4');

    const orphanCfg: MenuFlowConfig = { screens: [MAIN, SETTINGS, scr('x', 'Orphan')], transitions: [MAIN_SETTINGS] };
    const unreachable = find(lintMenuFlow(orphanCfg), 'unreachable');
    const linked = applyMenuFlowFix(orphanCfg, unreachable);
    expect(lintMenuFlow(linked).some((i) => i.kind === 'unreachable' && i.screenIds.includes('x'))).toBe(false);
    expect(linked.transitions).toContainEqual(expect.objectContaining({ fromId: 'main', toId: 'x' }));

    expect(exportBlockers(lintMenuFlow(cfg))).toBe(true);
    expect(exportBlockers(lintMenuFlow(fixed))).toBe(false);
    expect(exportBlockers(lintMenuFlow(orphanCfg))).toBe(false); // warnings only
    expect(exportBlockers([])).toBe(false);
  });

  it('renames invalid identifiers (empty, digit-led, engine class) and binds unbound triggers', () => {
    const cfg: MenuFlowConfig = {
      screens: [MAIN, scr('e', '!!!'), scr('d', '2nd Menu'), scr('u', 'User')],
      transitions: [tr('t1', 'main', 'e', 'Button Click'), tr('t2', 'main', 'd', 'Play Button'), tr('t3', 'main', 'u', 'Quit Button')],
    };
    expect(lintMenuFlow(cfg).filter((i) => i.kind === 'invalid-identifier').map((i) => i.screenIds[0])).toEqual(['e', 'd', 'u']);
    let next = cfg;
    for (const issue of lintMenuFlow(cfg)) next = applyMenuFlowFix(next, issue);
    expect(lintMenuFlow(next)).toEqual([]);
    expect(next.transitions.find((t) => t.id === 't1')!.trigger).toBe('Settings Button');
  });
});
