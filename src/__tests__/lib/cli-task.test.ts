import { describe, it, expect } from 'vitest';
import {
  TaskFactory,
  extractCallbackPayload,
  parseCallbackMarker,
  registerCallback,
  getCallback,
  removeCallback,
} from '@/lib/cli-task';
import { CALLBACK_MARKER_FIXTURE } from '@/__tests__/fixtures/callbackMarker';

describe('TaskFactory', () => {
  describe('checklist', () => {
    it('creates a checklist task with correct type and fields', () => {
      const task = TaskFactory.checklist('arpg-combat', 'hit-detect', 'Do the thing', 'Combat', 'http://localhost:3000');
      expect(task.type).toBe('checklist');
      expect(task.moduleId).toBe('arpg-combat');
      expect(task.itemId).toBe('hit-detect');
      expect(task.prompt).toBe('Do the thing');
      expect(task.label).toBe('Combat');
      expect(task.appOrigin).toBe('http://localhost:3000');
    });
  });

  describe('quickAction', () => {
    it('creates a quick-action task', () => {
      const task = TaskFactory.quickAction('arpg-inventory', 'Check loot tables', 'Inventory');
      expect(task.type).toBe('quick-action');
      expect(task.moduleId).toBe('arpg-inventory');
      expect(task.prompt).toBe('Check loot tables');
      expect(task.label).toBe('Inventory');
    });
  });

  describe('askClaude', () => {
    it('creates an ask-claude task', () => {
      const task = TaskFactory.askClaude('animations', 'How do blend spaces work?', 'Animations');
      expect(task.type).toBe('ask-claude');
      expect(task.moduleId).toBe('animations');
      expect(task.prompt).toBe('How do blend spaces work?');
    });
  });

  describe('featureFix', () => {
    it('creates a feature-fix task with all metadata', () => {
      const task = TaskFactory.featureFix(
        'arpg-combat',
        {
          featureName: 'Hit detection',
          status: 'partial',
          nextSteps: 'Add TSet dedup',
          filePaths: ['Source/Combat/HitDetect.h'],
          qualityScore: 3,
        },
        'Combat',
        'http://localhost:3000',
      );
      expect(task.type).toBe('feature-fix');
      expect(task.featureName).toBe('Hit detection');
      expect(task.status).toBe('partial');
      expect(task.filePaths).toEqual(['Source/Combat/HitDetect.h']);
      expect(task.qualityScore).toBe(3);
      expect(task.prompt).toBe('Add TSet dedup');
    });
  });

  describe('featureReview', () => {
    it('creates a feature-review task with empty prompt (assembled later)', () => {
      const features = [
        { featureName: 'ASC', category: 'Core', description: 'Ability system' },
      ];
      const task = TaskFactory.featureReview('arpg-gas', 'GAS', features, 'http://localhost:3000', 'GAS Review');
      expect(task.type).toBe('feature-review');
      expect(task.prompt).toBe('');
      expect(task.features).toHaveLength(1);
      expect(task.moduleLabel).toBe('GAS');
    });
  });
});

describe('Callback system', () => {
  describe('registerCallback / getCallback / removeCallback', () => {
    it('registers and retrieves a callback', () => {
      const id = registerCallback({
        url: '/api/test',
        method: 'POST',
        staticFields: { moduleId: 'arpg-combat' },
        schemaHint: '"completed": true',
      });
      expect(id).toMatch(/^cb-/);
      const cb = getCallback(id);
      expect(cb).toBeDefined();
      expect(cb!.url).toBe('/api/test');
      expect(cb!.staticFields).toEqual({ moduleId: 'arpg-combat' });
    });

    it('removes a callback', () => {
      const id = registerCallback({
        url: '/api/test',
        method: 'POST',
        staticFields: {},
        schemaHint: '',
      });
      removeCallback(id);
      expect(getCallback(id)).toBeUndefined();
    });
  });

  describe('extractCallbackPayload', () => {
    it('extracts callback id and payload from text', () => {
      const text = `Some output\n@@CALLBACK:cb-123-1\n{"completed": true}\n@@END_CALLBACK\nMore text`;
      const result = extractCallbackPayload(text);
      expect(result).not.toBeNull();
      expect(result!.callbackId).toBe('cb-123-1');
      expect(result!.payload).toBe('{"completed": true}');
    });

    it('returns null when no callback marker is present', () => {
      const result = extractCallbackPayload('Just regular text output');
      expect(result).toBeNull();
    });

    it('handles multiline JSON payloads', () => {
      const text = `@@CALLBACK:cb-456-2\n{\n  "status": "done",\n  "count": 5\n}\n@@END_CALLBACK`;
      const result = extractCallbackPayload(text);
      expect(result).not.toBeNull();
      expect(result!.callbackId).toBe('cb-456-2');
      expect(JSON.parse(result!.payload)).toEqual({ status: 'done', count: 5 });
    });
  });

  // The shared marker parser is the single source of truth for the wire format,
  // consumed by BOTH the client terminal (extractCallbackPayload) and the
  // server-side awaitCallback (cli-service). These tests pin that one format.
  describe('parseCallbackMarker', () => {
    it('parses id, raw payload, and JSON data from the shared fixture', () => {
      const marker = parseCallbackMarker(CALLBACK_MARKER_FIXTURE.text);
      expect(marker).not.toBeNull();
      expect(marker!.callbackId).toBe(CALLBACK_MARKER_FIXTURE.callbackId);
      expect(marker!.payload).toBe(CALLBACK_MARKER_FIXTURE.payload);
      expect(marker!.data).toEqual(CALLBACK_MARKER_FIXTURE.data);
    });

    it('feeds both consumer shapes from one parse of the same fixture', () => {
      // Client terminal shape (raw payload, re-parsed by resolveCallback).
      const client = extractCallbackPayload(CALLBACK_MARKER_FIXTURE.text);
      expect(client).toEqual({
        callbackId: CALLBACK_MARKER_FIXTURE.callbackId,
        payload: CALLBACK_MARKER_FIXTURE.payload,
      });
      // Server-side awaitCallback shape (the parsed object).
      expect(parseCallbackMarker(CALLBACK_MARKER_FIXTURE.text)!.data).toEqual(
        CALLBACK_MARKER_FIXTURE.data,
      );
    });

    it('accepts non-cb- callback ids (e.g. the one-shot step- markers)', () => {
      const marker = parseCallbackMarker('@@CALLBACK:step-1717000000000\n{}\n@@END_CALLBACK');
      expect(marker).not.toBeNull();
      expect(marker!.callbackId).toBe('step-1717000000000');
      expect(marker!.data).toEqual({});
    });

    it('returns null when no marker is present', () => {
      expect(parseCallbackMarker('Just regular text output')).toBeNull();
    });

    it('returns the marker with data:null on malformed JSON', () => {
      const marker = parseCallbackMarker('@@CALLBACK:cb-1-1\n{ not json }\n@@END_CALLBACK');
      expect(marker).not.toBeNull();
      expect(marker!.data).toBeNull();
      expect(marker!.payload).toBe('{ not json }');
    });
  });
});
