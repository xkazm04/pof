/**
 * Pure VS-test scaffolder — turn a PLANNED (but unregistered) UE automation test NAME into a
 * compilable C++ automation-test skeleton whose registered name UE discovery matches EXACTLY.
 *
 * The 29 planned `VS*Test` / `PoF.*.Config` gates are the named NEXT of two campaigns and have
 * been parked `deferred` forever — the live drain matched 0 of 8621 UE tests because nothing ever
 * turned a planned test NAME into authorable code. This module is the app-side half: a deterministic
 * generator (no I/O, no UE) faithful to the `Source/PoF/Test` conventions verified against the real
 * tree (`VSCharacterVaelTest.cpp`, `VSProgressionCurveTest.cpp`):
 *
 *   IMPLEMENT_SIMPLE_AUTOMATION_TEST(F<Class>, "Project.Functional Tests.PoF.<...>",
 *       EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
 *
 * The drain requests a test with `Automation RunTests <name>`, which matches the registered full
 * name by SUBSTRING (`parseTestName` in the runner recovers `<name>` from the deferred reason). So
 * the one invariant the generator must hold: the emitted registered name CONTAINS the requested
 * name verbatim. We emit map-free simple-automation (headless / `-nullrhi` safe — the only shape the
 * batch boot can actually run, since it opens no map); a behaviour needing a live PIE map is left as
 * an author's TODO (convert to an `AARPGFunctionalTestBase` subclass placed in the slice map).
 *
 * Deliberately dependency-free (no DB, no pipeline registry) so the runner can import the pure
 * predicate/annotation without pulling I/O in. The DB-backed listing lives in `plannedTests.ts`.
 */

/** A planned test name parsed into the pieces a faithful scaffold needs. */
export interface ParsedTestName {
  /** The exact string the drain requests — the registered name MUST contain this verbatim. */
  requested: string;
  /** The F-prefixed C++ class identifier for the test. */
  className: string;
  /** The full `Project.Functional Tests.…` registered name (contains `requested`). */
  registeredName: string;
  /** `dotted` = a `PoF.<Topic>.<Sub>` config gate; `class` = a `VS*Test`-shaped name. */
  shape: 'dotted' | 'class';
  /** Suggested source filename (class name without the leading `F`). */
  fileName: string;
}

const REGISTERED_PREFIX = 'Project.Functional Tests';

function pascalSegments(s: string): string {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/** Is this a name we can faithfully scaffold? (non-empty, has identifier characters). */
export function isScaffoldable(name: string | null | undefined): boolean {
  return !!name && /[A-Za-z]/.test(name) && name.trim().length > 0;
}

/**
 * Parse a requested test name into a faithful scaffold identity. Throws on an unscaffoldable name
 * (empty / no identifier chars) so callers can surface the reason. Pure.
 */
export function parsePlannedTestName(requested: string): ParsedTestName {
  const name = (requested ?? '').trim();
  if (!isScaffoldable(name)) {
    throw new Error(`not a scaffoldable UE test name: ${JSON.stringify(requested)}`);
  }

  if (name.includes('.')) {
    // Config gate: deferred writes `PoF.<Topic>.<Sub>` — a substring of the registered full name.
    const registeredName = name.startsWith(REGISTERED_PREFIX) ? name : `${REGISTERED_PREFIX}.${name}`;
    // Class: PascalCase of the segments (dropping a leading `PoF`), suffixed `Test`.
    const segs = name.split('.').filter((s) => s && s.toLowerCase() !== 'pof');
    const core = pascalSegments(segs.join(' '));
    const className = `F${core}${core.endsWith('Test') ? '' : 'Test'}`;
    return { requested: name, className, registeredName, shape: 'dotted', fileName: `${className.slice(1)}.cpp` };
  }

  // Class-shaped name (`VSFactionRepTest`, `AshenForestSetupTest`). The class name IS (near) the
  // requested string; the registered path embeds it as the last segment (matches the real
  // `Project.Functional Tests.PoF.Progression.VSProgressionCurveTest` convention).
  const className = name.startsWith('F') ? name : `F${name}`;
  const topic = pascalSegments(name.replace(/^VS/, '').replace(/(Setup)?Test$/i, '')) || pascalSegments(name);
  const registeredName = `${REGISTERED_PREFIX}.PoF.${topic}.${name}`;
  return { requested: name, className, registeredName, shape: 'class', fileName: `${className.slice(1)}.cpp` };
}

/** Escape a string for embedding inside a C++ `TEXT("…")` / name string literal. */
function cppEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
}

export interface ScaffoldResult {
  /** The parsed identity behind the generated file. */
  parsed: ParsedTestName;
  /** Suggested path relative to the UE project root. */
  suggestedPath: string;
  /** The C++ source text. */
  code: string;
}

/**
 * Generate a compilable simple-automation C++ skeleton for a planned test name. The body asserts
 * the pipeline claim as a TODO and fails LOUDLY (`AddError` + `return false`) until an author fills
 * it in — an unimplemented scaffold must never read as a passing test. ≤ ~40 LOC (well under the
 * 200-LOC guidance). Pure.
 */
export function generateScaffold(requested: string, claim?: string): ScaffoldResult {
  const parsed = parsePlannedTestName(requested);
  const claimText = cppEscape(claim && claim.trim() ? claim.trim() : `${parsed.requested} (planned L3 gate)`);
  const code = `// ${parsed.className} — SCAFFOLD (generated by PoF ue-test-scaffold; author the body, then land).
//
// Registered name: "${parsed.registeredName}"
//   \`Automation RunTests ${parsed.requested}\` matches this by substring — do NOT rename it.
//
// Map-free simple-automation (headless / -nullrhi safe). If this claim needs a live PIE map,
// convert to an AARPGFunctionalTestBase subclass placed in the slice map (Source/PoF/Test/README.md).
//
// TODO(scaffold): replace the AddError guard below with real assertions for the claim:
//   ${claimText}

#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	${parsed.className},
	"${parsed.registeredName}",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool ${parsed.className}::RunTest(const FString& /*Parameters*/)
{
	// TODO(scaffold): assert the claim, e.g. TestTrue(TEXT("..."), <condition>);
	AddError(TEXT("Scaffold not yet implemented: ${claimText}"));
	return false;
}
`;
  return { parsed, suggestedPath: `Source/PoF/Test/${parsed.fileName}`, code };
}

// ── Drain / status vocabulary — "planned, scaffold available" vs plain deferred ────────────────

/**
 * The additive note appended to a zero-match (planned / not-registered) deferred verdict detail so
 * /status and the drain can distinguish "planned — a scaffold can be generated" from an opaque
 * deferred wait. Consumed by the runner's `ZERO_MATCH_DETAIL` producers (batchAutomation / spawn).
 */
export const SCAFFOLD_AVAILABLE_NOTE = 'planned — scaffold available (POST /api/ue-test-scaffold)';

/** Append {@link SCAFFOLD_AVAILABLE_NOTE} to a zero-match deferred detail. Idempotent + pure. */
export function annotateZeroMatchDetail(detail: string): string {
  return detail.includes(SCAFFOLD_AVAILABLE_NOTE) ? detail : `${detail} — ${SCAFFOLD_AVAILABLE_NOTE}`;
}
