import { describe, it, expect } from 'vitest';
import { serializeForClaude } from '../serializer';
import type { Intent } from '../../intent/types';
import type { WorkspaceSnapshot, SerializedContext } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIntent(overrides?: Partial<Intent>): Intent {
  return {
    id: 'intent-001',
    type: 'compose',
    payload: { action: 'open', panelType: 'scene-editor' },
    source: 'click',
    timestamp: 1700000000000,
    ...overrides,
  } as Intent;
}

function makeSnapshot(overrides?: Partial<WorkspaceSnapshot>): WorkspaceSnapshot {
  return {
    panels: [
      { type: 'scene-editor', role: 'primary', density: 'full' },
      { type: 'character-list', role: 'sidebar', density: 'compact' },
    ],
    layout: 'split-2',
    viewport: { width: 1920, height: 1080 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('serializeForClaude', () => {
  it('produces valid JSON string containing intent id, type, payload, and source', () => {
    const intent = makeIntent();
    const snapshot = makeSnapshot();

    const result = serializeForClaude(intent, snapshot);
    const parsed: SerializedContext = JSON.parse(result);

    expect(parsed.intent.id).toBe('intent-001');
    expect(parsed.intent.type).toBe('compose');
    expect(parsed.intent.payload).toEqual({ action: 'open', panelType: 'scene-editor' });
    expect(parsed.intent.source).toBe('click');
  });

  it('includes workspace snapshot with panels array, layout, and viewport dimensions', () => {
    const intent = makeIntent();
    const snapshot = makeSnapshot();

    const result = serializeForClaude(intent, snapshot);
    const parsed: SerializedContext = JSON.parse(result);

    expect(parsed.workspace.panels).toHaveLength(2);
    expect(parsed.workspace.panels[0]).toEqual({
      type: 'scene-editor',
      role: 'primary',
      density: 'full',
    });
    expect(parsed.workspace.layout).toBe('split-2');
    expect(parsed.workspace.viewport).toEqual({ width: 1920, height: 1080 });
  });

  it('includes optional entities when provided', () => {
    const intent = makeIntent();
    const snapshot = makeSnapshot();
    const entities = {
      selectedProject: 'proj-123',
      selectedAct: 'act-1',
      selectedScene: 'scene-42',
    };

    const result = serializeForClaude(intent, snapshot, entities);
    const parsed: SerializedContext = JSON.parse(result);

    expect(parsed.entities).toEqual({
      selectedProject: 'proj-123',
      selectedAct: 'act-1',
      selectedScene: 'scene-42',
    });
  });

  it('omits entities block when no entities provided', () => {
    const intent = makeIntent();
    const snapshot = makeSnapshot();

    const result = serializeForClaude(intent, snapshot);
    const parsed: SerializedContext = JSON.parse(result);

    expect(parsed.entities).toBeUndefined();
  });

  it('round-trip: JSON.parse produces object matching SerializedContext shape', () => {
    const intent = makeIntent({
      id: 'intent-round-trip',
      type: 'navigate',
      payload: { action: 'focus', panelId: 'panel-1' } as never,
      source: 'keyboard',
    });
    const snapshot = makeSnapshot({
      panels: [{ type: 'story-map', role: 'primary', density: 'full' }],
      layout: 'single',
      focusedPanel: 'panel-1',
      viewport: { width: 1280, height: 720 },
    });
    const entities = { selectedProject: 'proj-456' };

    const result = serializeForClaude(intent, snapshot, entities);
    const parsed: SerializedContext = JSON.parse(result);

    // Verify full structure
    expect(parsed).toHaveProperty('intent');
    expect(parsed).toHaveProperty('workspace');
    expect(parsed).toHaveProperty('entities');

    expect(parsed.intent.id).toBe('intent-round-trip');
    expect(parsed.intent.type).toBe('navigate');
    expect(parsed.workspace.focusedPanel).toBe('panel-1');
    expect(parsed.workspace.layout).toBe('single');
    expect(parsed.entities?.selectedProject).toBe('proj-456');
  });

  it('includes focusedPanel in workspace when provided', () => {
    const intent = makeIntent();
    const snapshot = makeSnapshot({ focusedPanel: 'panel-focused' });

    const result = serializeForClaude(intent, snapshot);
    const parsed: SerializedContext = JSON.parse(result);

    expect(parsed.workspace.focusedPanel).toBe('panel-focused');
  });

  it('handles partial entities (only some fields)', () => {
    const intent = makeIntent();
    const snapshot = makeSnapshot();
    const entities = { selectedProject: 'proj-789' };

    const result = serializeForClaude(intent, snapshot, entities);
    const parsed: SerializedContext = JSON.parse(result);

    expect(parsed.entities?.selectedProject).toBe('proj-789');
    expect(parsed.entities?.selectedAct).toBeUndefined();
    expect(parsed.entities?.selectedScene).toBeUndefined();
  });
});
