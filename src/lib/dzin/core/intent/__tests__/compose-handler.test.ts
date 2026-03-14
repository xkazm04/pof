import { describe, it, expect } from 'vitest';
import { createComposeHandler } from '../handlers/compose';
import { NEEDS_LLM } from '../director';
import type { Intent, ComposePayload, IntentResult } from '../types';
import type { WorkspaceState } from '../../state/types';
import type { PanelDirective } from '../../layout/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComposeIntent(payload: ComposePayload): Intent<'compose'> {
  return {
    id: 'test-compose',
    type: 'compose',
    payload,
    source: 'click',
    timestamp: Date.now(),
  };
}

function makeState(overrides?: Partial<WorkspaceState>): WorkspaceState {
  return {
    layout: {
      template: 'split-2',
      gridTemplateRows: '1fr',
      gridTemplateColumns: '1fr 1fr',
    },
    panels: [
      {
        id: 'panel-1',
        type: 'scene-editor',
        slotIndex: 0,
        density: 'full',
        role: 'primary',
        uiState: {},
      },
      {
        id: 'panel-2',
        type: 'character-detail',
        slotIndex: 1,
        density: 'compact',
        role: 'secondary',
        uiState: {},
      },
    ],
    streaming: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createComposeHandler', () => {
  const registryHas = (type: string) =>
    ['scene-editor', 'character-detail', 'beats-manager'].includes(type);

  const hints: Record<string, PanelDirective[]> = {
    'scene-editor': [
      { type: 'scene-editor', role: 'primary' },
      { type: 'character-detail', role: 'secondary' },
    ],
  };

  it('close with panelId generates remove patch for that panel index', () => {
    const handler = createComposeHandler(registryHas, hints, () => makeState());
    const result = handler(makeComposeIntent({ action: 'close', panelId: 'panel-1' }));

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      expect(r.patches).toEqual([{ op: 'remove', path: '/panels/0' }]);
      expect(r.origin).toBe('user');
    }
  });

  it('set-layout with template generates replace patch for /layout/template', () => {
    const handler = createComposeHandler(registryHas, hints, () => makeState());
    const result = handler(makeComposeIntent({ action: 'set-layout', template: 'grid-4' }));

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      expect(r.patches).toEqual([
        { op: 'replace', path: '/layout/template', value: 'grid-4' },
      ]);
    }
  });

  it('open with unknown panelType returns error', () => {
    const handler = createComposeHandler(registryHas, hints, () => makeState());
    const result = handler(makeComposeIntent({ action: 'open', panelType: 'nonexistent' }));

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('error');
    if (r.status === 'error') {
      expect(r.error).toContain('nonexistent');
    }
  });

  it('open with known panelType but no workflow hint returns NEEDS_LLM', () => {
    const handler = createComposeHandler(registryHas, hints, () => makeState());
    const result = handler(makeComposeIntent({ action: 'open', panelType: 'beats-manager' }));

    expect(result).toBe(NEEDS_LLM);
  });

  it('open with known panelType and workflow hint resolves locally with directives', () => {
    const handler = createComposeHandler(registryHas, hints, () => makeState());
    const result = handler(makeComposeIntent({ action: 'open', panelType: 'scene-editor' }));

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      // Should add panels from the hint directives
      expect(r.patches.length).toBeGreaterThan(0);
      expect(r.origin).toBe('user');
    }
  });

  it('swap returns NEEDS_LLM (complex composition)', () => {
    const handler = createComposeHandler(registryHas, hints, () => makeState());
    const result = handler(makeComposeIntent({ action: 'swap', panelId: 'panel-1', panelType: 'beats-manager' }));

    expect(result).toBe(NEEDS_LLM);
  });
});
