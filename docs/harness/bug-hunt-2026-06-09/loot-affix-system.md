# Bug Hunt — Loot & Affix System
> Total: 4
> Severity: 0 critical, 2 high, 2 medium, 0 low

## 1. Seeded RNG uses signed `>>` shift — biased, short-period stream corrupts every drop-simulation statistic
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/seeded-rng.ts:29 (consumed by src/lib/loot-designer/drop-simulator.ts:199)
- **Scenario**: A designer runs `runDropSimulation` (the headline "roll N items and read the distribution heatmaps" feature). It seeds `createXorShift32RNG(seed)`. The XORShift32 closure does `s ^= s >> 17`. Because `s` is a 32-bit value stored in a JS number that frequently goes negative (high bit set after `s ^= s << 13`), `>>` is an *arithmetic* (sign-propagating) shift, not the logical shift the XORShift32 algorithm requires.
- **Root cause**: The canonical XORShift32 is `s ^= s<<13; s ^= s>>>17; s ^= s<<5;` — the middle step MUST be the unsigned `>>>`. Using signed `>>` sign-extends the negative state, feeding 1-bits into the high end of the XOR and producing a stream that is statistically biased and can fall into a much shorter cycle. The final `(s >>> 0) / normalize` masks the symptom (output still looks like a float in range), so nothing crashes and the bias is invisible.
- **Impact**: corruption — every number the drop simulator reports (affix frequencies, magnitude histograms, co-occurrence probabilities, axis coverage, power histogram, avg affix count) is computed from a biased PRNG. Designers tune real loot weights against distributions that don't match the UE5 `UARPGAffixRoller` this file claims to faithfully reproduce. Silent: no error, plausible-looking output ("success theater").
- **Fix sketch**: Change the shift to the unsigned `s ^= s >>> 17;` to match the algorithm, and add a deterministic unit test asserting the first ~10 outputs for a fixed seed plus a chi-square uniformity check, so any future shift/normalize regression in the shared RNG is caught.

## 2. UE5 loot-table import accepts unvalidated `DropWeight` (NaN / negative / Infinity) → corrupt state, broken bars, poisoned codegen
- **Severity**: high
- **Category**: state-corruption
- **File**: src/components/modules/core-engine/sub_loot/_shared/codegen.ts:35 (`entry.DropWeight ?? 1`); surfaces in src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:190
- **Scenario**: A user clicks "Import UE5" and selects a JSON export whose entries contain `"DropWeight": -5`, `"DropWeight": "12"` (string), or a value serialized as `null`/missing-but-present-as-NaN. `parseUE5LootTable` does `weight: entry.DropWeight ?? 1` with no `typeof`/range check. `??` only guards `null`/`undefined`, so a negative number, a NaN, or a non-number string passes straight through into `editorEntries`.
- **Root cause**: The import is a trust boundary (arbitrary user file) but treats the parsed JSON as already-valid `UE5LootEntry`. There is no validation that `DropWeight` is a finite, non-negative number. `editorTotalWeight = reduce((s,e)=>s+e.weight)` then becomes NaN (one NaN poisons the sum) or shrinks below an individual weight.
- **Impact**: corruption / UX degradation. The live-preview bar computes `width: (entry.weight / editorTotalWeight) * 100` → `NaN%` (bar vanishes) or negative/over-100% widths; the `% share` column renders `NaN%`. The bad weight round-trips: `generateUE5LootTableJson`/`Cpp` emit `DropWeight = NaN.0f` / negative weights, producing C++ a designer may paste into the real game. The range slider (min 0/max 100) hides the corrupt underlying value on screen, so the user never sees why their export is broken.
- **Fix sketch**: Sanitize at the parse boundary: coerce with `Number(entry.DropWeight)` and clamp to `Number.isFinite(w) && w >= 0 ? w : <fallback>`, dropping/flagging invalid rows and surfacing a count in `setImportError`. Make the editor's weight field a branded "finite non-negative" type so all downstream math (sum, share, codegen) is provably safe.

## 3. Clipboard copy swallows promise rejection — "Copied!" shown even when the copy failed
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:128-135 (`handleCopyReExport`)
- **Scenario**: A user clicks "Re-export" then the copy button in a context where `navigator.clipboard.writeText` rejects or is unavailable — non-secure origin (HTTP/LAN dev preview), the document not focused, or a browser that gates clipboard on a permission the user denied. `navigator.clipboard.writeText(text)` returns a promise that is neither awaited nor `.catch()`-ed; the code unconditionally calls `setCopiedReExport(true)`.
- **Root cause**: The success indicator is decoupled from the actual async result — it fires optimistically on dispatch, not on resolution. The rejected promise is also an unhandled rejection. `navigator.clipboard` can even be `undefined`, which would throw synchronously and is likewise uncaught here.
- **Impact**: UX degradation / data loss (of intent). The user sees the "copied" confirmation, pastes into their UE5 project, and gets stale/empty clipboard contents — silently shipping nothing or an old value. No error is ever surfaced.
- **Fix sketch**: `await`/`.then()` the write and only set the copied flag on resolve; on reject (or missing `navigator.clipboard`) show an error state and a textarea fallback. Centralize this in one `copyToClipboard(text): Promise<boolean>` helper used by every copy button so the success-theater class of bug can't recur.

## 4. Economy linter's "median" is wrong on even rosters and self-suppresses on small EVs
- **Severity**: medium
- **Category**: logic-error
- **File**: src/lib/loot/economy.ts:137-150 (`lintLootEconomy`)
- **Scenario**: A designer lints a loot binding against its peers. With an even number of peers, `median = peerEvs[Math.floor(peerEvs.length / 2)]` returns the upper-middle element, not the average of the two middles — e.g. peers `[10, 90]` yield `median = 90`. The high-outlier rule (`ev > median * 2.5`) then needs `ev > 225` instead of the true `ev > 125`, so genuine over-rewarding tables pass clean. Separately, when peer EVs are small (common for minions: `computeExpectedValue` *rounds*, and a low-drop minion can compute to `0`), the `median > 0` guard makes the entire outlier block silently no-op.
- **Root cause**: An off-by-one "median" (no even-length averaging) combined with a `median > 0` gate that conflates "no meaningful peers" with "rounded to zero." The rounding in `computeExpectedValue` (line 73) pushes small EVs to integers, making `median === 0` reachable for whole valid rosters of cheap enemies.
- **Impact**: UX degradation / silent failure. The balance guardrail that exists specifically to catch over/under-rewarding loot quietly fails to fire — a designer trusts a green "Loot economy looks well-formed" result while an outlier ships. Asymmetric bias: skewed toward missing *high* outliers (the dangerous, economy-inflating ones).
- **Fix sketch**: Compute a true median (average the two central elements for even length) and compare against a peer **scale** that doesn't collapse to zero (e.g. use the mean or a small epsilon floor, or skip rounding inside the comparison by linting on un-rounded EV). Gate on "enough distinct peers" rather than `median > 0`, so a roster of low-value enemies is still checked relative to each other.
