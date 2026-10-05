/**
 * Deleting a collection must go through a confirm step, same as every other
 * irreversible action in the app (ConfirmDialog) — it used to fire on the first
 * click of the trash icon.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CollectionSidebar } from '@/components/modules/visual-gen/asset-browser/CollectionSidebar';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import type { Collection } from '@/types/asset-library';

// ConfirmDialog imports src/lib/chart-colors.ts, which another session has left mid-merge
// with unresolved conflict markers — unrelated to this test. Stub it with a minimal
// equivalent that exposes the same confirm/cancel affordance.
vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm, onClose, title }: { open: boolean; onConfirm: () => void; onClose: () => void; title: string }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

afterEach(cleanup);

const COLLECTION: Collection = { id: 'col-1', name: 'Props', assetCount: 3 } as Collection;

describe('CollectionSidebar delete confirmation', () => {
  it('does not delete on the first click — opens a confirm dialog instead', () => {
    const deleteCollection = vi.fn().mockResolvedValue(undefined);
    useAssetLibraryStore.setState({ deleteCollection } as never);

    render(<CollectionSidebar collections={[COLLECTION]} totalCount={3} favoriteCount={0} />);

    fireEvent.click(screen.getByRole('button', { name: /delete props/i }));

    expect(deleteCollection).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('deletes only after the confirm button is clicked', () => {
    const deleteCollection = vi.fn().mockResolvedValue(undefined);
    useAssetLibraryStore.setState({ deleteCollection } as never);

    render(<CollectionSidebar collections={[COLLECTION]} totalCount={3} favoriteCount={0} />);

    fireEvent.click(screen.getByRole('button', { name: /delete props/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(deleteCollection).toHaveBeenCalledWith('col-1');
  });

  it('cancel leaves the collection untouched', () => {
    const deleteCollection = vi.fn().mockResolvedValue(undefined);
    useAssetLibraryStore.setState({ deleteCollection } as never);

    render(<CollectionSidebar collections={[COLLECTION]} totalCount={3} favoriteCount={0} />);

    fireEvent.click(screen.getByRole('button', { name: /delete props/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(deleteCollection).not.toHaveBeenCalled();
  });
});
