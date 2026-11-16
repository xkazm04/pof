/**
 * The asset-path slug every non-Items catalog pipeline derives from an entity NAME.
 *
 * Readable form is the old lossy one (`Iron Sword` → `IronSword`), so every ASCII name keeps
 * byte-identical output. A name with no ASCII letters or digits used to sanitise to an EMPTY slug
 * and emit bare-prefix UE assets (`BP_`, `NS_`, `ACH_`) shared by every such entity; it now gets
 * `Entity_<token>`, a stable path-safe token of the name, so distinct names never collide.
 *
 * Pure and server-safe (no store, no React, no fs).
 */
export function readableEntitySlug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '');
}

/** Short, stable, path-safe token of a string (base-36 of a 32-bit hash). */
function nameToken(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function entitySlug(name: string): string {
  return readableEntitySlug(name) || `Entity_${nameToken(name)}`;
}
