import { describe, it, expect } from 'vitest';
import { createDirector, NEEDS_LLM } from '../director';
import type { Intent, IntentResult } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIntent(
  type: Intent['type'],
  payload: Intent['payload'] = { action: 'undo' } as never,
): Intent {
  return {
    id: 'test-1',
    type,
    payload,
    source: 'click',
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Director Tests
// ---------------------------------------------------------------------------

describe('createDirector', () => {
  it('returns needs-llm for all intents when no handlers registered', () => {
    const director = createDirector();
    const result = director.resolve(makeIntent('compose', { action: 'open', panelType: 'foo' }));
    expect(result.status).toBe('needs-llm');
  });

  it('resolves compose intent locally when handler registered', () => {
    const composeHandler = (_intent: Intent): IntentResult => ({
      status: 'resolved',
      patches: [{ op: 'add', path: '/panels/-', value: { type: 'scene-editor' } }],
      origin: 'user',
      description: 'Open scene editor',
    });

    const director = createDirector({ compose: composeHandler });
    const result = director.resolve(makeIntent('compose', { action: 'open', panelType: 'scene-editor' }));
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.patches).toHaveLength(1);
      expect(result.description).toBe('Open scene editor');
    }
  });

  it('returns needs-llm when handler returns NEEDS_LLM sentinel', () => {
    const handler = () => NEEDS_LLM;
    const director = createDirector({ compose: handler });
    const result = director.resolve(makeIntent('compose', { action: 'swap' }));
    expect(result.status).toBe('needs-llm');
    if (result.status === 'needs-llm') {
      expect(result.intent.type).toBe('compose');
    }
  });

  it('returns error when handler returns error result', () => {
    const handler = (): IntentResult => ({
      status: 'error',
      error: 'Unknown panel type',
    });
    const director = createDirector({ compose: handler });
    const result = director.resolve(makeIntent('compose', { action: 'open', panelType: 'nope' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toBe('Unknown panel type');
    }
  });

  it('registerHandler dynamically adds a new handler', () => {
    const director = createDirector();

    // Before registering, falls through to needs-llm
    expect(director.resolve(makeIntent('system', { action: 'undo' })).status).toBe('needs-llm');

    // Register handler
    director.registerHandler('system', () => ({
      status: 'resolved',
      patches: [],
      origin: 'user',
      description: 'undo',
    }));

    // Now resolves locally
    const result = director.resolve(makeIntent('system', { action: 'undo' }));
    expect(result.status).toBe('resolved');
  });
});
