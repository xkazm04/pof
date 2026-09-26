import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

interface LabelledValue {
  label: string;
  value: string;
}

const isLabelledValue = (value: unknown): value is LabelledValue => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LabelledValue>;
  return typeof candidate.label === 'string' && typeof candidate.value === 'string';
};

/** Unique source line ids named by questTalk but absent from wrapped dialog-tree line rows. */
export function unresolvedQuestTalk(wrappers: readonly ReferenceWrapper[]): string[] {
  const lineIds = new Set(
    wrappers
      .filter((wrapper) => wrapper.catalogId === 'dialog-trees')
      .map((wrapper) => wrapper.key),
  );
  const unresolved = new Set<string>();

  for (const wrapper of wrappers) {
    const questTalk = wrapper.entity.data.questTalk;
    if (!Array.isArray(questTalk)) continue;
    for (const entry of questTalk) {
      if (isLabelledValue(entry) && !lineIds.has(entry.value)) unresolved.add(entry.value);
    }
  }

  return [...unresolved].sort();
}
