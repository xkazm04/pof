# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**Claude Code CLI (Primary AI Engine):**
- Purpose: Powers all AI-driven development tasks (checklist execution, code generation, module scanning, feature review)
- Integration: Spawned as child process (`claude` / `claude.cmd`) with `--output-format stream-json`
  - Client: `src/lib/claude-terminal/cli-service.ts`
  - API routes: `src/app/api/claude-terminal/stream/route.ts`, `src/app/api/claude-terminal/query/route.ts`
  - Hook: `src/hooks/useModuleCLI.ts`
- Auth: Uses Claude CLI's own authentication (the `ANTHROPIC_API_KEY` env var is explicitly deleted from spawned process env)
- Flags: `--verbose --dangerously-skip-permissions`
- Session management: Supports resume via `--resume <sessionId>`
- Callback system: `@@CALLBACK:<id>` markers in prompts, terminal intercepts output, validates JSON, POSTs to app API (`src/lib/cli-task.ts`)

**Leonardo AI (Image Generation):**
- Purpose: AI-powered concept art / reference image generation
- SDK/Client: Direct HTTP client in `src/lib/leonardo.ts`
- API Base: `https://cloud.leonardo.ai/api/rest/v1`
- Model: Lucid Origin (`7b592283-e8a7-4c5a-9ba6-d18c31f258b9`)
- Auth: `LEONARDO_API_KEY` env var (Bearer token)
- API route: `src/app/api/leonardo/route.ts`
- Pattern: Submit generation, poll for completion (2s intervals, max 30 attempts)

**Poly Haven (Free Asset Library):**
- Purpose: Browse CC0-licensed HDRIs, textures, and 3D models
- SDK/Client: Direct HTTP client in `src/lib/visual-gen/asset-sources.ts`
- API Base: `https://api.polyhaven.com`
- Auth: None (public API)
- Endpoints used: `/assets?t={category}`, `/files/{id}`
- CDN for thumbnails: `https://cdn.polyhaven.com/asset_img/thumbs/`

**ambientCG (Free Material Library):**
- Purpose: Browse CC0-licensed PBR materials and textures
- SDK/Client: Direct HTTP client in `src/lib/visual-gen/asset-sources.ts`
- Auth: None (public API)

## UE5 Engine Integrations

**UE5 Web Remote Control (HTTP):**
- Purpose: Bidirectional communication with running UE5 editor (read/write properties, invoke UFUNCTIONs, search assets, batch operations)
- SDK/Client: `src/lib/ue5-bridge/remote-control-client.ts` (`RemoteControlClient` class)
- Connection Manager: `src/lib/ue5-bridge/connection-manager.ts` (singleton with health checks, auto-reconnection)
- Store: `src/stores/ue5BridgeStore.ts` (persists host/port settings)
- Hook: `src/hooks/useUE5Connection.ts`
- Default endpoint: `http://127.0.0.1:30010`
- API routes: `src/app/api/ue5-bridge/status/route.ts` (SSE), `src/app/api/ue5-bridge/query/route.ts`, `src/app/api/ue5-bridge/build/route.ts`
- UE5 API endpoints consumed:
  - `GET /remote/info` - Server info & version
  - `PUT /remote/object/property` - Read/write object properties
  - `PUT /remote/object/call` - Invoke UFUNCTIONs
  - `PUT /remote/object/describe` - Describe object properties
  - `PUT /remote/search/assets` - Search project assets
  - `PUT /remote/batch` - Batch multiple requests
- Timeout: 10s per request (`UI_TIMEOUTS.ue5HttpTimeout`)

**UE5 WebSocket Live State (WS):**
- Purpose: Real-time bidirectional state sync with UE5 editor (snapshots, delta updates, property watches, PIE events, selection events)
- SDK/Client: `src/lib/ue5-bridge/ws-live-state.ts` (`UE5LiveStateClient` singleton)
- Hook: `src/hooks/useLiveStateSync.ts`
- Protocol: WebSocket with ping/pong keepalive
- Receives: editor snapshots, delta updates, property watch values
- Sends: property watch subscriptions, property writes, snapshot requests

