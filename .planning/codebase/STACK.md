# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- TypeScript 5.x - All application code (frontend + backend). Strict mode enabled in `tsconfig.json`.

**Secondary:**
- CSS (Tailwind CSS 4) - Styling via utility classes in `src/app/globals.css` and component-level styles.

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc` detected)
- Next.js 16 App Router (server components + API route handlers)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (assumed present; standard npm project)

## Frameworks

**Core:**
- Next.js `16.1.6` - Full-stack React framework using App Router (`src/app/`)
- React `19.2.3` - UI rendering with server components
- React DOM `19.2.3` - DOM rendering

**State Management:**
- Zustand `5.0.11` - Client-side state with `persist` middleware and `createJSONStorage(localStorage)`. Stores in `src/stores/`.

**Testing:**
- Vitest `4.0.18` - Unit test runner. Config: `vitest.config.ts`. Setup file: `src/__tests__/setup.ts`.

**Build/Dev:**
- Tailwind CSS `4.x` - Utility-first CSS via `@tailwindcss/postcss` plugin
- PostCSS - Build pipeline for Tailwind (`postcss.config.mjs`)
- ESLint `9.x` - Linting with `eslint-config-next` (core-web-vitals + TypeScript). Config: `eslint.config.mjs`.

## Key Dependencies

**Critical:**
- `better-sqlite3` `12.6.2` - Embedded SQLite database for all persistence. Externalized in `next.config.ts` via `serverExternalPackages`. DB at `~/.pof/pof.db`, WAL mode.
- `zustand` `5.0.11` - All client state management. 22 stores in `src/stores/`.
- `zod` `4.3.6` - Schema validation for API request payloads (used in feature matrix import, module scan import routes).

**UI & Visualization:**
- `lucide-react` `0.563.0` - Icon library. Used in 183+ component files across the entire UI.
- `framer-motion` `12.34.0` - Animation library. Used in 10+ core engine unique-tab components for transitions and interactive visualizations.
- `@react-three/fiber` `9.5.0` - React renderer for Three.js. Used in material preview and asset viewer (`src/components/modules/visual-gen/`).
- `@react-three/drei` `10.7.7` - Three.js helpers (orbit controls, lighting presets, etc.).
- `three` `0.183.1` - 3D rendering engine for material previews and asset viewing.
- `react-window` `2.2.6` - Virtualized list rendering for large terminal output (`src/components/cli/CompactTerminal.tsx`, `TerminalOutput.tsx`).
- `shiki` `3.22.0` - Syntax highlighting for code blocks in CLI terminal output (`src/components/cli/CodeBlockHighlighter.tsx`).
- `sonner` `2.0.7` - Toast notification library. Mounted in root layout (`src/app/layout.tsx`).

**Infrastructure:**
- `next` `16.1.6` - Provides server-side rendering, API routes, font optimization, and build tooling.

## Configuration

**TypeScript:**
- `tsconfig.json`: Target ES2017, strict mode, bundler module resolution, `@/*` path alias to `src/`.
- JSX: `react-jsx` (automatic runtime).

**Next.js:**
- `next.config.ts`: Minimal config; only `serverExternalPackages: ['better-sqlite3']`.

**ESLint:**
- `eslint.config.mjs`: Flat config format.
- Rules: `no-console` (warn, allows `console.error`), `@typescript-eslint/no-explicit-any` (warn), `no-restricted-syntax` (warns on hardcoded hex color literals).
- Extends: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.

**PostCSS:**
- `postcss.config.mjs`: Single plugin `@tailwindcss/postcss`.

**Vitest:**
- `vitest.config.ts`: Tests in `src/**/*.test.ts` and `src/**/*.test.tsx`. Path alias `@` resolves to `src/`. Setup file at `src/__tests__/setup.ts`.

**Environment Variables:**
- `PORT` - Optional. Used for server-side origin detection (defaults to `3000`). Read in `src/lib/constants.ts`.
- `LEONARDO_API_KEY` - Optional. Required only for Leonardo AI image generation. Read in `src/lib/leonardo.ts`.
- `ANTHROPIC_API_KEY` - Explicitly **deleted** from child process env when spawning Claude CLI (`src/lib/claude-terminal/cli-service.ts:202`). Claude CLI uses its own auth.
- No `.env` file detected in the project root.

**Build Commands:**
```bash
npm run dev          # next dev - Start development server
npm run build        # next build - Production build
npm run start        # next start - Start production server
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (all tests)
npm run test:watch   # vitest in watch mode
npm run validate     # typecheck + lint + test (full CI check)
```

## Platform Requirements

**Development:**
- Node.js with npm
- Windows, macOS, or Linux (cross-platform path handling in `src/lib/claude-terminal/cli-service.ts`)
- Claude Code CLI installed globally (spawned as `claude` or `claude.cmd` on Windows)
- Optional: UE5 with Web Remote Control plugin (for live editor integration)
- Optional: Blender 3.6+ (for 3D asset pipeline; auto-detected on all platforms)

**Production:**
- Runs as a local desktop tool (localhost). Not designed for cloud deployment.
- SQLite database at `~/.pof/pof.db` (created automatically).
- Default port: 3000.

## Key Abstractions

**Result Type:**
- `src/types/result.ts`: `Result<T, E>` discriminated union (`{ ok: true, data: T } | { ok: false, error: E }`) with `ok()`, `err()`, `mapResult()`, `unwrapOr()`, `unwrap()` helpers.

**API Envelope:**
- `src/types/api.ts`: `ApiResponse<T>` = `{ success: true, data: T } | { success: false, error: string }`.
- Server: `apiSuccess(data)` / `apiError(msg)` from `src/lib/api-utils.ts`.
- Client: `apiFetch<T>(url)` (throws on error) / `tryApiFetch<T>(url)` (returns `Result<T, string>`).

**Event Bus:**
- `src/lib/event-bus.ts`: Singleton pub/sub with typed channels, namespace subscriptions, replay buffer (200 events), wildcard listeners.

**Lifecycle Protocol:**
- `src/lib/lifecycle.ts`: `Lifecycle<T>` interface (init/isActive/dispose) with factory helpers for resource management.

**Logger:**
- `src/lib/logger.ts`: Thin console wrapper (`logger.info/warn/debug/log`). ESLint enforces usage over raw console.

**Color Tokens:**
- `src/lib/chart-colors.ts`: Semantic color constants (`STATUS_SUCCESS`, `MODULE_COLORS`, opacity helpers). ESLint enforces no hardcoded hex.

**Timing Constants:**
- `src/lib/constants.ts`: `UI_TIMEOUTS` object with all timing values (toast duration, poll intervals, reconnection delays, build timeouts).

---

*Stack analysis: 2026-03-14*
