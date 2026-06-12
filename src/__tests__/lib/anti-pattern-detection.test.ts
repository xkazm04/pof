import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db.
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { getDb } from '@/lib/db';
import {
  ensureAntiPatternTable,
  upsertAntiPattern,
  getAllAntiPatterns,
  getAntiPatternsByModule,
  checkPromptForAntiPatterns,
} from '@/lib/pattern-library-db';
import type { AntiPattern } from '@/types/pattern-library';

function antiPattern(overrides: Partial<AntiPattern> = {}): AntiPattern {
  return {
    id: 'anti--arpg-gas--inheritance',
    title: 'Inheritance in GAS',
    moduleId: 'arpg-gas' as AntiPattern['moduleId'],
    category: 'gas-integration',
    tags: ['inheritance', 'gas'],
    description: 'Inheritance-based GAS fails because UGameplayAbility expects composition.',
    approach: 'inheritance',
    failureRate: 0.85,
    sessionCount: 8,
    severity: 'critical',
    triggerKeywords: ['subclass', 'override', 'base class', 'inheritance'],
    alternative: {
      approach: 'gas-ability',
      successRate: 0.92,
      title: 'GAS Ability via Composition',
      examplePrompt:
        'Build a UGameplayAbility subclass that uses composition with AbilityTask helpers — no shared base class.',
    },
    firstSeenAt: '2026-05-01T00:00:00Z',
    lastFailedAt: '2026-05-20T00:00:00Z',
    examplePrompt: 'Make every ability subclass our base UMyAbility…',
    ...overrides,
  };
}

beforeEach(() => {
  ensureAntiPatternTable();
  getDb().exec('DELETE FROM anti_patterns');
});

describe('anti-pattern detection', () => {
  it('round-trips alternative.examplePrompt through DB JSON storage', () => {
    upsertAntiPattern(antiPattern());

    const all = getAllAntiPatterns();
    expect(all).toHaveLength(1);
    expect(all[0].alternative?.examplePrompt).toMatch(/composition with AbilityTask helpers/);
    expect(all[0].alternative?.approach).toBe('gas-ability');
    expect(all[0].alternative?.successRate).toBeCloseTo(0.92);
  });

  it('checkPromptForAntiPatterns matches by triggerKeywords + scores by match density', () => {
    upsertAntiPattern(antiPattern());

    // A prompt that hits >= 30% of trigger keywords should fire.
    // The matcher needs ceil(0.3 * 4) = 2 keywords minimum (30% of 4).
    const hitting = 'I want to subclass the base class and override the activation logic.';
    const warnings = checkPromptForAntiPatterns(hitting, 'arpg-gas' as AntiPattern['moduleId']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].antiPattern.id).toBe('anti--arpg-gas--inheritance');
    expect(warnings[0].matchScore).toBeGreaterThanOrEqual(30);
    expect(warnings[0].message).toContain('85%');
    expect(warnings[0].message).toContain('92%');

    // A prompt with no keyword overlap should NOT fire.
    const clean = 'Generate a level streaming subsystem for chunked open-world loading.';
    const noWarnings = checkPromptForAntiPatterns(clean, 'arpg-gas' as AntiPattern['moduleId']);
    expect(noWarnings).toHaveLength(0);
  });

  it('scopes warnings by moduleId when one is provided', () => {
    upsertAntiPattern(antiPattern());
    upsertAntiPattern(
      antiPattern({
        id: 'anti--arpg-character--inheritance',
        moduleId: 'arpg-character' as AntiPattern['moduleId'],
        title: 'Inheritance in Character',
      }),
    );

    // Warnings for arpg-gas should only contain the GAS row, not character.
    const gasWarnings = checkPromptForAntiPatterns(
      'I want to subclass the base class and override the activation logic.',
      'arpg-gas' as AntiPattern['moduleId'],
    );
    expect(gasWarnings.map((w) => w.antiPattern.moduleId)).toEqual(['arpg-gas']);

    // No moduleId → both modules considered.
    const allWarnings = checkPromptForAntiPatterns(
      'I want to subclass the base class and override the activation logic.',
    );
    const ids = allWarnings.map((w) => w.antiPattern.id).sort();
    expect(ids).toEqual([
      'anti--arpg-character--inheritance',
      'anti--arpg-gas--inheritance',
    ]);
  });

  it('matches multi-word trigger keywords and plural forms (25d6de5 regression)', () => {
    upsertAntiPattern(
      antiPattern({
        id: 'anti--animations--state-machine',
        moduleId: 'animations' as AntiPattern['moduleId'],
        title: 'State machine approach',
        approach: 'state-machine',
        triggerKeywords: ['state machine', 'fsm', 'transition', 'state graph', 'behavior tree'],
      }),
    );

    // The textbook prompt for this anti-pattern: 'state machine' is a phrase
    // keyword and 'transitions' is a plural — under exact single-token matching
    // neither counted and the guardrail never fired.
    const warnings = checkPromptForAntiPatterns(
      'Implement a state machine for dialogue with transitions between idle and talking.',
      'animations' as AntiPattern['moduleId'],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].antiPattern.id).toBe('anti--animations--state-machine');
    expect(warnings[0].matchScore).toBeGreaterThanOrEqual(30);
  });

  it('getAntiPatternsByModule orders by failure rate', () => {
    upsertAntiPattern(antiPattern({ id: 'low', failureRate: 0.7, severity: 'medium' }));
    upsertAntiPattern(antiPattern({ id: 'high', failureRate: 0.95 }));
    upsertAntiPattern(antiPattern({ id: 'mid', failureRate: 0.8 }));

    const list = getAntiPatternsByModule('arpg-gas' as AntiPattern['moduleId']);
    expect(list.map((ap) => ap.id)).toEqual(['high', 'mid', 'low']);
  });
});
