# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`, `beforeEach`)

**Run Commands:**
```bash
npm run test              # Run all tests (vitest run)
npm run test:watch        # Watch mode (vitest)
npm run validate          # Full CI: typecheck + lint + test
npx vitest run src/__tests__/stores/moduleStore.test.ts  # Single file
```

## Test File Organization

**Location:**
- Centralized in `src/__tests__/` directory (not co-located with source)
- Mirrors source directory structure within `__tests__/`

**Naming:**
- `{module-name}.test.ts` (never `.spec.ts`)

**Structure:**
```
src/__tests__/
├── setup.ts                              # Shared test utilities (auto-loaded)
├── lib/
│   ├── api-utils.test.ts                 # Tests for src/lib/api-utils.ts
│   ├── cli-task.test.ts                  # Tests for src/lib/cli-task.ts
│   ├── feature-definitions.test.ts       # Tests for src/lib/feature-definitions.ts
│   ├── module-registration.test.ts       # Tests for src/lib/module-registry.ts
│   ├── nba-engine.test.ts               # Tests for src/lib/nba-engine.ts
│   ├── ue5-import-templates.test.ts      # Tests for src/lib/visual-gen/ue5-import-templates.ts
│   └── generators/
│       ├── dungeon.test.ts               # Tests for src/lib/visual-gen/generators/dungeon.ts
│       ├── terrain.test.ts               # Tests for src/lib/visual-gen/generators/terrain.ts
│       └── vegetation.test.ts            # Tests for src/lib/visual-gen/generators/vegetation.ts
└── stores/
    ├── assetBrowserStore.test.ts          # Tests for component-local store
    ├── blenderStore.test.ts              # Tests for component-local store
    ├── forgeStore.test.ts                # Tests for component-local store
    ├── materialStore.test.ts             # Tests for component-local store
    ├── moduleStore.test.ts               # Tests for src/stores/moduleStore.ts
    ├── proceduralStore.test.ts           # Tests for component-local store
    ├── projectStore.test.ts              # Tests for src/stores/projectStore.ts
    └── viewerStore.test.ts              # Tests for component-local store
```

## Test Setup

**Setup file:** `src/__tests__/setup.ts` (auto-loaded via `vitest.config.ts` `setupFiles`)

**Provides three utilities:**

1. **localStorage mock** (required by Zustand persist middleware):
```typescript
// Installed globally if not present
const localStorageMock = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v; },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => { /* clears all */ },
  get length() { return Object.keys(storage).length; },
  key: (i: number) => Object.keys(storage)[i] ?? null,
};
```

2. **Fetch mock factory** (`mockFetch`):
```typescript
import { mockFetch } from '../setup';

// Default: returns { success: true, data: {} }
mockFetch();

// Custom response:
mockFetch({ body: { success: true, data: [1, 2, 3] } });

// Error response:
mockFetch({ body: { success: false, error: 'Not found' }, status: 404 });
```

3. **Route-based fetch mock** (`mockFetchRoutes`):
```typescript
import { mockFetchRoutes } from '../setup';

mockFetchRoutes([
  { match: '/api/recent-projects', response: { body: { success: true, data: projects } } },
  { match: '/api/project-progress', response: { body: { success: true, data: {} } } },
]);
// Unmatched URLs return 404 automatically
```

4. **Store reset helper** (`resetStoreBeforeEach`):
```typescript
import { resetStoreBeforeEach } from '../setup';
resetStoreBeforeEach(useMyStore, { count: 0, items: [] });
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useModuleStore } from '@/stores/moduleStore';

describe('useModuleStore', () => {
  beforeEach(() => {
    useModuleStore.setState({
      moduleHistory: {},
      moduleHealth: {},
      checklistProgress: {},
    });
  });

  describe('setChecklistItem', () => {
    it('sets an item to checked', () => {
      useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
      const progress = useModuleStore.getState().checklistProgress;
      expect(progress['arpg-combat']?.['hit-detection']).toBe(true);
    });

    it('returns same state when value already matches', () => {
      // ... test no-op optimization
    });
  });
});
```

