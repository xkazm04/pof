export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationContext {
  seededIds: Set<string>;
  bands?: Record<string, { min: number; max: number }>;
}

interface SchemaRule {
  required: string[];
  enumLike?: Record<string, string[]>;
}

const SCHEMAS: Record<string, SchemaRule> = {
  items:     { required: ['type', 'rarity'], enumLike: { rarity: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] } },
  bestiary:  { required: ['tier', 'role'],   enumLike: { tier: ['minion', 'standard', 'elite', 'boss', 'raid-boss'] } },
};

export function validateProposal(
  catalogId: string,
  proposal: { name?: string; data?: unknown },
  ctx: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = (proposal.data ?? {}) as Record<string, unknown>;

  if (!proposal.name || typeof proposal.name !== 'string' || proposal.name.length < 2) {
    issues.push({ field: 'name', message: 'name is required (string, ≥2 chars)' });
  }

  const schema = SCHEMAS[catalogId];
  if (schema) {
    for (const f of schema.required) {
      if (data[f] === undefined || data[f] === null || data[f] === '') {
        issues.push({ field: f, message: `required field '${f}' is missing` });
      }
    }
    for (const [f, allowed] of Object.entries(schema.enumLike ?? {})) {
      const v = data[f];
      if (v !== undefined && typeof v === 'string' && !allowed.includes(v)) {
        issues.push({ field: f, message: `${f} must be one of ${allowed.join(', ')} (got '${v}')` });
      }
    }
  }

  // Link resolution
  const links = (data.links ?? []) as Array<{ catalogId: string; entityId: string; role: string }>;
  if (Array.isArray(links)) {
    for (const l of links) {
      if (!l || typeof l !== 'object') continue;
      if (typeof l.entityId === 'string' && !ctx.seededIds.has(l.entityId)) {
        issues.push({ field: `links.${l.entityId}`, message: `link target '${l.entityId}' (catalog '${l.catalogId}') does not exist among seeded ids` });
      }
    }
  }

  // Numeric bands
  if (ctx.bands) {
    for (const [field, band] of Object.entries(ctx.bands)) {
      const v = data[field];
      if (typeof v === 'number' && (v < band.min || v > band.max)) {
        issues.push({ field, message: `${field} value ${v} is outside the band [${band.min}, ${band.max}]` });
      }
    }
  }

  return issues;
}
