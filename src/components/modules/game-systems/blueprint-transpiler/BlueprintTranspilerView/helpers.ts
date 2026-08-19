import { apiMacroFor, sanitizeModuleName } from '@/lib/blueprint-cpp-codegen';

export { apiMacroFor };

/**
 * Sanitize a project name into a UE C++ module identifier.
 *
 * Re-exported from the codegen module so the module name shown in the write
 * modal and the `<MODULE>_API` macro baked into the header are derived by the
 * SAME rule — they name one decision and must not be able to disagree.
 */
export const sanitizeModule = sanitizeModuleName;

/**
 * Does this header declare the API macro of the module it is about to be
 * written into?
 *
 * The write modal lets the user retarget the module *after* the code was
 * generated. Writing then lands `class OTHERMODULE_API AFoo` in
 * `Source/<Module>/` — the class is exported from a module it does not live in,
 * which fails at link time with nothing in the app having said a word.
 */
export function headerDeclaresModule(header: string, moduleName: string): boolean {
  const declared = header.match(/\bclass\s+([A-Z_][A-Z0-9_]*_API)\s/);
  if (!declared) return false;
  return declared[1] === apiMacroFor(moduleName);
}