**Patterns:**
- Group related tests with nested `describe` blocks (feature or method name)
- `beforeEach` resets store state via `store.setState({...})` with partial initial state
- No `afterEach` cleanup needed (Zustand stores are singletons, reset handles state)
- Import from `vitest` directly, not from test utils

**Test naming:**
- Use descriptive, present-tense phrases: `'sets an item to checked'`, `'returns empty array for a module with no checklist'`
- Start with the action verb: `'toggles unchecked to checked'`, `'generates at least one room'`, `'handles glTF format differently from FBX'`

## Mocking

**Framework:** Vitest built-in (`vi.fn()`, `vi.mock()`)

**Fetch mocking pattern:**
```typescript
import { mockFetch } from '../setup';

beforeEach(() => {
  mockFetch(); // installs global fetch mock
});

it('passes RequestInit options to fetch', async () => {
  const fetchMock = mockFetch({ body: { success: true, data: null } });
  await apiFetch('/api/test', { method: 'POST', body: '{"x":1}' });
  expect(fetchMock).toHaveBeenCalledWith('/api/test', expect.objectContaining({
    method: 'POST',
    body: '{"x":1}',
  }));
});
```

**Network error mocking:**
```typescript
it('throws when fetch itself rejects', async () => {
  globalThis.fetch = (() => Promise.reject(new Error('Network failure'))) as unknown as typeof fetch;
  await expect(apiFetch('/api/test')).rejects.toThrow('Network failure');
});
```

**Intercept pattern (checking intermediate state):**
```typescript
it('sets isScanning during scan', async () => {
  let isScanning = false;
  mockFetch({ body: { success: true, data: scanData } });

  const origFetch = globalThis.fetch;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    isScanning = useProjectStore.getState().isScanning;  // read state mid-flight
    return origFetch(...args);
  }) as typeof fetch;

  await useProjectStore.getState().scanProject();
  expect(isScanning).toBe(true);
  expect(useProjectStore.getState().isScanning).toBe(false);
});
```

**What to Mock:**
- `globalThis.fetch` for API calls (via `mockFetch` / `mockFetchRoutes`)
- `localStorage` (provided by setup file automatically)
- External services / network calls

**What NOT to Mock:**
- Zustand stores (test via `.getState()` / `.setState()` directly)
- Pure library functions (test with real inputs/outputs)
- Module registry data (test against actual registry)

## Fixtures and Factories

**Test Data:**
- Inline object literals for simple test data:
```typescript
const entry = {
  id: 't1',
  moduleId: 'arpg-combat' as const,
  prompt: 'Test',
  timestamp: Date.now(),
  status: 'completed' as const,
};
```
- `DEFAULT_*_CONFIG` constants imported from source for generator tests:
```typescript
import { DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';
const result = generateDungeon({ ...DEFAULT_DUNGEON_CONFIG, width: 32, height: 32 });
```
- `MOCK_RESULT` const for reusable mock data within a test file:
```typescript
const MOCK_RESULT: AssetSearchResult = {
  id: 'brick-wall-01',
  name: 'Brick Wall',
  source: 'polyhaven',
  // ...
};
```

**Location:**
- No dedicated fixtures directory. Test data is defined inline in each test file.
- Shared utilities (mocks, helpers) live in `src/__tests__/setup.ts`.

## Coverage

**Requirements:** No coverage threshold enforced. No coverage config in vitest.config.ts.

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- All 17 test files are unit tests
- Test pure functions, store actions, and utility modules in isolation
- No DOM rendering or component tests

**Store Tests (8 files):**
- Test Zustand store actions via `store.getState().action()` and `store.getState().field`
- Reset state via `store.setState({...})` in `beforeEach`
- Verify state transitions, edge cases, and no-op optimizations
- Files: `src/__tests__/stores/{moduleStore,projectStore,forgeStore,blenderStore,materialStore,viewerStore,proceduralStore,assetBrowserStore}.test.ts`

**Library Tests (9 files):**
- Test pure functions and exported utilities
- Verify output shapes, boundary conditions, determinism, and error handling
- Files: `src/__tests__/lib/{api-utils,cli-task,feature-definitions,nba-engine,module-registration,ue5-import-templates}.test.ts` and `src/__tests__/lib/generators/{dungeon,terrain,vegetation}.test.ts`

