# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` (e.g., `FetchError.tsx`, `QuickActionsPanel.tsx`, `ReviewableModuleView.tsx`)
- Hooks: camelCase with `use` prefix `.ts` (e.g., `useModuleCLI.ts`, `useSuspend.ts`, `useCRUD.ts`)
- Stores: camelCase with `Store` suffix `.ts` (e.g., `moduleStore.ts`, `evaluatorStore.ts`, `ue5BridgeStore.ts`)
- Library/utility modules: kebab-case `.ts` (e.g., `api-utils.ts`, `chart-colors.ts`, `event-bus.ts`, `cli-task.ts`)
- Type definition files: kebab-case `.ts` in `src/types/` (e.g., `modules.ts`, `result.ts`, `event-bus.ts`, `ue5-bridge.ts`)
- Test files: `{module-name}.test.ts` mirroring the source structure under `src/__tests__/`
- API routes: `route.ts` inside a kebab-case directory matching the endpoint (e.g., `src/app/api/recent-projects/route.ts`)

**Functions:**
- Use camelCase for all functions: `apiFetch`, `buildTaskPrompt`, `computeBlockers`
- Factory functions: PascalCase on the noun (e.g., `TaskFactory.checklist()`, `createLifecycle()`, `createSimpleModuleView()`)
- Boolean getters/checkers: prefix with `is`/`has` (e.g., `isActive()`, `isBlocked`)
- Store actions: verb-first camelCase (e.g., `setChecklistItem`, `addHistoryEntry`, `toggleGrid`)

**Variables:**
- Use camelCase for local variables and parameters
- Constants: UPPER_SNAKE_CASE for exported module-level constants (e.g., `STATUS_SUCCESS`, `MODULE_COLORS`, `UI_TIMEOUTS`, `DEFAULT_DUNGEON_CONFIG`)
- Inline `as const` for literal type narrowing on constant objects/arrays

**Types:**
- Interfaces: PascalCase, no `I` prefix (e.g., `ModuleState`, `UseCRUDResult<T>`, `Lifecycle<T>`)
- Type aliases: PascalCase (e.g., `SubModuleId`, `CategoryId`, `VerificationStatus`, `Result<T, E>`)
- Union literal types: kebab-case values (e.g., `'full' | 'partial' | 'stub' | 'missing'`, `'not-started' | 'in-progress'`)
- Exported const arrays derive their union type: `const SUB_MODULE_IDS = [...] as const; type SubModuleId = (typeof SUB_MODULE_IDS)[number]`

## Code Style

**Formatting:**
- No Prettier config detected; formatting is handled by editor defaults and ESLint
- 2-space indentation (TypeScript/TSX standard)
- Single quotes for strings
- Trailing commas in multi-line parameter lists
- Semicolons required

**Linting:**
- ESLint 9 flat config at `eslint.config.mjs`
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Custom rules:
  - `no-console: warn` (except `console.error`) -- use `logger` from `@/lib/logger`
  - `@typescript-eslint/no-explicit-any: warn` -- encourage proper typing
  - `no-restricted-syntax: warn` on hardcoded hex color literals (`#RRGGBB`) -- use `@/lib/chart-colors` tokens or CSS variables

**TypeScript:**
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- Target: ES2017, module: esnext, moduleResolution: bundler
- `isolatedModules: true` (required by Next.js)
- Run `npm run typecheck` (`tsc --noEmit`) as part of validation

## Import Organization

**Order:**
1. React/Next.js framework imports (`react`, `next/server`, `next/image`)
2. External library imports (`zustand`, `lucide-react`, `framer-motion`, `zod`)
3. Internal absolute imports using `@/` alias, grouped by layer:
   - Types: `@/types/*`
   - Libraries: `@/lib/*`
   - Stores: `@/stores/*`
   - Hooks: `@/hooks/*`
   - Components: `@/components/*`
   - Services: `@/services/*`

