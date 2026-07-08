import type { Dispatch, SetStateAction } from 'react';
import { Search } from 'lucide-react';
import type { LocalizableString, StringContext } from '@/types/localization-pipeline';
import { CONTEXT_LABELS } from '@/lib/localization/definitions';
import type { StringPreset } from './types';
import { STRING_PRESET_LABELS } from './constants';
import { PresetChip } from './PresetChip';
import { StringCard } from './StringCard';

export function StringsTab({
  searchQuery,
  setSearchQuery,
  contextFilter,
  setContextFilter,
  stringPresets,
  setStringPresets,
  filteredStrings,
  strings,
}: {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  contextFilter: StringContext | 'all';
  setContextFilter: Dispatch<SetStateAction<StringContext | 'all'>>;
  stringPresets: Set<StringPreset>;
  setStringPresets: Dispatch<SetStateAction<Set<StringPreset>>>;
  filteredStrings: LocalizableString[];
  strings: LocalizableString[];
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <label htmlFor="loc-strings-search" className="sr-only">Search strings by source text or key</label>
          <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            id="loc-strings-search"
            type="text"
            placeholder="Search strings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
          />
          {(searchQuery || stringPresets.size > 0 || contextFilter !== 'all') && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-indigo-400 font-medium tabular-nums pointer-events-none">
              {filteredStrings.length} of {strings.length}
            </span>
          )}
        </div>
        <label htmlFor="loc-strings-context" className="sr-only">Filter strings by context</label>
        <select
          id="loc-strings-context"
          value={contextFilter}
          onChange={(e) => setContextFilter(e.target.value as StringContext | 'all')}
          className="px-2 py-1.5 rounded-md border border-border bg-surface text-xs text-text focus:outline-none"
        >
          <option value="all">All Contexts</option>
          <optgroup label="Gameplay">
            <option value="ability_name">{CONTEXT_LABELS.ability_name}</option>
            <option value="ability_description">{CONTEXT_LABELS.ability_description}</option>
            <option value="item_name">{CONTEXT_LABELS.item_name}</option>
            <option value="item_tooltip">{CONTEXT_LABELS.item_tooltip}</option>
            <option value="stat_label">{CONTEXT_LABELS.stat_label}</option>
          </optgroup>
          <optgroup label="UI">
            <option value="ui_label">{CONTEXT_LABELS.ui_label}</option>
            <option value="ui_button">{CONTEXT_LABELS.ui_button}</option>
            <option value="menu_title">{CONTEXT_LABELS.menu_title}</option>
            <option value="notification">{CONTEXT_LABELS.notification}</option>
          </optgroup>
          <optgroup label="Narrative">
            <option value="quest_title">{CONTEXT_LABELS.quest_title}</option>
            <option value="quest_description">{CONTEXT_LABELS.quest_description}</option>
            <option value="dialogue_line">{CONTEXT_LABELS.dialogue_line}</option>
            <option value="tutorial">{CONTEXT_LABELS.tutorial}</option>
          </optgroup>
          <optgroup label="Other">
            <option value="unknown">{CONTEXT_LABELS.unknown}</option>
          </optgroup>
        </select>
      </div>

      {/* Preset filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(STRING_PRESET_LABELS) as StringPreset[]).map((preset) => (
          <PresetChip
            key={preset}
            label={STRING_PRESET_LABELS[preset]}
            active={stringPresets.has(preset)}
            onClick={() => {
              setStringPresets((prev) => {
                const next = new Set(prev);
                if (next.has(preset)) next.delete(preset);
                else next.add(preset);
                return next;
              });
            }}
          />
        ))}
      </div>

      <p className="text-2xs text-text-muted">{filteredStrings.length} strings</p>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {filteredStrings.map((s) => (
          <StringCard key={s.id} str={s} />
        ))}
      </div>
    </div>
  );
}
