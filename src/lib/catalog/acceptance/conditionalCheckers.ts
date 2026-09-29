import { isContentInvariant, markContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';
import { tagRequiredFields } from '@/lib/catalog/acceptance/requiredFields';
import type { AcceptanceResult, Checker } from '@/lib/catalog/acceptance/types';

const pass = (label: string, detail: string): AcceptanceResult => ({ label, tier: 'L0', status: 'pass', detail });
const fail = (label: string, detail: string, reason: string): AcceptanceResult =>
  ({ label, tier: 'L0', status: 'fail', detail, reason });

function objectAt(data: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const value = field.split('.').reduce<unknown>(
    (current, key) => current && typeof current === 'object'
      ? (current as Record<string, unknown>)[key]
      : undefined,
    data,
  );
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Require object fields only for the declared discriminator values. */
export function fieldsRequiredWhen(
  field: string,
  label: string,
  discriminator: string,
  values: string[],
  keys: string[],
  match: 'equals' | 'includes' = 'equals',
): Checker {
  const condition = match === 'includes'
    ? `when ${discriminator} contains ${values.map((value) => `"${value}"`).join(' or ')}`
    : `when ${discriminator} is ${values.map((value) => `"${value}"`).join(' or ')}`;
  return tagRequiredFields((data) => {
    const obj = objectAt(data, field);
    if (!obj) return fail(label, 'not an object', `field "${field}" must be an object`);
    const declared = obj[discriminator];
    if (typeof declared !== 'string' || !declared.trim()) {
      return fail(label, `${discriminator} invalid`, `field "${field}.${discriminator}" must be a non-blank string discriminator`);
    }
    const normalized = declared.toLowerCase();
    const applies = values.some((value) => match === 'includes'
      ? normalized.includes(value.toLowerCase())
      : normalized === value.toLowerCase());
    if (!applies) return pass(label, `${condition} does not apply`);
    const missing = keys.filter((key) => obj[key] == null);
    return missing.length === 0
      ? pass(label, `${condition}: ${keys.join(' / ')} populated`)
      : fail(label, `${missing.join(', ')} missing`, `field "${field}" ${condition} and is missing: ${missing.join(', ')}`);
  }, {
    field,
    shape: `${condition}, also include ${keys.join(', ')}`,
  });
}

/** Require fields on list entries only for entries whose own discriminator selects that shape. */
export function entryFieldsRequiredWhen(
  field: string,
  label: string,
  discriminator: string,
  values: string[],
  keys: string[],
): Checker {
  return tagRequiredFields((data) => {
    if (!Array.isArray(data[field])) return fail(label, 'not an array', `field "${field}" must be an array of entries`);
    const entries = data[field] as unknown[];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
        return fail(label, `entry ${index} is not an object`, `field "${field}"[${index}] must be an object`);
      }
      const obj = entry as Record<string, unknown>;
      const declared = obj[discriminator];
      if (typeof declared !== 'string' || !declared.trim()) {
        return fail(label, `entry ${index} ${discriminator} invalid`, `field "${field}"[${index}].${discriminator} must be a non-blank string discriminator`);
      }
      if (!values.some((value) => value.toLowerCase() === declared.toLowerCase())) continue;
      const missing = keys.filter((key) => obj[key] == null);
      if (missing.length) {
        return fail(label, `entry ${index} incomplete`, `field "${field}"[${index}] declares ${discriminator}="${declared}" and is missing: ${missing.join(', ')}`);
      }
    }
    return pass(label, `${entries.length} conditional entr${entries.length === 1 ? 'y' : 'ies'} checked`);
  }, {
    field,
    shape: `entries whose ${discriminator} is ${values.join(' or ')} also include ${keys.join(', ')}`,
  });
}

/** Run a checker only when an object declares one of the selected discriminator values. */
export function whenFieldIs(
  field: string,
  discriminator: string,
  values: string[],
  checker: Checker,
  label: string,
): Checker {
  const conditional: Checker = (data, ctx) => {
    const obj = objectAt(data, field);
    if (!obj) return fail(label, 'not an object', `field "${field}" must be an object`);
    const declared = obj[discriminator];
    if (typeof declared !== 'string' || !declared.trim()) {
      return fail(label, `${discriminator} invalid`, `field "${field}.${discriminator}" must be a non-blank string discriminator`);
    }
    return values.some((value) => value.toLowerCase() === declared.toLowerCase())
      ? checker(data, ctx)
      : pass(label, `${discriminator}="${declared}" does not select this check`);
  };
  return isContentInvariant(checker) ? markContentInvariant(conditional) : conditional;
}

/** Run a checker when a declared string-list includes the selected component name. */
export function whenListIncludes(
  field: string,
  listKey: string,
  value: string,
  checker: Checker,
  label: string,
): Checker {
  const conditional: Checker = (data, ctx) => {
    const obj = objectAt(data, field);
    if (!obj) return fail(label, 'not an object', `field "${field}" must be an object`);
    const list = obj[listKey];
    if (list == null) return pass(label, `${value} component is not declared`);
    if (!Array.isArray(list) || list.some((entry) => typeof entry !== 'string' || !entry.trim())) {
      return fail(label, `${listKey} invalid`, `field "${field}.${listKey}" must be an array of non-blank component field names`);
    }
    return list.includes(value)
      ? checker(data, ctx)
      : pass(label, `${value} component is not declared`);
  };
  return isContentInvariant(checker) ? markContentInvariant(conditional) : conditional;
}

/** Sum the numeric fields named by an artifact's own component list and reconcile its total. */
export function declaredComponentsReconcile(
  field: string,
  totalKey: string,
  componentKeysKey: string,
  label: string,
  tolerance = 0.5,
): Checker {
  return markContentInvariant(tagRequiredFields((data) => {
    const obj = objectAt(data, field);
    if (!obj) return fail(label, 'not an object', `field "${field}" must be an object`);
    const total = obj[totalKey];
    if (typeof total !== 'number' || !Number.isFinite(total)) {
      return fail(label, `${totalKey} invalid`, `field "${field}.${totalKey}" must be a finite number`);
    }
    const componentKeys = obj[componentKeysKey];
    if (!Array.isArray(componentKeys) || componentKeys.length === 0 || componentKeys.some((key) => typeof key !== 'string' || !key.trim())) {
      return fail(label, `${componentKeysKey} invalid`, `field "${field}.${componentKeysKey}" must be a non-empty array of component field names`);
    }
    let sum = 0;
    for (const key of componentKeys as string[]) {
      const value = obj[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fail(label, `${key} invalid`, `field "${field}.${key}" is declared by ${componentKeysKey} and must be a finite number`);
      }
      sum += value;
    }
    const difference = Math.abs(total - sum);
    return difference <= tolerance
      ? pass(label, `${totalKey}=${total} = declared components ${sum}`)
      : fail(label, `${total} ≠ ${sum}`, `arithmetic: field "${field}.${totalKey}"=${total} does not reconcile with declared components [${(componentKeys as string[]).join(', ')}]=${sum}`);
  }, {
    field,
    shape: `${componentKeysKey} is a non-empty JSON array naming numeric component fields whose sum equals ${totalKey}`,
  }));
}
