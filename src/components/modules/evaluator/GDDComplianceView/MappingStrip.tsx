import { Link2Off, HelpCircle } from 'lucide-react';
import { useDisclosure } from '@/hooks/useDisclosure';
import type { ChecklistMappingStats, UnmappedChecklistItem } from '@/types/gdd-compliance';
import { STATUS_WARNING, STATUS_SUCCESS } from '@/lib/chart-colors';

/**
 * "N of M checklist items are wired to features" — the sentence the gap list
 * cannot say about itself.
 *
 * An unmapped checklist item produces NO gap in either checklist direction, so
 * its absence from the list below reads exactly like compliance. It is not: it
 * is an item the audit cannot see. This strip states the share it can, and names
 * the items it cannot, so a short gap list is read against how much was in scope.
 */
export function mappingSentence(m: ChecklistMappingStats): string {
  if (m.itemsTotal === 0) return 'no checklist items in scope';
  const explicit = m.mapped - m.noFeatureEvidence;
  const parts = [`${explicit} of ${m.itemsTotal} items mapped to features`];
  if (m.noFeatureEvidence > 0) parts.push(`${m.noFeatureEvidence} declared un-evidenceable`);
  if (m.multiFeature > 0) parts.push(`${m.multiFeature} span multiple features`);
  if (m.heuristic > 0) parts.push(`${m.heuristic} guessed by label substring`);
  if (m.unmapped > 0) parts.push(`${m.unmapped} unmapped`);
  if (m.danglingMappings > 0) parts.push(`${m.danglingMappings} mapped feature(s) absent from the scan`);
  return parts.join(' · ');
}

export function MappingStrip({ mapping, unmappedItems }: {
  mapping: ChecklistMappingStats;
  unmappedItems: UnmappedChecklistItem[];
}) {
  const { open, toggle, buttonProps, panelProps } = useDisclosure(false);
  if (mapping.itemsTotal === 0) return null;

  const unlinked = mapping.heuristic + mapping.unmapped;
  const color = unlinked > 0 ? STATUS_WARNING : STATUS_SUCCESS;
  const Icon = unlinked > 0 ? Link2Off : HelpCircle;

  return (
    <div className="space-y-1">
      <p className="inline-flex items-start gap-1 text-2xs" style={{ color }}>
        <Icon className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span className="font-medium">Checklist mapping</span>
        <span className="text-text-subtle">— {mappingSentence(mapping)}</span>
      </p>
      {unmappedItems.length > 0 && (
        <>
          <button
            {...buttonProps}
            onClick={toggle}
            className="text-2xs text-text-muted underline underline-offset-2 hover:text-text focus-ring rounded"
          >
            {open ? 'Hide' : 'Show'} the {unmappedItems.length} item(s) with no explicit mapping
          </button>
          {open && (
            <ul {...panelProps} className="space-y-0.5 pl-3">
              {unmappedItems.map((item) => (
                <li key={item.id} className="text-2xs text-text-subtle">
                  <span className="text-text-muted">{item.label}</span>
                  {item.fallback === 'heuristic'
                    ? ` — graded against "${item.heuristicFeature}", a label-substring guess (verify it)`
                    : ' — invisible to the checklist gap categories (no feature matched)'}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