**Path Aliases:**
- Always use `@/` alias (maps to `src/`). Never use relative `../../` paths.
- Configured in both `tsconfig.json` (`"@/*": ["./src/*"]`) and `vitest.config.ts` (resolve alias)

**Type-only imports:**
- Use `import type { ... }` for type-only imports (e.g., `import type { SubModuleId } from '@/types/modules'`)

## Error Handling

**API Routes (Server-side):**
- Wrap entire handler body in `try/catch`
- Return `apiSuccess(data)` for success, `apiError(message, status)` for errors
- Error extraction pattern: `err instanceof Error ? err.message : 'Fallback message'`
- Always return `ApiResponse<T>` envelope: `{ success: true, data: T } | { success: false, error: string }`
- Example from `src/app/api/recent-projects/route.ts`:
```typescript
export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('...').all();
    return apiSuccess(rows);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load');
  }
}
```

**Client-side API calls:**
- Use `apiFetch<T>(url)` for calls that should throw on error (caller handles with try/catch)
- Use `tryApiFetch<T>(url)` for calls that return `Result<T, string>` instead of throwing
- Both are in `src/lib/api-utils.ts`

**Result type:**
- Use `Result<T, E>` from `@/types/result.ts` for fallible operations
- Constructors: `ok(data)` and `err(error)`
- Utilities: `mapResult`, `unwrapOr`, `unwrap`
- Pattern: discriminate on `result.ok` before accessing `.data` or `.error`

**Store actions:**
- Async store actions catch errors internally and update error state
- Pattern: `isLoading` / `error` / `scanError` fields on store state
- No-op guards: return `state` unchanged when value already matches (avoid unnecessary re-renders)

## Logging

**Framework:** Custom `logger` wrapper at `src/lib/logger.ts`

**Patterns:**
- Import `logger` from `@/lib/logger` instead of using raw `console.log/warn/info/debug`
- `console.error` is the only allowed direct console call (ESLint permits it)
- Logger methods: `logger.info()`, `logger.warn()`, `logger.debug()`, `logger.log()`
- EventBus error handler uses `console.error` directly (allowed by convention)

## Colors

**Never hardcode hex colors.** Use tokens from `src/lib/chart-colors.ts`:
- Status: `STATUS_SUCCESS`, `STATUS_WARNING`, `STATUS_ERROR`, `STATUS_INFO`, `STATUS_BLOCKER`, `STATUS_NEUTRAL`
- Accents: `ACCENT_VIOLET`, `ACCENT_ORANGE`, `ACCENT_EMERALD`, `ACCENT_CYAN`, `ACCENT_PINK`
- Module: `MODULE_COLORS.core`, `MODULE_COLORS.content`, `MODULE_COLORS.systems`, etc.
- Helpers: `qualityColor(score)`, `healthColor(score)`, `FEATURE_STATUS_COLORS`, `SEVERITY_COLORS`
- Opacity suffixes: `OPACITY_10`, `OPACITY_20`, `OPACITY_30` (append to hex: `STATUS_SUCCESS + OPACITY_20`)

## Timing Constants

**All timing values come from `UI_TIMEOUTS` in `src/lib/constants.ts`.**
- Never hardcode millisecond values for toasts, delays, polling intervals, heartbeats
- Examples: `UI_TIMEOUTS.toast` (3000ms), `UI_TIMEOUTS.pollInterval` (3000ms), `UI_TIMEOUTS.heartbeatInterval` (120000ms)

## Comments

**When to Comment:**
- File-level JSDoc block describing the module's purpose and what it provides (see `src/__tests__/setup.ts`, `src/lib/lifecycle.ts`)
- Section separators using `// ── Section Name ──` with em-dash borders for visual grouping
- Inline comments for non-obvious behavior, race conditions, and "why" explanations
- `eslint-disable` comments with explanation when suppressing rules

**JSDoc/TSDoc:**
- Use `/** ... */` for exported functions, interfaces, and store definitions
- `@param` tags for non-obvious parameters
- Keep descriptions concise (1-2 sentences)

