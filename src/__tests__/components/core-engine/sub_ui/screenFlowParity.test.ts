import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCREEN_TRIGGERS } from '@/components/modules/core-engine/sub_ui/_shared/hudRegistry';
import { HUD_CHILDREN, SCREEN_TO_FLOW } from '@/components/modules/core-engine/sub_ui/_shared/data';
import {
  flowIdForScreenNode, screenNodeForFlow,
} from '@/components/modules/core-engine/sub_ui/flow/screenWorklist';

/**
 * One owner for the screen-node -> flow-node join: SCREEN_TRIGGERS (plus the HUD
 * child rows). SCREEN_TO_FLOW is a projection, never a second hand table.
 */

const DATA_SRC = resolve(__dirname, '../../../../components/modules/core-engine/sub_ui/_shared/data.ts');

/** The source text of the SCREEN_TO_FLOW declaration. */
function screenToFlowSource(): string {
  const src = readFileSync(DATA_SRC, 'utf-8');
  const start = src.indexOf('export const SCREEN_TO_FLOW');
  const end = src.indexOf('};', start);
  return src.slice(start, end);
}

describe('screen -> flow parity', () => {
  it('every trigger screen resolves to its own flow node, and back', () => {
    for (const t of SCREEN_TRIGGERS) {
      expect(flowIdForScreenNode(t.screen)).toBe(t.flowNode);
      expect(screenNodeForFlow(t.flowNode)).toBe(t.screen);
    }
  });

  it('the HUD child rows map to HUD', () => {
    for (const n of HUD_CHILDREN) expect(SCREEN_TO_FLOW[n.id]).toBe('HUD');
  });

  it('SCREEN_TO_FLOW holds no hand-listed pair for a trigger screen', () => {
    const src = screenToFlowSource();
    const duplicated = SCREEN_TRIGGERS.filter(t => src.includes(`'${t.screen}'`)).length;
    expect(duplicated).toBe(0);
  });
});
