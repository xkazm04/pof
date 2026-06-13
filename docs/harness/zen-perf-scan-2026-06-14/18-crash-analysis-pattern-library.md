# Crash Analysis & Pattern Library — zen-perf scan
> Context: Quality Evaluator & Health / Crash Analysis & Pattern Library
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Imported crash logs are a dead-end: never pattern-matched, never re-stat'd, never persisted
- **Severity**: high
- **Lens**: both
- **Category**: correctness / dead feature
- **File**: src/stores/crashAnalyzerStore.ts:76-105 ; src/lib/crash-analyzer/analysis-engine.ts:214-226 ; src/components/modules/evaluator/CrashAnalyzerView.tsx:814-861
- **Scenario**: User pastes a real UE5 crash log in the Import tab and clicks "Import & Analyze". The toast confirms `Imported crash-…`, the row appears in the list — but it participates in nothing.
- **Root cause**: `importCrashLog` calls `analyzeSingleCrash`, which only runs `findCulpritFrame` and tries to match a *hardcoded* `SAMPLE_DIAGNOSES` entry by `report.id` (line 223) — an imported crash's `crash-<timestamp36>` id can never match `crash-001`..`crash-008`, so `diagnosis` is always `null`. The store appends the report to `reports`/`diagnoses` (lines 89-98) but never recomputes `patterns` (still the cached `detectPatterns` over the 8 samples) or `stats`. So `stats.totalCrashes`, `crashesBySeverity`, and the severity pill counts (CrashAnalyzerView.tsx:118-129) all go stale the moment a crash is imported, and the new crash can never form a `CrashPattern` even if it duplicates an existing signature. Nothing is persisted to a DB either, so it vanishes on refresh (`fetchAnalysis` re-reads the cached sample set).
- **Impact**: The headline interactive feature of the analyzer ("Parse UE5 crash dumps, identify root causes") is non-functional for any real input — it only ever "works" on the 8 baked-in samples. Stats silently desync.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Either (a) recompute `patterns`+`stats` client-side after append by extracting `detectPatterns`/`computeStats` into pure exports the store can call over `[...reports, newReport]`, or (b) drop the Import tab if it was never meant to be functional. At minimum, recompute `stats` on import so the counts don't lie. Note in the diagnosis lookup that imported crashes will never have a sample diagnosis.

## 2. Every error-memory and pattern-library read re-runs DDL (CREATE TABLE / CREATE INDEX / PRAGMA / ALTER) on the hot path
- **Severity**: high
- **Lens**: performance
- **Category**: repeated DB work
- **File**: src/lib/error-memory-db.ts:147-196,277-283 ; src/lib/pattern-library-db.ts:22-82,180-202
- **Scenario**: Each GET of the pattern dashboard / suggestions / error stats, and each prompt-dispatch anti-pattern check, re-issues schema-bootstrap statements before the actual query.
- **Root cause**: `ensureErrorMemoryTable()` (3× `db.exec`: CREATE TABLE + 2 CREATE INDEX) and `ensurePatternLibraryTable()` (CREATE TABLE + a `PRAGMA table_info` read + up to 6 `addIfMissing` ALTER probes + 4 CREATE INDEX) are invoked at the top of *every* read function — `getRecord`, `getModuleErrors`, `getAllErrors`, `getRelevantErrors`, `getErrorMemoryStats`, `markResolved`, `getAllPatterns`, `getPatternsByModule`, `getPattern`, `searchPatterns`, `suggestPatterns`, `getPatternDashboard`. `getPatternDashboard` → `getAllPatterns` double-bootstraps in one call. `suggestPatterns` → `getPatternsByModule` likewise. While `IF NOT EXISTS` makes them no-ops, SQLite still parses+plans each statement and `PRAGMA table_info` + the `Set` rebuild run unconditionally every read.
- **Impact**: 3-13 redundant prepared/exec round-trips per API request; `checkPromptForAntiPatterns` runs in the dispatch hot path (per keystroke-debounced prompt check), multiplying the cost. Pure overhead with zero correctness value after first call.
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Guard bootstrap with a module-level `let bootstrapped = false` (or a `Set<tableName>`) so DDL runs at most once per process; read functions call `ensure…()` which early-returns after the first run. Keeps idempotency, removes per-read DDL.