**PoF Bridge Plugin (Custom UE5 Companion Plugin):**
- Purpose: Deep project introspection beyond UE5 Remote Control (asset manifests, blueprint inspection, test execution, snapshot capture, live coding compilation)
- SDK/Client: `src/lib/pof-bridge/client.ts` (`PofBridgeClient` class)
- Connection Manager: `src/lib/pof-bridge/connection-manager.ts` (singleton with health checks, auto-reconnection)
- Verification Engine: `src/lib/pof-bridge/verification-engine.ts`, `src/lib/pof-bridge/verification-rules.ts`
- Store: `src/stores/pofBridgeStore.ts` (persists port/auth/auto-detect settings)
- Hook: `src/hooks/usePofBridge.ts`
- Default endpoint: `http://127.0.0.1:30040`
- API proxy routes: `src/app/api/pof-bridge/status/route.ts`, `src/app/api/pof-bridge/manifest/route.ts`, `src/app/api/pof-bridge/test/route.ts`, `src/app/api/pof-bridge/snapshot/route.ts`, `src/app/api/pof-bridge/compile/route.ts`
- Plugin API endpoints consumed:
  - `GET /pof/status` - Plugin status & version
  - `GET /pof/manifest` - Full asset manifest (supports `?checksum-only=true`)
  - `GET /pof/manifest/blueprint` - Single blueprint by path
  - `POST /pof/test/run` - Run a test spec
  - `GET /pof/test/results` - Get test results
  - `POST /pof/test/run-automation` - Run UE5 automation tests
  - `POST /pof/snapshot/capture` - Capture snapshot presets
  - `POST /pof/snapshot/baseline` - Save baseline snapshots
  - `GET /pof/snapshot/diff` - Get snapshot diff report
  - `POST /pof/compile/live` - Trigger live coding compile
  - `GET /pof/compile/status` - Get current compile status
- Auth: Optional token via `pofAuthToken` store setting
- Timeout: 15s per request (`UI_TIMEOUTS.pofHttpTimeout`)

**UE5 Build Pipeline (UnrealBuildTool):**
- Purpose: Trigger headless UE5 builds from within PoF
- Client: `src/lib/ue5-bridge/build-pipeline.ts` (spawns UBT as child process)
- Queue: `src/lib/ue5-bridge/build-queue.ts`
- Output parsing: `src/components/cli/UE5BuildParser.tsx`
- Error fingerprinting: `src/lib/error-fingerprint.ts` -> `src/lib/error-memory-db.ts`
- API route: `src/app/api/ue5-bridge/build/route.ts`
- Build timeout: 10 minutes (`UI_TIMEOUTS.buildProcessTimeout`)

## Local Tool Integrations

