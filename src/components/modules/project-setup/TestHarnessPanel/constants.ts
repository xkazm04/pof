import type {
  PofTestSpec, PofTestAction, PofAssertion, PofSpawnEntry,
} from '@/types/pof-bridge';

// ── Default templates ────────────────────────────────────────────────────────

export const DEFAULT_SPAWN: PofSpawnEntry = {
  spawn: '/Game/Blueprints/BP_TestActor.BP_TestActor_C',
  tag: 'TestActor',
  location: [0, 0, 100],
  rotation: [0, 0, 0],
};

export const DEFAULT_ASSERTION: PofAssertion = {
  id: 'assert-1',
  target: 'TestActor',
  property: 'Health',
  operator: 'greaterThan',
  expected: 0,
  description: 'Actor should have positive health',
};

export const DEFAULT_ACTION: PofTestAction = {
  type: 'wait',
  duration: 1.0,
  reason: 'Wait for initialization',
};

export const TEMPLATE_SCENARIO: PofTestSpec = {
  testId: 'test-basic-spawn',
  description: 'Spawn actor and verify initial state',
  timeout: 30,
  setup: [DEFAULT_SPAWN],
  actions: [DEFAULT_ACTION],
  assertions: [DEFAULT_ASSERTION],
  cleanup: 'destroyAll',
};
