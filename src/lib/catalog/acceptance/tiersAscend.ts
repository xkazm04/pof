import { markContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';
import { tagRequiredFields } from '@/lib/catalog/acceptance/requiredFields';
import type { Checker } from '@/lib/catalog/acceptance/types';

/**
 * Affix-tier progression law: later rows unlock at the same or a higher item level and
 * never reduce the tier's maximum roll. The list order is the authored tier order.
 */
export function tiersAscend(
  field: string,
  label = 'Item level and maximum value ascend by tier',
): Checker {
  return tagRequiredFields(markContentInvariant((data) => {
    const rows = data[field];
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        label,
        tier: 'L0',
        status: 'pending',
        detail: 'no tiers to compare',
        reason: `field "${field}" must be a non-empty tier list`,
      };
    }

    let previousLevel = Number.NEGATIVE_INFINITY;
    let previousMaximum = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (row == null || typeof row !== 'object' || Array.isArray(row)) {
        return {
          label,
          tier: 'L0',
          status: 'fail',
          detail: `tier ${index} is not an object`,
          reason: `field "${field}"[${index}] must carry numeric minItemLevel and valueMax`,
        };
      }

      const tier = row as Record<string, unknown>;
      const minItemLevel = tier.minItemLevel;
      const valueMax = tier.valueMax;
      if (
        typeof minItemLevel !== 'number'
        || !Number.isFinite(minItemLevel)
        || typeof valueMax !== 'number'
        || !Number.isFinite(valueMax)
      ) {
        return {
          label,
          tier: 'L0',
          status: 'fail',
          detail: `tier ${index} has non-numeric progression values`,
          reason: `field "${field}"[${index}] needs finite numeric minItemLevel and valueMax`,
        };
      }
      if (minItemLevel < previousLevel) {
        return {
          label,
          tier: 'L0',
          status: 'fail',
          detail: `tier ${index} unlock level ${minItemLevel} < ${previousLevel}`,
          reason: `field "${field}" must have non-decreasing minItemLevel values in tier order`,
        };
      }
      if (valueMax < previousMaximum) {
        return {
          label,
          tier: 'L0',
          status: 'fail',
          detail: `tier ${index} maximum ${valueMax} < ${previousMaximum}`,
          reason: `field "${field}" must have non-decreasing valueMax values in tier order`,
        };
      }
      previousLevel = minItemLevel;
      previousMaximum = valueMax;
    }

    return {
      label,
      tier: 'L0',
      status: 'pass',
      detail: `${rows.length} tier(s) ascend by item level and maximum value`,
    };
  }), {
    field,
    shape: 'a tier-ordered list whose minItemLevel and valueMax numbers are non-decreasing',
  });
}
