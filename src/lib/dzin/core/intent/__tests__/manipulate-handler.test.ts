import { describe, it, expect } from 'vitest';
import { createManipulateHandler } from '../handlers/manipulate';
import { NEEDS_LLM } from '../director';
import type { Intent, ManipulatePayload, IntentResult } from '../types';
import type { WorkspaceState } from '../../state/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManipulateIntent(payload: ManipulatePayload): Intent<'manipulate'> {
  return {
    id: 'test-manipulate',
    type: 'manipulate',
    payload,
    source: 'drag',
    timestamp: Date.now(),
  };
}

function makeState(): WorkspaceState {
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
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createManipulateHandler', () => {
  it('resize with panelId + width + height generates replace patch for panel density', () => {
    const handler = createManipulateHandler(() => makeState());
    const result = handler(
      makeManipulateIntent({
        action: 'resize',
        panelId: 'panel-1',
        width: 200,
        height: 150,
      }),
    );

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      // Should have a replace patch for the panel's density field
      expect(r.patches.some(p => p.path.includes('density'))).toBe(true);
      expect(r.origin).toBe('user');
    }
  });

  it('set-density generates replace patch for panel density field', () => {
    const handler = createManipulateHandler(() => makeState());
    const result = handler(
      makeManipulateIntent({
        action: 'set-density',
        panelId: 'panel-2',
        density: 'full',
      }),
    );

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      expect(r.patches).toEqual([
        { op: 'replace', path: '/panels/1/density', value: 'full' },
      ]);
    }
  });

  it('unknown panelId returns error', () => {
    const handler = createManipulateHandler(() => makeState());
    const result = handler(
      makeManipulateIntent({
        action: 'set-density',
        panelId: 'nonexistent',
        density: 'micro',
      }),
    );

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('error');
    if (r.status === 'error') {
      expect(r.error).toContain('nonexistent');
    }
  });
});

describe('system handler', () => {
  // Import system handler inline to test alongside manipulate
  it('undo returns resolved with empty patches and undo description', async () => {
    const { createSystemHandler } = await import('../handlers/system');
    const handler = createSystemHandler();
    const result = handler({
      id: 'test-sys',
      type: 'system',
      payload: { action: 'undo' },
      source: 'keyboard',
      timestamp: Date.now(),
    });

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      expect(r.patches).toEqual([]);
      expect(r.description).toBe('undo');
    }
  });

  it('redo returns resolved with empty patches and redo description', async () => {
    const { createSystemHandler } = await import('../handlers/system');
    const handler = createSystemHandler();
    const result = handler({
      id: 'test-sys-2',
      type: 'system',
      payload: { action: 'redo' },
      source: 'keyboard',
      timestamp: Date.now(),
    });

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      expect(r.patches).toEqual([]);
      expect(r.description).toBe('redo');
    }
  });
});

describe('navigate handler', () => {
  it('focus with panelId returns resolved', async () => {
    const { createNavigateHandler } = await import('../handlers/navigate');
    const handler = createNavigateHandler();
    const result = handler({
      id: 'test-nav',
      type: 'navigate',
      payload: { action: 'focus', panelId: 'panel-1' },
      source: 'click',
      timestamp: Date.now(),
    });

    expect(result).not.toBe(NEEDS_LLM);
    const r = result as IntentResult;
    expect(r.status).toBe('resolved');
  });

  it('focus without panelId or panelType returns NEEDS_LLM', async () => {
    const { createNavigateHandler } = await import('../handlers/navigate');
    const handler = createNavigateHandler();
    const result = handler({
      id: 'test-nav-2',
      type: 'navigate',
      payload: { action: 'focus' },
      source: 'keyboard',
      timestamp: Date.now(),
    });

    expect(result).toBe(NEEDS_LLM);
  });
});
