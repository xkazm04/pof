'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { parseUE5LootTable } from '../_shared/codegen';
import type { LootEditorEntryExpanded, LootSource, UE5LootTableJson } from '../_shared/data';

interface UseLootTableImportArgs {
  setEditorEntries: Dispatch<SetStateAction<LootEditorEntryExpanded[]>>;
  setEditorHistory: Dispatch<SetStateAction<LootEditorEntryExpanded[][]>>;
  setNothingWeight: Dispatch<SetStateAction<number>>;
  setImportSource: Dispatch<SetStateAction<string | null>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
  setShowEditorJson: Dispatch<SetStateAction<boolean>>;
  setShowReExport: Dispatch<SetStateAction<'json' | 'cpp' | null>>;
  setPage: Dispatch<SetStateAction<number>>;
}

export function useLootTableImport({
  setEditorEntries, setEditorHistory, setNothingWeight,
  setImportSource, setImportError,
  setShowEditorJson, setShowReExport, setPage,
}: UseLootTableImportArgs) {
  return useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string) as UE5LootTableJson;
        const { entries, nothingWeight: nw } = parseUE5LootTable(json);
        if (entries.length === 0) {
          setImportError('No loot entries found in file. Expected { Entries: [...] } format.');
          return;
        }
        const expanded: LootEditorEntryExpanded[] = entries.map(ent => ({ ...ent, source: 'enemy' as LootSource }));
        setEditorEntries(expanded);
        setEditorHistory([expanded]);
        setNothingWeight(nw);
        setImportSource(file.name);
        setImportError(null);
        setShowEditorJson(false);
        setShowReExport(null);
        setPage(0);
      } catch {
        setImportError('Failed to parse JSON. Ensure the file is a valid UE5 loot table export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setEditorEntries, setEditorHistory, setNothingWeight, setImportSource, setImportError, setShowEditorJson, setShowReExport, setPage]);
}