## Function Design

**Size:** Functions are generally compact (10-40 lines). Complex logic is extracted into separate pure functions.

**Parameters:**
- Use options objects (`interface XOptions { ... }`) when more than 2-3 parameters
- Destructure options in function body
- Default values via destructuring: `const { status = 200, ok = status >= 200 } = options`

**Return Values:**
- Store actions: void (state mutation via `set()`)
- API helpers: Promise<T> or Result<T, E>
- Factories: return the constructed object/component
- Hooks: return a result interface (e.g., `UseCRUDResult<T>`, `UseModuleCLIResult`)

## Module Design

**Exports:**
- Named exports only; no default exports (except for Next.js page/layout/route requirements)
- Stores export the hook as `useXxxStore`
- Types and interfaces exported alongside their module or from dedicated `src/types/*.ts` files

**Barrel Files:**
- Not used. Import directly from the source file.

## Zustand Store Conventions

**Creation pattern:**
```typescript
'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface XState {
  // ── State fields ──
  field: Type;
  // ── Actions ──
  setField: (val: Type) => void;
}

export const useXStore = create<XState>()(
  persist(
    (set) => ({
      field: defaultValue,
      setField: (val) => set({ field: val }),
    }),
    {
      name: 'pof-x',                                    // localStorage key prefix: 'pof-'
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ field: state.field }),   // exclude transient state
    },
  ),
);
```

**Key conventions:**
- Always use `'use client'` directive at top of store files
- Persist storage key: prefix with `pof-` (e.g., `pof-navigation`, `pof-evaluator`, `pof-ue5-bridge`)
- Use `partialize` to exclude transient runtime state (`isRunning`, `isScanning`, `connectionState`) from persistence
- Separate persisted settings from non-persisted runtime state with section comments
- Store actions are defined inline in the `create()` call, not as separate functions
- No-op optimization: return unchanged state reference when the new value matches current (prevents unnecessary renders)

## Component Conventions

**Directives:**
- All client components start with `'use client'` directive

**Pattern:**
- Function components (never class components)
- Props defined as inline interface or imported type
- Destructured props in function signature
- Set `displayName` on factory-created components: `Component.displayName = 'Name'`

**Icons:**
- Use `lucide-react` icons exclusively
- Import specific icons by name: `import { RefreshCw, Settings } from 'lucide-react'`

**Styling:**
- Tailwind CSS 4 utility classes inline in JSX
- Dark theme assumed (bg-zinc-*, text-zinc-*, border-zinc-* palette)
- Responsive/interactive states via Tailwind modifiers (`hover:`, `transition-colors`)

## API Route Conventions

**File pattern:** `src/app/api/{endpoint-name}/route.ts`

**Handler pattern:**
```typescript
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    // ... logic ...
    return apiSuccess(data);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Fallback');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // ... validation and logic ...
    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Fallback');
  }
}
```

**Client calls always use relative URLs:** `/api/endpoint-name`
**For absolute URLs (CLI callbacks):** use `getAppOrigin()` or `getOriginFromRequest(request)` from `src/lib/constants.ts`

## Hook Conventions

**Naming:** `use` + PascalCase noun (e.g., `useCRUD`, `useModuleCLI`, `useLifecycle`)

**Return type:** Always define a named result interface (e.g., `UseCRUDResult<T>`, `UseModuleCLIResult`)

**Mounted-ref safety:** Long-lived async hooks use `mountedRef` to guard state updates after unmount:
```typescript
const mountedRef = useRef(true);
useEffect(() => {
  mountedRef.current = true;
  return () => { mountedRef.current = false; };
}, []);
// In async callback:
if (!mountedRef.current) return;
```

**Suspend-awareness:** Use `useSuspendableEffect` instead of `useEffect` for timers/polling. Use `useSuspendableSelector` instead of direct Zustand selectors when the component may be LRU-cached.

---

*Convention analysis: 2026-03-14*
