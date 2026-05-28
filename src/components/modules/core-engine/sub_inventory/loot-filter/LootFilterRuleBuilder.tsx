'use client';

import { useMemo } from 'react';
import { ListFilter, Eye, FileCode } from 'lucide-react';
import { useActiveRuleset } from '@/stores/lootFilterStore';
import { useItemEntries } from '@/stores/catalogStore';
import { DUMMY_ITEMS, ACCENT, type ItemData } from '../_shared/data';
import { evaluateRuleset } from '@/lib/loot-filter/engine';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { RulesetToolbar } from './RulesetToolbar';
import { RuleList } from './RuleList';
import { LivePreview } from './LivePreview';
import { ExportPanel } from './ExportPanel';

/**
 * Loot Filter Rule Builder — ordered Show/Hide/Highlight rules keyed on rarity,
 * type, subtype, and affix axis, previewed live against the item catalog and
 * exported to UE as a DataTable through the catalog pipeline.
 */
export function LootFilterRuleBuilder() {
  const ruleset = useActiveRuleset();
  const itemEntries = useItemEntries();

  // DUMMY_ITEMS ∪ catalogStore items (catalog entries win on id collision).
  const previewItems = useMemo<ItemData[]>(() => {
    const byId = new Map<string, ItemData>();
    for (const it of DUMMY_ITEMS) byId.set(it.id, it);
    for (const e of itemEntries) byId.set(e.data.id, e.data);
    return [...byId.values()];
  }, [itemEntries]);

  const evaluation = useMemo(() => evaluateRuleset(previewItems, ruleset), [previewItems, ruleset]);

  return (
    <div className="space-y-3">
      <RulesetToolbar active={ruleset} accent={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label="Rules" color={ACCENT} icon={ListFilter} />
          <RuleList rulesetId={ruleset.id} rules={ruleset.rules} accent={ACCENT} />
        </BlueprintPanel>

        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label={`Live Preview · ${previewItems.length} drops`} color={ACCENT} icon={Eye} />
          <LivePreview evaluation={evaluation} accent={ACCENT} />
        </BlueprintPanel>
      </div>

      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label="Export to Unreal" color={ACCENT} icon={FileCode} />
        <ExportPanel ruleset={ruleset} accent={ACCENT} />
      </BlueprintPanel>
    </div>
  );
}