## 3. recordError costs 3 queries per error and the batch path has no transaction
- **Severity**: medium
- **Lens**: performance
- **Category**: query amplification / missing transaction
- **File**: src/lib/error-memory-db.ts:80-143
- **Scenario**: CLI posts a build's worth of fingerprinted errors via `record-errors`; `recordErrors` maps over them calling `recordError` one at a time.
- **Root cause**: `recordError` issues SELECT (existence) → UPDATE *or* INSERT → then `getRecord(id)` which itself calls `ensureErrorMemoryTable()` + a third SELECT. That's 3 statements (+DDL from finding #2) per error. `recordErrors` (line 138-143) is a plain `.map` with no `db.transaction()` wrapper, so N errors = N separate auto-commit fsyncs.
- **Impact**: A build emitting 30 errors does ~90 statements + 30 fsync commits where it could be ~30 statements in one transaction. Slow and non-atomic (a mid-batch throw leaves a partial write).
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Replace the SELECT+UPDATE/INSERT with a single `INSERT … ON CONFLICT(module_id,fingerprint) DO UPDATE SET occurrences=occurrences+1, last_seen_at=…, was_resolved=0 RETURNING *` (better-sqlite3 supports RETURNING), eliminating the existence SELECT and the trailing `getRecord`. Wrap `recordErrors` in `db.transaction(...)`.

## 4. detectPatterns / getRelevantErrors scoring rebuild Sets and rescan strings without precomputed lowercasing
- **Severity**: medium
- **Lens**: performance
- **Category**: redundant per-item work
- **File**: src/lib/error-memory-db.ts:201-243 ; src/lib/crash-analyzer/analysis-engine.ts:90-111
- **Scenario**: `getRelevantErrors` scores up to 30 rows against up to 15 task keywords; `detectPatterns` reduces over each crash group twice for firstSeen/lastSeen.
- **Root cause**: In `getRelevantErrors`, for each record the inner keyword loop calls `kw.toLowerCase()` every iteration (line 225) even though `taskKeywords` is fixed across all records — that's `records × keywords` redundant lowercasings; the per-record `pattern/message/fixDescription.toLowerCase()` (221-223) is correctly hoisted, but the keyword side is not. In `detectPatterns`, `firstSeen`/`lastSeen` (lines 109-110) each run a full `reduce` over the group (2 passes) and `signatureFns` does `flatMap`→`filter`→`map`→`new Set`→spread→`slice` allocating several intermediate arrays per signature. Small N today (8 samples), but the code is the general engine for imported crashes too.
- **Impact**: O(records × keywords) string allocs per relevance query; multiple array allocations per detected pattern. Minor at current scale, compounds if the analyzer ever ingests real crash volumes.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Pre-lowercase `taskKeywords` once before the scoring `map`. In `detectPatterns`, compute min/max timestamp in a single loop and build `signatureFns` with one pass into a `Set` capped at 5.

## 5. parseCrashLog timestamp normalization relies on a fragile positional `offset <= 9` dot-replacer
- **Severity**: low
- **Lens**: architecture
- **Category**: fragile parsing
- **File**: src/lib/crash-analyzer/analysis-engine.ts:263-266
- **Scenario**: A real log whose first matched `[YYYY.MM.DD-HH.MM.SS` token sits at any column other than the sample's exact layout.
- **Root cause**: The ISO conversion does `tsMatch[1].replace(/\./g, (m, offset) => offset <= 9 ? '-' : ':')` — it decides date-dot vs time-dot by the dot's *character offset within the captured substring* (≤9 = date separator). This only holds because the captured group always starts at `YYYY.MM.DD…`; it's an implicit coupling to capture-group geometry, not to semantics. The follow-up `.replace(/-(\d{2}):/, 'T$1:')` then patches the date/time boundary. Any drift (timezone prefix, differently-padded fields) silently produces a wrong timestamp, which then flows into `recentCrashes` (24h window) and the firstSeen/lastSeen pattern bounds.
- **Impact**: Latent: wrong timestamps misclassify "recent" crashes and pattern time ranges; hard to spot because the happy-path samples parse correctly.
- **Effort**: 2 · **Value**: 3
- **Fix sketch**: Parse the fields structurally: `const m = raw.match(/(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/)` then assemble `${y}-${mo}-${d}T${h}:${mi}:${s}Z`. Semantic, position-independent, and self-documenting.
