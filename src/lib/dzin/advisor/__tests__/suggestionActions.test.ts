import { describe, it, expect, vi } from 'vitest';
import {
  parseComposeOnAccept,
  buildComposeSuggestionIntent,
  applyComposeSuggestion,
  summarizeSuggestion,
} from '../suggestionActions';
import type { SuggestedCompose } from '@/lib/dzin/core/chat';
import type { PanelDirective } from '@/lib/dzin/core/layout/types';
import type { IntentBus } from '@/lib/dzin/core/intent';

describe('parseComposeOnAccept', () => {
  it('parses a valid JSON string into a SuggestedCompose', () => {
    const result = parseComposeOnAccept(
      '{"action":"replace","panels":[{"type":"arpg-combat-core","role":"primary"}],"layout":"split-2"}',
    );
    expect(result).toEqual({
      action: 'replace',
      panels: [{ type: 'arpg-combat-core', role: 'primary', density: undefined }],
      layout: 'split-2',
    });
  });

  it('accepts an already-parsed object', () => {
    const result = parseComposeOnAccept({
      action: 'show',
      panels: [{ type: 'arpg-combat-effects' }],
    });
    expect(result?.action).toBe('show');
    expect(result?.panels).toHaveLength(1);
    expect(result?.layout).toBeUndefined();
  });

  it('accepts a nested JSON-string panels array', () => {
    const result = parseComposeOnAccept({
      action: 'replace',
      panels: '[{"type":"arpg-combat-tags"}]',
    });
    expect(result?.panels).toEqual([{ type: 'arpg-combat-tags', role: undefined, density: undefined }]);
  });

  it('defaults a missing action to replace', () => {
    const result = parseComposeOnAccept({ panels: [{ type: 'arpg-combat-core' }] });
    expect(result?.action).toBe('replace');
  });

  it('returns null for null / empty / undefined input', () => {
    expect(parseComposeOnAccept(null)).toBeNull();
    expect(parseComposeOnAccept(undefined)).toBeNull();
    expect(parseComposeOnAccept('')).toBeNull();
    expect(parseComposeOnAccept('   ')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseComposeOnAccept('{not json')).toBeNull();
  });

  it('returns null for an unknown action', () => {
    expect(parseComposeOnAccept('{"action":"explode","panels":[{"type":"x"}]}')).toBeNull();
  });

  it('returns null for a non-clear action with no panels', () => {
    expect(parseComposeOnAccept('{"action":"replace","panels":[]}')).toBeNull();
    expect(parseComposeOnAccept('{"action":"show"}')).toBeNull();
  });

  it('allows clear with no panels', () => {
    const result = parseComposeOnAccept('{"action":"clear"}');
    expect(result).toEqual({ action: 'clear', panels: [], layout: undefined });
  });

  it('drops an unknown layout but keeps the rest', () => {
    const result = parseComposeOnAccept('{"action":"replace","panels":[{"type":"x"}],"layout":"bogus"}');
    expect(result?.layout).toBeUndefined();
    expect(result?.action).toBe('replace');
  });

  it('ignores malformed panel entries', () => {
    const result = parseComposeOnAccept({
      action: 'replace',
      panels: [{ type: 'arpg-combat-core' }, { role: 'primary' }, 42, null],
    });
    expect(result?.panels).toEqual([{ type: 'arpg-combat-core', role: undefined, density: undefined }]);
  });
});

describe('buildComposeSuggestionIntent', () => {
  const current = {
    directives: [
      { type: 'arpg-combat-core', role: 'primary' },
      { type: 'arpg-combat-abilities', role: 'secondary' },
    ] as PanelDirective[],
    template: 'split-2' as const,
  };

  it('builds an apply-preset intent with replace semantics', () => {
    const compose: SuggestedCompose = {
      action: 'replace',
      panels: [{ type: 'arpg-combat-effects' }, { type: 'arpg-combat-damage-calc' }],
      layout: 'grid-4',
    };
    const intent = buildComposeSuggestionIntent(compose, current);

    expect(intent.type).toBe('compose');
    expect(intent.source).toBe('click');
    expect(intent.payload).toMatchObject({
      action: 'apply-preset',
      template: 'grid-4',
      panels: [
        { type: 'arpg-combat-effects', role: undefined, density: undefined },
        { type: 'arpg-combat-damage-calc', role: undefined, density: undefined },
      ],
    });
  });

  it('falls back to the current template when layout is omitted', () => {
    const intent = buildComposeSuggestionIntent(
      { action: 'replace', panels: [{ type: 'arpg-combat-effects' }] },
      current,
    );
    expect((intent.payload as { template: string }).template).toBe('split-2');
  });

  it('merges (deduped) panels for the show action', () => {
    const intent = buildComposeSuggestionIntent(
      { action: 'show', panels: [{ type: 'arpg-combat-core' }, { type: 'arpg-combat-tags' }] },
      current,
    );
    const types = (intent.payload as { panels: PanelDirective[] }).panels.map((d) => d.type);
    expect(types).toEqual(['arpg-combat-core', 'arpg-combat-abilities', 'arpg-combat-tags']);
  });

  it('removes panels for the hide action', () => {
    const intent = buildComposeSuggestionIntent(
      { action: 'hide', panels: [{ type: 'arpg-combat-abilities' }] },
      current,
    );
    const types = (intent.payload as { panels: PanelDirective[] }).panels.map((d) => d.type);
    expect(types).toEqual(['arpg-combat-core']);
  });

  it('produces an empty panel set for the clear action', () => {
    const intent = buildComposeSuggestionIntent({ action: 'clear', panels: [] }, current);
    expect((intent.payload as { panels: PanelDirective[] }).panels).toEqual([]);
  });
});

describe('applyComposeSuggestion', () => {
  it('dispatches a compose intent through the bus', () => {
    const dispatch = vi.fn();
    const bus = { dispatch, subscribe: vi.fn(), getSnapshot: vi.fn() } as unknown as IntentBus;

    applyComposeSuggestion(
      { action: 'replace', panels: [{ type: 'arpg-combat-core' }], layout: 'single' },
      { bus, currentDirectives: [], currentTemplate: 'split-2' },
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    const intent = dispatch.mock.calls[0][0];
    expect(intent.type).toBe('compose');
    expect(intent.payload.action).toBe('apply-preset');
    expect(intent.payload.template).toBe('single');
  });
});

describe('summarizeSuggestion', () => {
  it('summarizes each action with panel count and layout', () => {
    expect(summarizeSuggestion({ action: 'replace', panels: [{ type: 'a' }, { type: 'b' }], layout: 'grid-4' }))
      .toBe('Replace with 2 panels · grid-4');
    expect(summarizeSuggestion({ action: 'show', panels: [{ type: 'a' }] }))
      .toBe('Add 1 panel');
    expect(summarizeSuggestion({ action: 'hide', panels: [{ type: 'a' }, { type: 'b' }] }))
      .toBe('Hide 2 panels');
    expect(summarizeSuggestion({ action: 'clear', panels: [] }))
      .toBe('Clear all panels');
  });
});
