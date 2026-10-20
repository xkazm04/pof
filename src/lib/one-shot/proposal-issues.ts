import { seededEntities } from '@/lib/catalog/seed';
import { validateProposal, type ValidationContext, type ValidationIssue } from './validate-proposal';

/** What the propose and refine routes answer with: the proposal plus what is wrong with it. */
export interface ProposalEnvelope {
  name: string;
  data: unknown;
  rationale: string;
  issues: ValidationIssue[];
}

/** The validate-and-envelope step the propose and refine routes share. */
export function proposalEnvelope(
  parsed: Record<string, unknown>,
  ctx: ValidationContext & { catalogId: string },
): ProposalEnvelope {
  const { catalogId, ...vctx } = ctx;
  const issues = validateProposal(catalogId, parsed as { name?: string; data?: unknown }, vctx);
  return {
    name: typeof parsed.name === 'string' ? parsed.name : '',
    data: parsed.data ?? {},
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
    issues,
  };
}

/**
 * Link resolution against the seeded catalogs: `seededEntities` is read lazily and once per
 * catalog for the lifetime of the returned context (one request).
 */
export function seededLinkContext(): Pick<ValidationContext, 'resolveLink' | 'knownCatalog'> {
  const cache = new Map<string, Set<string>>();
  const idsOf = (catalogId: string): Set<string> => {
    let ids = cache.get(catalogId);
    if (!ids) {
      ids = new Set(seededEntities(catalogId).map((e) => e.id));
      cache.set(catalogId, ids);
    }
    return ids;
  };
  return {
    resolveLink: (catalogId, entityId) => idsOf(catalogId).has(entityId),
    knownCatalog: (catalogId) => idsOf(catalogId).size > 0,
  };
}

/** One corrective refine direction for the issues; `null` when there is nothing to fix. */
export function issueRefineDirection(issues: ValidationIssue[] | undefined): string | null {
  if (!issues || issues.length === 0) return null;
  const lines = issues.map((i) => `- ${i.field}: ${i.message}`).join('\n');
  return `Fix these validation issues in the proposal:\n${lines}\nKeep everything else unchanged.`;
}

/** The Run button's suffix: ' · 2 issues'; empty for none or a proposal persisted before the field existed. */
export function runIssueNote(proposal: { issues?: ValidationIssue[] }): string {
  const n = proposal.issues?.length ?? 0;
  return n === 0 ? '' : ` · ${n} issue${n === 1 ? '' : 's'}`;
}
