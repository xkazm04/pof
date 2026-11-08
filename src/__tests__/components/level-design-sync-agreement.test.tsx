import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DocSidebar } from '@/components/modules/content/level-design/LevelDesignView/DocSidebar';
import { deriveSummary } from '@/hooks/useDesignDocument';
import type { LevelDesignDocument } from '@/types/level-design';
import type { LevelDesignVM } from '@/components/modules/content/level-design/LevelDesignView/useLevelDesignView';

afterEach(() => cleanup());

function doc(id: number, lastCodeHash: string | null): LevelDesignDocument {
  return {
    id, name: `L${id}`, description: '', designNarrative: '', rooms: [], connections: [],
    difficultyArc: [], pacingNotes: '', syncStatus: 'synced', syncReport: [],
    lastGeneratedAt: null, lastCodeHash, createdAt: '', updatedAt: '',
  } as unknown as LevelDesignDocument;
}

function renderSidebar(docs: LevelDesignDocument[]) {
  const vm = {
    docs, summary: deriveSummary(docs), activeDoc: null,
    setActiveDocId: () => {}, setSelectedRoomId: () => {},
    isCreating: false, newDocName: '', setNewDocName: () => {}, handleCreateDoc: () => {},
  } as unknown as LevelDesignVM;
  return render(<DocSidebar vm={vm} />);
}

describe('sidebar synced count agrees with the per-document dot', () => {
  it('a synced doc with no lastCodeHash is Never checked and is not counted as synced', () => {
    const { container } = renderSidebar([doc(1, null)]);
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain('Never checked');
    expect(container.textContent).not.toMatch(/\d+ synced/);
  });

  it('a synced doc that carries a hash is counted as synced', () => {
    const { container } = renderSidebar([doc(1, 'abc'), doc(2, null)]);
    expect(container.textContent).toMatch(/1 synced/);
  });
});
