/**
 * Slugify a user-typed or otherwise unsafe string so it can be embedded in a
 * `data-testid` attribute value. Used only at the testId call site; the
 * underlying record (e.g. a project's name) is not modified.
 *
 * Rules:
 * - Allowed chars: a-z, 0-9, hyphen. Everything else collapses to a single hyphen.
 * - Trims leading/trailing hyphens.
 * - Lowercased.
 *
 * Examples:
 *   slugifyForTestId("My Cool Project") === "my-cool-project"
 *   slugifyForTestId("PoF (alpha)")    === "pof-alpha"
 *   slugifyForTestId("__internal__")    === "internal"
 */
export function slugifyForTestId(s: string): string {
  return s
    .replace(/[^a-z0-9-]+/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}
