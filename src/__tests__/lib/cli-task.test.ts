import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskFactory,
  extractCallbackPayload,
  registerCallback,
  getCallback,
  removeCallback,
} from '@/lib/cli-task';

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
});
