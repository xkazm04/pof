# Bug Hunt — Prompt Construction & Context
> Total: 4
> Severity: 0 critical, 2 high, 2 medium, 0 low

This context is the prompt-assembly backbone: `PromptBuilder`, the shared `buildProjectContextHeader()`, the per-module prompt builders, and the **error memory** subsystem (`error-memory-db.ts`) that injects "past build errors, avoid repeating these" warnings into every UE prompt. Three of the four findings live in the error-memory layer, because that is where mutable state, time math, and relevance scoring actually run — the prompt-builder string concatenation is mostly inert. The error memory is plumbed into prompts via `buildProjectContextHeader({ errorMemory })` → `formatErrorMemory()`, and populated/queried through `/api/error-memory`. When it silently drops or mis-resolves entries, the model loses its only memory of prior compiler failures and repeats them — a quiet, compounding regression rather than a loud crash.

## 1. `markResolved` clears the resolved flag for the SAME error in EVERY module
- **Severity**: high
- **Category**: state-corruption
- **File**: src/lib/error-memory-db.ts:256-260
- **Scenario**: A user (or the CLI) fixes a "missing #include AbilitySystemComponent.h" error in `arpg-gas` and calls `markResolved(fingerprint)`. The same include error also exists, still unfixed, as separate rows in `arpg-combat` and `arpg-character`.
- **Root cause**: Fingerprints are computed module-independently — `error-fingerprint.ts` derives them only from `category` + normalized `pattern`, and the docstring explicitly says "the same root error produces the same fingerprint across sessions." The table's identity is `UNIQUE(module_id, fingerprint)`, so one fingerprint correctly maps to N rows (one per module). But `markResolved` runs `UPDATE error_memory SET was_resolved = 1 WHERE fingerprint = ?` with **no `module_id` predicate**, so it flips every module's row at once. The design assumption — "fingerprint identifies one error instance" — contradicts the schema's own composite key.
- **Impact**: corruption. `getRelevantErrors` gives `+5` to unresolved errors; the wrongly-resolved rows in other modules lose that boost and get pushed out of the top-N prompt injection. The "avoid repeating this" warning silently vanishes for modules where the bug was never fixed, so the model reintroduces an error the system thought it had learned — success theater.
- **Fix sketch**: Make resolution module-scoped at the API boundary: require `moduleId` alongside `fingerprint` and `UPDATE ... WHERE module_id = ? AND fingerprint = ?`. Make the whole class impossible by never exposing a fingerprint-only mutation — every write should carry the same `(module_id, fingerprint)` key the table is uniqued on.

## 2. Relevance candidates are truncated by occurrence count BEFORE the relevance score is computed
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/error-memory-db.ts:191-196
- **Scenario**: A mature project has accumulated 30+ cross-module errors with `occurrences >= 3`. A new GAS task runs; the one error that is the exact match for this task (correct module, keyword hit on "ability") has only `occurrences = 1` because it is new.
- **Root cause**: The candidate SQL is `WHERE module_id = ? OR occurrences >= 3 ORDER BY occurrences DESC ... LIMIT 30`. The expensive relevance scorer below it — which adds `+20` for keyword match, `+10` for module match, `+15` for recency — runs **only on the 30 rows SQL already kept**. The design assumes "the 30 highest-occurrence rows are a superset of the most relevant rows," but relevance is dominated by keyword + module match, not raw frequency. A rare-but-perfectly-relevant module error is evicted by the `ORDER BY occurrences DESC` window before scoring can ever rescue it.
- **Impact**: UX degradation / silent failure. As the error corpus grows past 30 frequent entries (the steady state for any long-lived project — a time bomb), the relevance scorer becomes a no-op for fresh, task-specific errors. The single most useful warning is the one most likely to be dropped, defeating the feature's entire purpose.
- **Fix sketch**: Separate retrieval from ranking. Always pull all rows for the target module unconditionally (module errors are few), `UNION` them with the cross-module high-frequency set, then score and `slice` in JS. The `LIMIT` belongs after scoring, not before — never let a pre-filter discard a row the ranker would have promoted.

## 3. SQLite UTC timestamps are parsed as local time, skewing recency scoring
- **Severity**: medium
- **Category**: edge-case
- **File**: src/lib/error-memory-db.ts:209
- **Scenario**: A user in a UTC-offset timezone (e.g. America/Los_Angeles, UTC-7/8) records an error. Minutes later a prompt is built; the recency calculation runs on the just-stored `last_seen_at`.
- **Root cause**: `last_seen_at` is written by SQLite `datetime('now')`, which yields a space-separated UTC string `'YYYY-MM-DD HH:MM:SS'` with **no `Z` / timezone marker**. `new Date('2026-06-09 12:00:00')` (per the JS spec for date-time strings with a space and no offset) is interpreted as **local** time, then compared against `Date.now()` (true UTC epoch). The assumption "the DB string and `Date.now()` share a clock" is false: the two differ by the local UTC offset, so `daysSinceLastSeen` is wrong by up to ±the offset (and goes **negative** in positive-offset zones).
- **Impact**: UX degradation. Errors sit in the wrong recency bucket (`<1d` / `<7d` / `<30d` boundaries at lines 210-212), mis-prioritizing which warnings reach the prompt. Near the 1-day and 7-day edges, a fresh error can be scored as stale (or vice-versa), and the bug is invisible in CI because it only manifests when the host TZ ≠ UTC.
- **Fix sketch**: Normalize at the trust boundary — append `'Z'` (or `.replace(' ', 'T') + 'Z'`) before `new Date(...)`, or store epoch-ms / ISO-8601-with-offset instead of `datetime('now')`. Centralize one `parseDbTimestamp()` helper so no call site can re-introduce the naive `new Date(dbString)` pattern.

## 4. `getRequiredMSVCVersion` checks the minor version without bounding the major
- **Severity**: medium
- **Category**: logic-error
- **File**: src/lib/prompt-context.ts:75-80
- **Scenario**: A future UE 6.0 project (or a sloppily-entered `ueVersion` like `"5"` or `"6.2"`) flows into `buildProjectContextHeader`, which prints `Required MSVC toolchain: <X>+` into the prompt.
- **Root cause**: The branches are `parts[0] >= 5 && parts[1] >= 7` then `parts[0] >= 5 && parts[1] >= 4`, falling through to `'14.34'`. The minor-version test `parts[1] >= 7/4` is evaluated against the *minor* digit regardless of the major. So `"6.0"` → `parts[1] = 0`, fails both `>= 7` and `>= 4`, and returns the **oldest** toolchain `14.34` for the newest engine. `"6.2"` → returns `14.34` likewise. `"5"` (no minor) → `parts[1]` is `undefined`; `undefined >= 7` is `false`, so it also collapses to `14.34`. The assumption "newer engine ⇒ at least as new a toolchain" is silently violated whenever the major bumps or the minor is absent.
- **Impact**: UX degradation / wrong guidance. The model is told to target an obsolete MSVC version for a newer UE, producing build instructions that fail the compiler-version preflight — the exact failure the error-memory system is meant to prevent.
- **Fix sketch**: Make the comparison version-ordered, not digit-wise: parse to a `[major, minor]` tuple with `minor` defaulting to a sane value, and gate on `major > 5 || (major === 5 && minor >= 7)`, etc., with the **newest** toolchain as the default tail (so unknown-future versions fail safe upward, not downward). Reject/validate malformed `ueVersion` at the input boundary so a bare `"5"` never reaches the arithmetic.
