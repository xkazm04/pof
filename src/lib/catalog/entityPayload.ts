/**
 * Is this catalog-entity payload actually persistable?
 *
 * `upsertEntity` stores an entity as `JSON.stringify(entity)`, so every value the payload
 * carries has to survive that. Two kinds do not, and the second is the dangerous one:
 *
 *  1. Functions / symbols / `undefined` — `JSON.stringify` drops the key outright. Loud
 *     enough that a later `?? fallback` usually covers it.
 *  2. Objects whose content is non-enumerable or symbol-keyed — a React component, a
 *     `Map`, a `Set`. These stringify to `{}`. The KEY SURVIVES, so `'icon' in entity`
 *     is still true and every presence check passes while the value is gone.
 *
 * `ArchetypeConfig.icon` (a lucide `forwardRef` object) is case 2, which is why a
 * persisted bestiary entity reads back with `icon: {}` and nothing ever complains.
 * Measured 2026-09-22: 13 keys in, 13 keys out, one of them hollow.
 */

/** Values JSON keeps verbatim. */
function isPrimitive(v: unknown): boolean {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

/** A `{}`/`Object.create(null)` bag — the only object shape JSON carries faithfully. */
function isPlainObject(v: object): boolean {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * A non-array object that stringifies to `{}` and yet is NOT an empty plain object has had
 * its content destroyed rather than merely omitted. Two ways to get there:
 *  - it owns keys JSON cannot see — symbol keys (`$$typeof`) or non-enumerables, which is
 *    the React-component case; `Reflect.ownKeys` sees them and `JSON.stringify` cannot;
 *  - it holds its content in internal slots — `Map`, `Set` — so it owns no keys at all and
 *    still reads back as a bare `{}` that has lost its type.
 */
function collapsesToEmpty(v: object): boolean {
  if (isPlainObject(v) && Reflect.ownKeys(v).length === 0) return false;
  try {
    return JSON.stringify(v) === '{}';
  } catch {
    return true; // circular / throwing toJSON — unpersistable either way
  }
}

/**
 * Dotted paths of every key whose value will not survive persistence, in payload order.
 * An empty array means the payload round-trips intact.
 */
export function jsonUnsafeKeys(value: unknown, prefix = ''): string[] {
  const out: string[] = [];

  const visit = (v: unknown, path: string) => {
    if (isPrimitive(v)) return;
    if (typeof v === 'function' || typeof v === 'symbol' || v === undefined) {
      out.push(path);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => visit(item, path ? `${path}.${i}` : String(i)));
      return;
    }
    if (typeof v === 'object' && v !== null) {
      if (collapsesToEmpty(v)) { out.push(path); return; }
      for (const [k, item] of Object.entries(v)) visit(item, path ? `${path}.${k}` : k);
    }
  };

  // The root itself is never reported — only its keys — so a caller always gets paths it
  // can act on.
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [k, item] of Object.entries(value)) visit(item, prefix ? `${prefix}.${k}` : k);
  } else {
    visit(value, prefix);
  }
  return out;
}