**Blender (3D Asset Pipeline):**
- Purpose: Auto-detect Blender installation for mesh processing
- Detection: `src/app/api/visual-gen/blender/detect/route.ts`
- Checks platform-specific paths (Windows: `C:\Program Files\Blender Foundation\`, macOS: `/Applications/Blender.app/`, Linux: `/usr/bin/blender`)
- Version detection via `blender --version`
- Supports Blender 3.6 - 4.2

**3D Generation Providers (Planned):**
- Registry: `src/lib/visual-gen/providers.ts`
- Free/local (not yet wired): TripoSR, TRELLIS.2, Hunyuan3D
- Paid/cloud (coming soon): Meshy, Tripo3D
- Current state: `src/app/api/visual-gen/generate/route.ts` returns placeholder responses

## Data Storage

**Database:**
- Type: SQLite (embedded, single file)
- Library: `better-sqlite3` `12.6.2`
- Location: `~/.pof/pof.db` (auto-created)
- Client: Direct synchronous API via `src/lib/db.ts`
- Config: WAL mode (`journal_mode = WAL`)
- Schema (13 tables, all in `src/lib/db.ts`):
  - `settings` - Key/value app config
  - `feature_matrix` - Feature tracking per module (status, quality score, file paths, review notes)
  - `review_snapshots` - Historical review state for trend tracking
  - `eval_findings` - Multi-pass deep evaluation results (structure/quality/performance)
  - `build_history` - Package/build records for trending
  - `recent_projects` - Project switcher history
  - `project_progress` - Full module state per project (checklist, health, verification, history)
  - `session_log` - CLI session audit trail
  - `request_log` - Idempotency key replay detection
  - `headless_builds` - UBT build results
  - `checklist_metadata` - Priority and notes per checklist item
  - `milestone_deadlines` - User-set target dates
- Additional domain-specific DB files:
  - `src/lib/ai-testing-db.ts`
  - `src/lib/audio-scene-db.ts`
  - `src/lib/error-memory-db.ts`
  - `src/lib/game-director-db.ts`
  - `src/lib/level-design-db.ts`
  - `src/lib/pattern-library-db.ts`
  - `src/lib/session-analytics-db.ts`
  - `src/lib/session-log-db.ts`
  - `src/lib/telemetry-db.ts`
  - `src/lib/visual-gen/material-db.ts`

**File Storage:**
- Local filesystem only. No cloud storage.
- CLI logs written to `{projectPath}/.claude/logs/`
- Project files scanned directly from disk via `src/app/api/filesystem/` routes

**Caching:**
- No external cache (no Redis/Memcached)
- In-memory caches: LRU module cache (navigation), event bus replay buffer (200 events), search index
- Client-side: Zustand stores with localStorage persistence

## Authentication & Identity

**Auth Provider:**
- None. PoF is a local-only desktop tool with no user authentication.
- The PoF Bridge plugin supports an optional auth token (`pofAuthToken` in `src/stores/pofBridgeStore.ts`) for plugin-level access control.

## Monitoring & Observability

**Error Tracking:**
- Custom error memory system (`src/lib/error-memory-db.ts`, `src/lib/error-fingerprint.ts`) that fingerprints and stores build errors for pattern detection.
- No external error tracking service (no Sentry, Datadog, etc.).

**Logs:**
- `src/lib/logger.ts`: Thin console wrapper (info/warn/debug/log). Not structured logging.
- CLI terminal logs: Written to filesystem at `{projectPath}/.claude/logs/terminal_{id}_{timestamp}.log`

**Analytics:**
- Session analytics tracked in SQLite (`src/lib/session-analytics-db.ts`)
- Telemetry snapshots (`src/lib/telemetry-db.ts`) for genre evolution and project health
- All analytics are local-only; no data is sent externally.

## CI/CD & Deployment

**Hosting:**
- Local desktop application. Runs on `localhost:3000`.

**CI Pipeline:**
- No detected CI configuration (no `.github/workflows/`, no `.gitlab-ci.yml`, etc.)
- Validation script: `npm run validate` runs typecheck + lint + test sequentially.

## Environment Configuration

**Required env vars:**
- None strictly required for basic operation.

**Optional env vars:**
- `LEONARDO_API_KEY` - Leonardo AI image generation (used in `src/lib/leonardo.ts`)
- `PORT` - Override default port 3000 (used in `src/lib/constants.ts`)

**Secrets location:**
- No `.env` file detected in the project root.
- Secrets are set via environment variables at runtime.

## Webhooks & Callbacks

**Incoming (Internal):**
- Task callback system: CLI tasks embed `@@CALLBACK:<id>` markers; the terminal intercepts Claude's output, validates JSON, and POSTs to internal API routes.
  - Registration: `src/lib/cli-task.ts` (`registerCallback`, `getCallback`, `removeCallback`)
  - Routes targeted: Various `/api/` endpoints depending on task type (checklist completion, feature matrix import, etc.)

**Outgoing:**
- None. PoF does not send webhooks to external services.

## SSE (Server-Sent Events) Endpoints

**Active SSE streams:**
- `GET /api/claude-terminal/stream` - Streams CLI execution events (init, text, tool_use, tool_result, result, error)
- `GET /api/ue5-bridge/status` - Streams UE5 connection state changes with 30s keepalive
- `GET /api/filesystem/watch` - Streams file change events for project Source/ directory

**Pattern:** All SSE endpoints use `ReadableStream` with `TextEncoder`, handle client disconnect via `request.signal.addEventListener('abort')`, and include keepalive mechanisms.

---

*Integration audit: 2026-03-14*