**Integration Tests:**
- Not present. No tests exercise multiple layers together (e.g., API route + DB + store).

**E2E Tests:**
- Not present. No Playwright, Cypress, or similar framework configured.

**Component Tests:**
- Not present. No React component rendering tests (no `@testing-library/react` in dependencies).

## Common Patterns

**Zustand Store Testing (most common pattern):**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useMyStore } from '@/stores/myStore';

describe('useMyStore', () => {
  beforeEach(() => {
    useMyStore.setState({
      field1: defaultValue1,
      field2: defaultValue2,
    });
  });

  it('action updates state correctly', () => {
    useMyStore.getState().someAction(arg);
    expect(useMyStore.getState().field1).toBe(expectedValue);
  });

  it('does not affect unrelated state', () => {
    useMyStore.getState().someAction(arg);
    expect(useMyStore.getState().field2).toBe(defaultValue2);
  });
});
```

**Async Testing:**
```typescript
it('returns unwrapped data on success', async () => {
  mockFetch({ body: { success: true, data: { id: 1 } } });
  const result = await apiFetch<{ id: number }>('/api/test');
  expect(result).toEqual({ id: 1 });
});

it('throws on error response', async () => {
  mockFetch({ body: { success: false, error: 'Not found' }, status: 404 });
  await expect(apiFetch('/api/test')).rejects.toThrow('Not found');
});
```

**Result Type Testing:**
```typescript
it('returns ok result on success', async () => {
  mockFetch({ body: { success: true, data: [1, 2, 3] } });
  const result = await tryApiFetch<number[]>('/api/test');
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data).toEqual([1, 2, 3]);
  }
});

it('returns err result on API error', async () => {
  mockFetch({ body: { success: false, error: 'Bad request' }, status: 400 });
  const result = await tryApiFetch('/api/test');
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toBe('Bad request');
  }
});
```

**Determinism / Seed Testing (generators):**
```typescript
it('is deterministic for the same seed', () => {
  const config = { ...DEFAULT_CONFIG, seed: 77 };
  const a = generate(config);
  const b = generate(config);
  expect(a).toEqual(b);
});

it('produces different results for different seeds', () => {
  const a = generate({ ...DEFAULT_CONFIG, seed: 1 });
  const b = generate({ ...DEFAULT_CONFIG, seed: 2 });
  expect(/* some difference */).toBe(true);
});
```

**Boundary / Constraint Testing:**
```typescript
it('rooms respect min/max size constraints', () => {
  const config = { ...DEFAULT_DUNGEON_CONFIG, minRoomSize: 4, maxRoomSize: 8 };
  const result = generateDungeon(config);
  for (const room of result.rooms) {
    expect(room.width).toBeGreaterThanOrEqual(config.minRoomSize);
    expect(room.width).toBeLessThanOrEqual(config.maxRoomSize);
  }
});
```

**No-Op / Idempotency Testing:**
```typescript
it('returns same state when value already matches', () => {
  useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
  const before = useModuleStore.getState();
  useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
  const after = useModuleStore.getState();
  expect(before.checklistProgress).toBe(after.checklistProgress); // referential equality
});
```

## Adding New Tests

**New store test:**
1. Create `src/__tests__/stores/{storeName}.test.ts`
2. Import store and vitest utilities
3. Reset store in `beforeEach` via `store.setState({...})`
4. Test each action method in its own `describe` block
5. Include edge cases: empty state, no-op, boundary values

**New library test:**
1. Create `src/__tests__/lib/{module-name}.test.ts`
2. Import the functions under test using `@/` path alias
3. Test with real inputs/outputs (no mocking of internal dependencies)
4. For generators: test determinism, bounds, constraints, valid output shapes

**New API-related test:**
1. Use `mockFetch` or `mockFetchRoutes` from setup
2. Test success path, error path, and network failure
3. Verify the API envelope unwrapping behavior

---

*Testing analysis: 2026-03-14*
